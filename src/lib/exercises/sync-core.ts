import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { applyCuratedExerciseContent, computeExerciseCompletenessScore, computeQualityFlags } from './catalog-curation';
import { CURATED_PT_ALIASES } from './aliases';
import { resolveLocalCatalogMedia } from './local-catalog';
import { pickBestExerciseMedia } from './media-ranking';
import { buildPexelsSearchQueries, sanitizeMediaUrl } from './media-utils';

export type SyncMode = 'import' | 'sync';
export type SyncOptions = {
  mode?: SyncMode;
  mediaOnly?: boolean;
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

const REQUIRED_ENVS = ['EXERCISEDB_API_KEY', 'PEXELS_API_KEY'] as const;
const exerciseColumnAvailability = new Map<string, boolean>();

function emit(mode: SyncMode, name: string, meta: Record<string, unknown> = {}) {
  logger.info(mode === 'sync' ? `sync_exercises_${name}` : name, meta);
}

function readSupabaseUrl(): string {
  return process.env.SUPABASE_URL
    ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    ?? process.env.VITE_SUPABASE_URL
    ?? '';
}

function readSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.SUPABASE_SERVICE_KEY
    ?? process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.VITE_SUPABASE_SERVICE_KEY
    ?? '';
}

function readExerciseDbBaseUrl(): string {
  return process.env.EXERCISEDB_BASE_URL || 'https://exercisedb.p.rapidapi.com';
}

function assertEnv(options: { mediaOnly?: boolean } = {}) {
  const missing: string[] = REQUIRED_ENVS
    .filter((key) => !(options.mediaOnly && key === 'EXERCISEDB_API_KEY'))
    .filter((key) => !process.env[key]);
  if (!readSupabaseUrl()) missing.push('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL');
  if (!readSupabaseServiceRoleKey()) missing.push('SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY');
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
  const resolvedBaseUrl = readExerciseDbBaseUrl();
  const url = `${resolvedBaseUrl.replace(/\/$/, '')}/exercises?limit=${limit}&offset=${offset}`;
  const response = await fetch(url, { headers: { 'X-RapidAPI-Key': process.env.EXERCISEDB_API_KEY!, 'X-RapidAPI-Host': new URL(resolvedBaseUrl).host } });
  if (!response.ok) throw new Error(`ExerciseDB HTTP ${response.status}`);
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
}

async function searchExerciseDbByName(name: string): Promise<ExerciseDbItem[]> {
  const resolvedBaseUrl = readExerciseDbBaseUrl();
  const url = `${resolvedBaseUrl.replace(/\/$/, '')}/exercises/name/${encodeURIComponent(name)}`;
  const response = await fetch(url, { headers: { 'X-RapidAPI-Key': process.env.EXERCISEDB_API_KEY!, 'X-RapidAPI-Host': new URL(resolvedBaseUrl).host } }).catch(() => null as any);
  if (!response?.ok) return [];
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
}

function toExercisePayload(item: ExerciseDbItem): ExercisePayload {
  const name = String(item.name || 'exercise').trim();
  const gifUrl = sanitizeMediaUrl(item.gifUrl || null);
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
    gif_url: gifUrl,
    media_url: null,
    media_thumbnail_url: gifUrl,
    media_type: gifUrl ? 'gif' : null,
    media_provider: gifUrl ? 'ExerciseDB' : null,
    media_confidence_score: gifUrl ? 0.45 : 0.2,
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
    const chunk = await Promise.all(rows.slice(i, i + batchSize).map((row) => filterExercisePayloadForSchema(supabase, row)));
    const { error } = await supabase.from('exercises').upsert(chunk, { onConflict: 'slug' });
    if (!error) { upserted += chunk.length; continue; }
    for (const row of chunk) {
      const { error: singleError } = await supabase.from('exercises').upsert(row, { onConflict: 'slug' });
      if (singleError) failed += 1; else upserted += 1;
    }
  }
  return { upserted, failed };
}

async function canUseExerciseColumn(supabase: any, column: string) {
  if (exerciseColumnAvailability.has(column)) return exerciseColumnAvailability.get(column);
  const { error } = await supabase.from('exercises').select(column).limit(0);
  const available = !(error && typeof error.message === 'string' && error.message.includes(column) && /does not exist|schema cache|column/i.test(error.message));
  exerciseColumnAvailability.set(column, available);
  return available;
}

async function filterExercisePayloadForSchema(supabase: any, row: ExercisePayload) {
  const allowedEntries = await Promise.all(Object.entries(row).map(async ([key, value]) => {
    if (await canUseExerciseColumn(supabase, key)) return [key, value];
    return null;
  }));
  return Object.fromEntries(allowedEntries.filter(Boolean) as Array<[string, unknown]>);
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

async function enrichMedia(supabase: any, rows: ExercisePayload[], mode: SyncMode, delayMs: number) {
  const result = { ok: 0, failed: 0, newVideo: 0, gifOnly: 0, textOnly: 0, lowConfidence: 0 };
  for (const row of rows) {
    if (!sanitizeMediaUrl(row.gif_url)) {
      const localMatch = resolveLocalCatalogMedia({
        name: row.name_en || row.name_pt || row.name,
        slug: row.slug,
        normalizedLookupKey: row.normalized_lookup_key,
        targetMuscle: row.target_muscle,
        equipment: row.equipment,
        searchTerms: Array.isArray(row.search_terms) ? row.search_terms : [],
      });
      if (localMatch?.gifUrl) {
        row.gif_url = localMatch.gifUrl;
        row.media_type = row.media_url ? row.media_type : 'gif';
        row.media_provider = row.media_url ? row.media_provider : 'catalog';
        row.media_thumbnail_url = row.media_thumbnail_url || localMatch.gifUrl;
        row.media_confidence_score = Number(Math.max(Number(row.media_confidence_score || 0), 0.62).toFixed(4));
        row.content_source = row.content_source || 'catalog_seeded';
        emit(mode, 'exercise_gif_refreshed_from_local_catalog', {
          key: row.normalized_lookup_key || row.slug,
          matchedBy: localMatch.matchedBy,
          score: localMatch.score,
          sourceId: localMatch.sourceId,
        });
      }
    }

    if (!sanitizeMediaUrl(row.gif_url) && process.env.EXERCISEDB_API_KEY) {
      const matches = await searchExerciseDbByName(String(row.name_en || row.name_pt || row.slug || '')).catch(() => [] as ExerciseDbItem[]);
      const byName = matches.find((item) => normalizeLookupKey(String(item.name || '')) === normalizeLookupKey(String(row.name_en || row.name_pt || row.slug || '')));
      const gifUrl = sanitizeMediaUrl(byName?.gifUrl || null);
      if (gifUrl) {
        row.gif_url = gifUrl;
        row.media_type = row.media_url ? row.media_type : 'gif';
        row.media_provider = row.media_url ? row.media_provider : 'ExerciseDB';
        row.media_thumbnail_url = row.media_thumbnail_url || gifUrl;
        emit(mode, 'exercise_gif_refreshed_from_exercisedb', { key: row.normalized_lookup_key || row.slug, sourceId: byName?.id || null });
      }
    }
    if (row.media_type === 'video' && row.media_confidence_score >= 0.75) continue;
    let promoted = false;
    for (const query of buildPexelsSearchQueries(row as any, { mentionedExercise: row.name_en, targetMuscle: row.target_muscle, equipment: row.equipment } as any)) {
      const response = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=10`, { headers: { Authorization: process.env.PEXELS_API_KEY! } }).catch(() => null as any);
      const payload = response?.ok ? await response.json().catch(() => ({})) : {};
      const videos = Array.isArray(payload?.videos) ? payload.videos : [];
      const picked = pickBestExerciseMedia(row, videos, { media_url: row.media_url, media_type: row.media_type, media_confidence_score: row.media_confidence_score, gif_url: row.gif_url || (row.media_type === 'gif' ? row.media_url : null) }, query);

      if (picked.media_type === 'video' && picked.media_url) {
        row.media_url = picked.media_url;
        row.media_thumbnail_url = picked.media_thumbnail_url;
        row.media_type = picked.media_type;
        row.media_provider = picked.media_provider;
        row.media_confidence_score = picked.media_confidence_score;
        row.last_enriched_at = new Date().toISOString();
        row.content_source = 'pexels_enriched';
        row.quality_flags = computeQualityFlags(row);
        if (row.id) {
          await supabase.from('exercise_media_cache').upsert({
            exercise_id: row.id,
            provider: 'pexels',
            provider_media_id: picked.provider_media_id ?? null,
            media_type: 'video',
            video_url: picked.media_url,
            thumbnail_url: picked.media_thumbnail_url ?? null,
            width: picked.width ?? null,
            height: picked.height ?? null,
            duration: picked.duration ?? null,
            search_query: query,
            verified_score: picked.media_confidence_score,
            approved: picked.media_confidence_score >= 0.79,
            metadata: { query, reason: picked.reason, mode },
          }, { onConflict: 'provider,provider_media_id' });
        }
        result.ok += 1; result.newVideo += 1;
        promoted = true;
        emit(mode, 'exercise_catalog_media_enriched', { key: row.normalized_lookup_key, query, score: picked.media_confidence_score });
        break;
      }

      emit(mode, 'exercise_media_confidence_low', { key: row.normalized_lookup_key, query, score: picked.media_confidence_score, reason: picked.reason });
    }

    if (!promoted) {
      row.quality_flags = computeQualityFlags(row);
      result.failed += 1; result.lowConfidence += 1;
      if (row.gif_url) result.gifOnly += 1; else result.textOnly += 1;
      if (!row.gif_url && !row.media_url) {
        emit(mode, 'exercise_media_missing', { key: row.normalized_lookup_key, provider: 'none' });
      } else {
        emit(mode, 'exercise_media_fallback', { key: row.normalized_lookup_key, provider: row.gif_url ? 'ExerciseDB' : row.media_provider || 'catalog' });
      }
    }
    await sleep(delayMs);
  }
  return result;
}

export async function syncExercisesWeekly(options: SyncOptions = {}): Promise<SyncSummary> {
  assertEnv({ mediaOnly: options.mediaOnly === true });
  const mode = options.mode ?? 'sync';
  const useStateFile = options.useStateFile ?? false;
  const mediaOnly = options.mediaOnly === true;
  const stateFilePath = options.stateFilePath ?? path.resolve(process.cwd(), '.cache/exercise-import-state.json');
  const importBatchSize = Number(options.importBatchSize ?? 120);
  const upsertBatchSize = Number(options.upsertBatchSize ?? 150);
  const mediaBatchSize = Number(options.mediaBatchSize ?? 80);
  const requestDelayMs = Number(options.requestDelayMs ?? 120);

  const supabase = createClient(readSupabaseUrl(), readSupabaseServiceRoleKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const state = useStateFile ? readState(stateFilePath) : { importOffset: 0, mediaOffset: 0, aliasCompleted: false, updatedAt: new Date(0).toISOString() };

  const summary: SyncSummary = {
    imported: 0, upserted: 0, failed: 0, mediaEnriched: 0, mediaFailed: 0, aliasesSeeded: 0,
    importOffset: state.importOffset, mediaOffset: state.mediaOffset,
    improved_completeness_count: 0, new_video_count: 0, gif_only_count: 0, text_only_count: 0,
    low_confidence_media_count: 0, aliases_seeded_count: 0,
  };

  emit(mode, 'started', { state_file: useStateFile ? stateFilePath : null });

  let offset = state.importOffset;
  if (!mediaOnly && importBatchSize > 0) {
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
  }
  summary.importOffset = offset;

  if (options.enrichMedia ?? true) {
    let mediaOffset = state.mediaOffset;
    while (true) {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: true })
        .range(mediaOffset, mediaOffset + mediaBatchSize - 1);
      if (error || !data?.length) break;

      const candidates = (data as ExercisePayload[]).map((row) => {
        const normalized = {
          ...row,
          gif_url: sanitizeMediaUrl(row.gif_url || row.media_url || null),
          media_url: sanitizeMediaUrl(row.media_type === 'video' ? row.media_url : null),
          media_thumbnail_url: sanitizeMediaUrl((row as any).media_thumbnail_url || row.thumbnail_url || row.image_url || row.gif_url || null),
          media_type: row.media_type || (sanitizeMediaUrl(row.gif_url || null) ? 'gif' : null),
          media_provider: row.media_provider || (sanitizeMediaUrl(row.gif_url || null) ? 'ExerciseDB' : null),
          media_confidence_score: Number((row as any).media_confidence_score ?? (row.media_type === 'video' ? 0.8 : sanitizeMediaUrl(row.gif_url || null) ? 0.45 : 0.15)),
          quality_flags: Array.isArray(row.quality_flags) ? row.quality_flags : [],
        };
        const enriched = applyCuratedExerciseContent(normalized);
        const completeness = computeExerciseCompletenessScore(enriched);
        const quality_flags = computeQualityFlags({ ...enriched, completeness_score: completeness });
        if (completeness < 60) emit(mode, 'exercise_catalog_low_completeness_detected', { key: row.normalized_lookup_key, completeness });
        return { ...enriched, completeness_score: completeness, quality_flags, content_source: enriched.content_source || 'curated_layer', last_enriched_at: new Date().toISOString() };
      });

      const enrichedRows = candidates.filter((row) => {
        const hasInvalidGif = !!row.gif_url && !sanitizeMediaUrl(row.gif_url);
        const missingVideo = !sanitizeMediaUrl(row.media_url);
        const missingGif = !sanitizeMediaUrl(row.gif_url);
        return hasInvalidGif || missingVideo || missingGif || Number(row.completeness_score || 0) < 78 || Number(row.media_confidence_score || 0) < 0.65 || computeQualityFlags(row).includes('invalid_media_placeholder');
      });

      if (!enrichedRows.length) {
        mediaOffset += mediaBatchSize;
        if (useStateFile) writeState(stateFilePath, { mediaOffset });
        continue;
      }

      summary.improved_completeness_count += enrichedRows.filter((row, i) => Number(row.completeness_score || 0) > Number((data as any[])[i].completeness_score || 0)).length;
      if (summary.improved_completeness_count > 0) emit(mode, 'exercise_catalog_quality_enriched', { improved: summary.improved_completeness_count });

      const media = await enrichMedia(supabase, enrichedRows, mode, requestDelayMs);
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
