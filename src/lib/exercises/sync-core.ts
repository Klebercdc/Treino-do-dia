import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { computeExerciseCompletenessScore, getCuratedExerciseContent, mergeCuratedExerciseContent } from './catalog-curation';
import { CURATED_PT_ALIASES } from './aliases';
import { selectBestVideo } from './media-ranking';

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

type ExerciseDbItem = {
  id: string;
  name: string;
  bodyPart?: string;
  target?: string;
  secondaryMuscles?: string[];
  equipment?: string;
  instructions?: string[];
  gifUrl?: string;
};

type ExercisePayload = Record<string, unknown> & {
  source_id: string;
  source: string;
  name: string;
  name_en: string;
  name_pt: string;
  slug: string;
  normalized_lookup_key: string;
  media_url: string | null;
  media_thumbnail_url: string | null;
  media_type: 'video' | 'gif' | null;
  media_provider: 'Pexels' | 'ExerciseDB' | null;
  media_confidence_score: number;
  completeness_score: number;
};

type SyncState = {
  importOffset: number;
  mediaOffset: number;
  aliasCompleted: boolean;
  updatedAt: string;
};

export type SyncSummary = {
  imported: number;
  upserted: number;
  failed: number;
  mediaEnriched: number;
  mediaFailed: number;
  aliasesSeeded: number;
  importOffset: number;
  mediaOffset: number;
  completenessImproved: number;
  gainedVideo: number;
  remainedGifOnly: number;
  noMedia: number;
};

const REQUIRED_ENVS = ['EXERCISEDB_BASE_URL', 'EXERCISEDB_API_KEY', 'PEXELS_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

function eventName(mode: SyncMode, name: string): string {
  return mode === 'sync' ? `sync_exercises_${name}` : name;
}

function emit(mode: SyncMode, name: string, meta: Record<string, unknown> = {}) {
  logger.info(eventName(mode, name), meta);
}

function assertEnv() {
  const missing = REQUIRED_ENVS.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing required env(s): ${missing.join(', ')}`);
}

function normalizeLookupKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 240);
}

function toSlug(value: string): string {
  return normalizeLookupKey(value).replace(/_/g, '-').slice(0, 240) || `exercise-${Date.now()}`;
}

function youtubeFallbackUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to ${name} proper form`)}`;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v || '').trim()).filter(Boolean) : [];
}

function readState(stateFilePath: string): SyncState {
  try {
    const raw = fs.readFileSync(stateFilePath, 'utf8');
    const data = JSON.parse(raw);
    return {
      importOffset: Number(data.importOffset || 0),
      mediaOffset: Number(data.mediaOffset || 0),
      aliasCompleted: Boolean(data.aliasCompleted),
      updatedAt: String(data.updatedAt || new Date(0).toISOString()),
    };
  } catch {
    return { importOffset: 0, mediaOffset: 0, aliasCompleted: false, updatedAt: new Date(0).toISOString() };
  }
}

function writeState(stateFilePath: string, partial: Partial<SyncState>) {
  fs.mkdirSync(path.dirname(stateFilePath), { recursive: true });
  const current = readState(stateFilePath);
  const next: SyncState = { ...current, ...partial, updatedAt: new Date().toISOString() };
  fs.writeFileSync(stateFilePath, JSON.stringify(next, null, 2));
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchExerciseDbBatch(limit: number, offset: number): Promise<ExerciseDbItem[]> {
  const baseUrl = process.env.EXERCISEDB_BASE_URL!;
  const url = `${baseUrl.replace(/\/$/, '')}/exercises?limit=${limit}&offset=${offset}`;
  const host = new URL(baseUrl).host;
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': process.env.EXERCISEDB_API_KEY!,
      'X-RapidAPI-Host': host,
    },
  });
  if (!response.ok) throw new Error(`ExerciseDB HTTP ${response.status}`);
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
}

function toExercisePayload(item: ExerciseDbItem): ExercisePayload {
  const name = String(item.name || '').trim() || 'exercise';
  const normalized = normalizeLookupKey(name);
  const gif = typeof item.gifUrl === 'string' ? item.gifUrl.trim() : '';
  const instructions = toStringArray(item.instructions);
  const now = new Date().toISOString();

  const base = {
    source_id: String(item.id || normalized),
    source: 'ExerciseDB',
    name,
    name_en: name,
    name_pt: name,
    slug: toSlug(name),
    normalized_lookup_key: normalized || toSlug(name).replace(/-/g, '_'),
    body_part: item.bodyPart ? String(item.bodyPart).toLowerCase() : null,
    target_muscle: item.target ? String(item.target).toLowerCase() : null,
    secondary_muscles: toStringArray(item.secondaryMuscles).map((x) => x.toLowerCase()),
    equipment: item.equipment ? String(item.equipment).toLowerCase() : null,
    instructions: instructions.length ? instructions : [],
    common_errors: [],
    breathing_tip: null,
    range_of_motion: null,
    media_url: gif || null,
    media_thumbnail_url: gif || null,
    media_type: gif ? 'gif' : null,
    media_provider: gif ? 'ExerciseDB' : null,
    media_confidence_score: gif ? 0.42 : 0.1,
    youtube_fallback_url: youtubeFallbackUrl(name),
    updated_at: now,
  } as any;

  const merged = mergeCuratedExerciseContent(base, getCuratedExerciseContent(base.normalized_lookup_key));
  return {
    ...(merged as ExercisePayload),
    completeness_score: computeExerciseCompletenessScore(merged as any),
  };
}

async function upsertExercises(supabase: any, rows: ExercisePayload[], mode: SyncMode, upsertBatchSize: number): Promise<{ upserted: number; failed: number }> {
  let upserted = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += upsertBatchSize) {
    const chunk = rows.slice(i, i + upsertBatchSize);
    emit(mode, mode === 'sync' ? 'batch_ok' : 'import_exercise_batch_started', { batch_start: i, batch_size: chunk.length });

    const { error } = await supabase.from('exercises').upsert(chunk, { onConflict: 'slug' });
    if (!error) {
      upserted += chunk.length;
      continue;
    }

    for (const row of chunk) {
      try {
        const { error: singleError } = await supabase.from('exercises').upsert(row, { onConflict: 'slug' });
        if (singleError) {
          failed += 1;
        } else {
          upserted += 1;
        }
      } catch {
        failed += 1;
      }
    }
  }

  return { upserted, failed };
}

async function enrichWithPexels(rows: ExercisePayload[], mode: SyncMode, requestDelayMs: number): Promise<{ ok: number; failed: number; gainedVideo: number; remainedGifOnly: number; noMedia: number }> {
  let ok = 0;
  let failed = 0;
  let gainedVideo = 0;
  let remainedGifOnly = 0;
  let noMedia = 0;

  for (const row of rows) {
    const hadVideo = row.media_type === 'video' && !!row.media_url;
    const hadGif = row.media_type === 'gif' && !!row.media_url;
    if (hadVideo) continue;

    try {
      const query = encodeURIComponent(`${row.name_en} exercise proper form`);
      const url = `https://api.pexels.com/videos/search?query=${query}&per_page=10`;
      const response = await fetch(url, { headers: { Authorization: process.env.PEXELS_API_KEY! } });
      if (!response.ok) throw new Error(`Pexels HTTP ${response.status}`);
      const payload = await response.json().catch(() => ({}));
      const videos = Array.isArray(payload?.videos) ? payload.videos : [];

      const selection = selectBestVideo(videos, {
        exerciseName: row.name_en,
        query: `${row.name_en} ${String(row.target_muscle || '')}`,
        targetMuscle: String(row.target_muscle || ''),
        equipment: String(row.equipment || ''),
      });

      if (!selection.accepted || !selection.best) {
        row.media_confidence_score = Number(Math.min(row.media_confidence_score || 0.42, selection.confidence || 0.4).toFixed(4));
        failed += 1;
        emit(mode, 'exercise_media_confidence_low', { key: row.normalized_lookup_key, score: row.media_confidence_score });
        if (hadGif || row.media_type === 'gif') remainedGifOnly += 1;
        else if (!row.media_url) noMedia += 1;
        await sleep(requestDelayMs);
        continue;
      }

      const preferred = selection.best.video.video_files.find((file: any) => file.quality === 'sd') || selection.best.video.video_files[0];
      if (!preferred?.link) {
        failed += 1;
        if (hadGif || row.media_type === 'gif') remainedGifOnly += 1;
        else if (!row.media_url) noMedia += 1;
        await sleep(requestDelayMs);
        continue;
      }

      row.media_url = String(preferred.link);
      row.media_thumbnail_url = typeof selection.best.video.image === 'string' ? selection.best.video.image : row.media_thumbnail_url;
      row.media_type = 'video';
      row.media_provider = 'Pexels';
      row.media_confidence_score = selection.best.score;
      ok += 1;
      if (!hadVideo) gainedVideo += 1;
    } catch (error) {
      failed += 1;
      emit(mode, mode === 'sync' ? 'media_enrich_failed' : 'exercise_media_enrich_failed', { key: row.normalized_lookup_key, reason: error instanceof Error ? error.message : String(error) });
      if (hadGif || row.media_type === 'gif') remainedGifOnly += 1;
      else if (!row.media_url) noMedia += 1;
    }

    await sleep(requestDelayMs);
  }

  return { ok, failed, gainedVideo, remainedGifOnly, noMedia };
}

async function tableExists(supabase: any, tableName: string): Promise<boolean> {
  const { error } = await supabase.from(tableName).select('id').limit(1);
  return !error;
}

async function seedAliases(supabase: any): Promise<number> {
  const exists = await tableExists(supabase, 'exercise_aliases');
  if (!exists) return 0;

  let seeded = 0;
  for (const alias of CURATED_PT_ALIASES) {
    const { data: exercise } = await supabase
      .from('exercises')
      .select('id, normalized_lookup_key')
      .eq('normalized_lookup_key', alias.canonical_lookup_key)
      .limit(1)
      .maybeSingle();

    if (!exercise?.id) continue;

    const payload = {
      exercise_id: exercise.id,
      alias: alias.alias,
      alias_key: alias.alias_key,
      canonical_lookup_key: alias.canonical_lookup_key,
      locale: alias.locale,
      language: alias.language,
      alias_type: alias.alias_type,
    };

    const { error } = await supabase.from('exercise_aliases').upsert(payload, { onConflict: 'alias_key' });
    if (!error) seeded += 1;
  }

  return seeded;
}

async function loadPrioritizedRows(supabase: any, offset: number, mediaBatchSize: number) {
  const { data, error } = await supabase
    .from('exercises')
    .select('source_id,source,name,name_en,name_pt,slug,normalized_lookup_key,body_part,target_muscle,secondary_muscles,equipment,instructions,common_errors,breathing_tip,range_of_motion,media_url,media_thumbnail_url,media_type,media_provider,media_confidence_score,completeness_score,youtube_fallback_url,updated_at')
    .eq('is_active', true)
    .or('completeness_score.lt.0.7,media_type.neq.video,media_confidence_score.lt.0.6')
    .order('completeness_score', { ascending: true })
    .order('media_confidence_score', { ascending: true })
    .range(offset, offset + mediaBatchSize - 1);

  return { data: (data ?? []) as ExercisePayload[], error };
}

export async function syncExercisesWeekly(options: SyncOptions = {}): Promise<SyncSummary> {
  assertEnv();

  const mode = options.mode ?? 'sync';
  const useStateFile = options.useStateFile ?? false;
  const stateFilePath = options.stateFilePath ?? path.resolve(process.cwd(), '.cache/exercise-import-state.json');
  const seedAliasEnabled = options.seedAliases ?? true;
  const enrichMediaEnabled = options.enrichMedia ?? true;
  const importBatchSize = Number(options.importBatchSize ?? process.env.EXERCISE_IMPORT_BATCH_SIZE ?? 120);
  const upsertBatchSize = Number(options.upsertBatchSize ?? process.env.EXERCISE_UPSERT_BATCH_SIZE ?? 150);
  const mediaBatchSize = Number(options.mediaBatchSize ?? process.env.EXERCISE_MEDIA_BATCH_SIZE ?? 80);
  const requestDelayMs = Number(options.requestDelayMs ?? process.env.EXERCISE_REQUEST_DELAY_MS ?? 120);

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

  const state = useStateFile ? readState(stateFilePath) : { importOffset: 0, mediaOffset: 0, aliasCompleted: false, updatedAt: new Date(0).toISOString() };
  const summary: SyncSummary = {
    imported: 0,
    upserted: 0,
    failed: 0,
    mediaEnriched: 0,
    mediaFailed: 0,
    aliasesSeeded: 0,
    importOffset: state.importOffset,
    mediaOffset: state.mediaOffset,
    completenessImproved: 0,
    gainedVideo: 0,
    remainedGifOnly: 0,
    noMedia: 0,
  };

  emit(mode, mode === 'sync' ? 'started' : 'sync_exercises_started', { state_file: useStateFile ? stateFilePath : null });

  let offset = state.importOffset;
  while (true) {
    let batch: ExerciseDbItem[] = [];
    try {
      batch = await fetchExerciseDbBatch(importBatchSize, offset);
    } catch {
      summary.failed += importBatchSize;
      offset += importBatchSize;
      if (useStateFile) writeState(stateFilePath, { importOffset: offset });
      continue;
    }

    if (!batch.length) break;

    const mapped = batch.map(toExercisePayload);
    summary.imported += mapped.length;

    const upsert = await upsertExercises(supabase, mapped, mode, upsertBatchSize);
    summary.upserted += upsert.upserted;
    summary.failed += upsert.failed;

    offset += importBatchSize;
    if (useStateFile) writeState(stateFilePath, { importOffset: offset });
    await sleep(requestDelayMs);
  }

  summary.importOffset = offset;

  if (enrichMediaEnabled) {
    let mediaOffset = state.mediaOffset;
    while (true) {
      const { data, error } = await loadPrioritizedRows(supabase, mediaOffset, mediaBatchSize);

      if (error) {
        summary.mediaFailed += mediaBatchSize;
        mediaOffset += mediaBatchSize;
        if (useStateFile) writeState(stateFilePath, { mediaOffset });
        continue;
      }
      if (!data.length) break;

      const beforeCompleteness = data.reduce((acc, row) => acc + Number(row.completeness_score || 0), 0);
      const qualityEnrichedRows = data.map((row) => {
        const merged = mergeCuratedExerciseContent(row as any, getCuratedExerciseContent(row.normalized_lookup_key));
        const score = computeExerciseCompletenessScore(merged as any);
        return { ...(merged as ExercisePayload), completeness_score: score };
      });
      const afterCompleteness = qualityEnrichedRows.reduce((acc, row) => acc + Number(row.completeness_score || 0), 0);
      if (afterCompleteness > beforeCompleteness) {
        summary.completenessImproved += qualityEnrichedRows.filter((r, i) => Number(r.completeness_score || 0) > Number(data[i].completeness_score || 0)).length;
        emit(mode, 'exercise_catalog_quality_enriched', { improved: summary.completenessImproved });
      }

      const media = await enrichWithPexels(qualityEnrichedRows, mode, requestDelayMs);
      summary.mediaEnriched += media.ok;
      summary.mediaFailed += media.failed;
      summary.gainedVideo += media.gainedVideo;
      summary.remainedGifOnly += media.remainedGifOnly;
      summary.noMedia += media.noMedia;

      const upsert = await upsertExercises(supabase, qualityEnrichedRows, mode, upsertBatchSize);
      summary.upserted += upsert.upserted;
      summary.failed += upsert.failed;

      mediaOffset += data.length;
      if (useStateFile) writeState(stateFilePath, { mediaOffset });
    }
    summary.mediaOffset = mediaOffset;
  }

  if (seedAliasEnabled && (!useStateFile || !state.aliasCompleted)) {
    summary.aliasesSeeded = await seedAliases(supabase);
    if (useStateFile) writeState(stateFilePath, { aliasCompleted: true });
  }

  emit(mode, 'exercise_catalog_resync_triggered', { mode });
  emit(mode, mode === 'sync' ? 'completed' : 'sync_exercises_completed', summary as unknown as Record<string, unknown>);
  return summary;
}
