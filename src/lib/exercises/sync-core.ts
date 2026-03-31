import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { applyCuratedExerciseContent, computeExerciseCompletenessScore, computeQualityFlags } from './catalog-curation';
import { CURATED_PT_ALIASES } from './aliases';
import { pickBestExerciseMedia } from './media-ranking';

export type SyncMode = 'import' | 'sync';
export type SyncOptions = {
  mode?: SyncMode;
  useStateFile?: boolean;
  stateFilePath?: string;
  seedAliases?: boolean;
  enrichMedia?: boolean;
  importBatchSize?: number;
  upsertBatchSize?: number;
  mediaBatchSize?: number;
  requestDelayMs?: number;
};

type ExerciseDbItem = { id: string; name: string; bodyPart?: string; target?: string; secondaryMuscles?: string[]; equipment?: string; instructions?: string[]; gifUrl?: string };
type ExercisePayload = Record<string, any>;
type SyncState = { importOffset: number; mediaOffset: number; aliasCompleted: boolean; updatedAt: string };

export type SyncSummary = {
  imported: number;
  upserted: number;
  failed: number;
  mediaEnriched: number;
  mediaFailed: number;
  aliasesSeeded: number;
  importOffset: number;
  mediaOffset: number;
  improved_completeness_count: number;
  new_video_count: number;
  gif_only_count: number;
  text_only_count: number;
  low_confidence_media_count: number;
  aliases_seeded_count: number;
};

const REQUIRED_ENVS = ['EXERCISEDB_BASE_URL', 'EXERCISEDB_API_KEY', 'PEXELS_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

function emit(mode: SyncMode, name: string, meta: Record<string, unknown> = {}) {
  logger.info(mode === 'sync' ? `sync_exercises_${name}` : name, meta);
}

function assertEnv() {
  const missing = REQUIRED_ENVS.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing required env(s): ${missing.join(', ')}`);
}

function normalizeLookupKey(value: string): string {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, '_').replace(/^_+|_+$/g, '').slice(0, 240);
}

function toSlug(value: string): string {
  return normalizeLookupKey(value).replace(/_/g, '-').slice(0, 240) || `exercise-${Date.now()}`;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v || '').trim()).filter(Boolean) : [];
}

function readState(stateFilePath: string): SyncState {
  try {
    const data = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    return { importOffset: Number(data.importOffset || 0), mediaOffset: Number(data.mediaOffset || 0), aliasCompleted: Boolean(data.aliasCompleted), updatedAt: String(data.updatedAt || new Date(0).toISOString()) };
  } catch { return { importOffset: 0, mediaOffset: 0, aliasCompleted: false, updatedAt: new Date(0).toISOString() }; }
}

function writeState(stateFilePath: string, partial: Partial<SyncState>) {
  fs.mkdirSync(path.dirname(stateFilePath), { recursive: true });
  const next = { ...readState(stateFilePath), ...partial, updatedAt: new Date().toISOString() };
  fs.writeFileSync(stateFilePath, JSON.stringify(next, null, 2));
}

async function sleep(ms: number) { if (ms > 0) await new Promise((r) => setTimeout(r, ms)); }

async function fetchExerciseDbBatch(limit: number, offset: number): Promise<ExerciseDbItem[]> {
  const baseUrl = process.env.EXERCISEDB_BASE_URL!;
  const url = `${baseUrl.replace(/\/$/, '')}/exercises?limit=${limit}&offset=${offset}`;
  const response = await fetch(url, { headers: { 'X-RapidAPI-Key': process.env.EXERCISEDB_API_KEY!, 'X-RapidAPI-Host': new URL(baseUrl).host } });
  if (!response.ok) throw new Error(`ExerciseDB HTTP ${response.status}`);
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
}

function toExercisePayload(item: ExerciseDbItem): ExercisePayload {
  const name = String(item.name || 'exercise').trim();
  const base: ExercisePayload = {
    source_id: String(item.id || normalizeLookupKey(name)),
    source: 'ExerciseDB',
    name,
    name_en: name,
    name_pt: name,
    slug: toSlug(name),
    normalized_lookup_key: normalizeLookupKey(name),
    body_part: item.bodyPart ? String(item.bodyPart).toLowerCase() : null,
    target_muscle: item.target ? String(item.target).toLowerCase() : null,
    secondary_muscles: toStringArray(item.secondaryMuscles),
    equipment: item.equipment ? String(item.equipment).toLowerCase() : null,
    instructions: toStringArray(item.instructions),
    common_errors: [],
    breathing_tip: null,
    range_of_motion: null,
    media_url: item.gifUrl || null,
    media_thumbnail_url: item.gifUrl || null,
    media_type: item.gifUrl ? 'gif' : null,
    media_provider: item.gifUrl ? 'ExerciseDB' : null,
    media_confidence_score: item.gifUrl ? 0.45 : 0.2,
    content_source: 'exercisedb',
    last_enriched_at: null,
  };
  const enriched = applyCuratedExerciseContent(base);
  const completeness = computeExerciseCompletenessScore(enriched);
  const flags = computeQualityFlags({ ...enriched, completeness_score: completeness });
  return { ...enriched, completeness_score: completeness, quality_flags: flags };
}

async function upsertExercises(supabase: any, rows: ExercisePayload[], batchSize: number) {
  let upserted = 0; let failed = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('exercises').upsert(chunk, { onConflict: 'slug' });
    if (!error) { upserted += chunk.length; continue; }
    for (const row of chunk) {
      const { error: singleError } = await supabase.from('exercises').upsert(row, { onConflict: 'slug' });
      if (singleError) failed += 1; else upserted += 1;
    }
  }
  return { upserted, failed };
}

async function seedAliases(supabase: any): Promise<number> {
  const { error } = await supabase.from('exercise_aliases').select('id').limit(1);
  if (error) return 0;
  let seeded = 0;
  for (const alias of CURATED_PT_ALIASES) {
    const { data: exercise } = await supabase.from('exercises').select('id').eq('normalized_lookup_key', alias.canonical_lookup_key).maybeSingle();
    if (!exercise?.id) continue;
    const { error: upsertError } = await supabase.from('exercise_aliases').upsert({ ...alias, exercise_id: exercise.id }, { onConflict: 'alias_key' });
    if (!upsertError) seeded += 1;
  }
  return seeded;
}

async function enrichMedia(rows: ExercisePayload[], mode: SyncMode, delayMs: number) {
  const result = { ok: 0, failed: 0, newVideo: 0, gifOnly: 0, textOnly: 0, lowConfidence: 0 };
  for (const row of rows) {
    if (row.media_type === 'video' && row.media_confidence_score >= 0.75) continue;
    const response = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(`${row.name_en} exercise proper form`)}&per_page=10`, { headers: { Authorization: process.env.PEXELS_API_KEY! } }).catch(() => null as any);
    const payload = response?.ok ? await response.json().catch(() => ({})) : {};
    const videos = Array.isArray(payload?.videos) ? payload.videos : [];
    const picked = pickBestExerciseMedia(row, videos, { media_url: row.media_url, media_type: row.media_type, media_confidence_score: row.media_confidence_score, gif_url: row.gif_url || (row.media_type === 'gif' ? row.media_url : null) });

    row.media_url = picked.media_url;
    row.media_thumbnail_url = picked.media_thumbnail_url;
    row.media_type = picked.media_type;
    row.media_provider = picked.media_provider;
    row.media_confidence_score = picked.media_confidence_score;
    row.quality_flags = computeQualityFlags(row);

    if (picked.media_type === 'video' && picked.media_url) {
      result.ok += 1; result.newVideo += 1;
    } else {
      result.failed += 1; result.lowConfidence += 1;
      emit(mode, 'exercise_media_confidence_low', { key: row.normalized_lookup_key, score: row.media_confidence_score, reason: picked.reason });
      if (row.media_type === 'gif' && row.media_url) result.gifOnly += 1; else result.textOnly += 1;
    }
    await sleep(delayMs);
  }
  return result;
}

export async function syncExercisesWeekly(options: SyncOptions = {}): Promise<SyncSummary> {
  assertEnv();
  const mode = options.mode ?? 'sync';
  const useStateFile = options.useStateFile ?? false;
  const stateFilePath = options.stateFilePath ?? path.resolve(process.cwd(), '.cache/exercise-import-state.json');
  const importBatchSize = Number(options.importBatchSize ?? 120);
  const upsertBatchSize = Number(options.upsertBatchSize ?? 150);
  const mediaBatchSize = Number(options.mediaBatchSize ?? 80);
  const requestDelayMs = Number(options.requestDelayMs ?? 120);

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const state = useStateFile ? readState(stateFilePath) : { importOffset: 0, mediaOffset: 0, aliasCompleted: false, updatedAt: new Date(0).toISOString() };

  const summary: SyncSummary = {
    imported: 0, upserted: 0, failed: 0, mediaEnriched: 0, mediaFailed: 0, aliasesSeeded: 0,
    importOffset: state.importOffset, mediaOffset: state.mediaOffset,
    improved_completeness_count: 0, new_video_count: 0, gif_only_count: 0, text_only_count: 0,
    low_confidence_media_count: 0, aliases_seeded_count: 0,
  };

  emit(mode, 'started', { state_file: useStateFile ? stateFilePath : null });

  let offset = state.importOffset;
  while (true) {
    const batch = await fetchExerciseDbBatch(importBatchSize, offset).catch(() => [] as ExerciseDbItem[]);
    if (!batch.length) break;
    const rows = batch.map(toExercisePayload);
    summary.imported += rows.length;
    const upsert = await upsertExercises(supabase, rows, upsertBatchSize);
    summary.upserted += upsert.upserted; summary.failed += upsert.failed;
    offset += importBatchSize;
    if (useStateFile) writeState(stateFilePath, { importOffset: offset });
  }
  summary.importOffset = offset;

  if (options.enrichMedia ?? true) {
    let mediaOffset = state.mediaOffset;
    while (true) {
      const { data, error } = await supabase
        .from('exercises')
        .select('source_id,source,name,name_en,name_pt,slug,normalized_lookup_key,body_part,target_muscle,secondary_muscles,equipment,instructions,common_errors,breathing_tip,range_of_motion,media_url,media_thumbnail_url,media_type,media_provider,media_confidence_score,completeness_score,content_source,last_enriched_at,quality_flags,gif_url')
        .eq('is_active', true)
        .or('completeness_score.lt.72,media_type.neq.video,instructions.eq.[],media_confidence_score.lt.0.62,quality_flags.cs.{missing_instructions}')
        .order('completeness_score', { ascending: true })
        .order('media_confidence_score', { ascending: true })
        .range(mediaOffset, mediaOffset + mediaBatchSize - 1);
      if (error || !data?.length) break;

      const enrichedRows = (data as ExercisePayload[]).map((row) => {
        const enriched = applyCuratedExerciseContent(row);
        const completeness = computeExerciseCompletenessScore(enriched);
        const quality_flags = computeQualityFlags({ ...enriched, completeness_score: completeness });
        if (completeness < 60) emit(mode, 'exercise_catalog_low_completeness_detected', { key: row.normalized_lookup_key, completeness });
        return { ...enriched, completeness_score: completeness, quality_flags, content_source: enriched.content_source || 'curated_layer', last_enriched_at: new Date().toISOString() };
      });

      summary.improved_completeness_count += enrichedRows.filter((row, i) => Number(row.completeness_score || 0) > Number((data as any[])[i].completeness_score || 0)).length;
      if (summary.improved_completeness_count > 0) emit(mode, 'exercise_catalog_quality_enriched', { improved: summary.improved_completeness_count });

      const media = await enrichMedia(enrichedRows, mode, requestDelayMs);
      summary.mediaEnriched += media.ok; summary.mediaFailed += media.failed;
      summary.new_video_count += media.newVideo; summary.gif_only_count += media.gifOnly;
      summary.text_only_count += media.textOnly; summary.low_confidence_media_count += media.lowConfidence;

      const upsert = await upsertExercises(supabase, enrichedRows, upsertBatchSize);
      summary.upserted += upsert.upserted; summary.failed += upsert.failed;

      mediaOffset += data.length;
      if (useStateFile) writeState(stateFilePath, { mediaOffset });
    }
  }

  if ((options.seedAliases ?? true) && (!useStateFile || !state.aliasCompleted)) {
    summary.aliasesSeeded = await seedAliases(supabase);
    summary.aliases_seeded_count = summary.aliasesSeeded;
    if (useStateFile) writeState(stateFilePath, { aliasCompleted: true });
  }

  emit(mode, 'exercise_catalog_sync_summary_ready', summary as unknown as Record<string, unknown>);
  return summary;
}
