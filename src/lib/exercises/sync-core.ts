import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

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

  return {
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
    instructions: instructions.length ? instructions : ['Mantenha técnica controlada e ajuste a carga ao seu nível.'],
    common_errors: [],
    breathing_tip: null,
    range_of_motion: null,
    media_url: gif || null,
    media_thumbnail_url: gif || null,
    media_type: gif ? 'gif' : null,
    media_provider: gif ? 'ExerciseDB' : null,
    youtube_fallback_url: youtubeFallbackUrl(name),
    updated_at: now,
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
      for (const row of chunk) emit(mode, 'exercise_upsert_success', { key: row.normalized_lookup_key });
      if (mode === 'import') emit(mode, 'import_exercise_batch_completed', { batch_start: i, batch_size: chunk.length });
      continue;
    }

    if (mode === 'import') emit(mode, 'import_exercise_batch_failed', { batch_start: i, reason: error.message });
    if (mode === 'sync') emit(mode, 'batch_failed', { batch_start: i, reason: error.message });

    for (const row of chunk) {
      try {
        const { error: singleError } = await supabase.from('exercises').upsert(row, { onConflict: 'slug' });
        if (singleError) {
          failed += 1;
          emit(mode, 'exercise_upsert_failed', { key: row.normalized_lookup_key, reason: singleError.message });
        } else {
          upserted += 1;
          emit(mode, 'exercise_upsert_success', { key: row.normalized_lookup_key });
        }
      } catch (singleError) {
        failed += 1;
        emit(mode, 'exercise_upsert_failed', { key: row.normalized_lookup_key, reason: singleError instanceof Error ? singleError.message : String(singleError) });
      }
    }

    if (mode === 'import') emit(mode, 'import_exercise_batch_completed', { batch_start: i, batch_size: chunk.length, fallback_item_retry: true });
  }

  return { upserted, failed };
}

async function enrichWithPexels(rows: ExercisePayload[], mode: SyncMode, requestDelayMs: number): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;

  for (const row of rows) {
    if (row.media_type === 'video' && row.media_url) continue;
    emit(mode, mode === 'sync' ? 'media_enrich_started' : 'exercise_media_enrich_started', { key: row.normalized_lookup_key });
    try {
      const query = encodeURIComponent(`${row.name_en} exercise`);
      const url = `https://api.pexels.com/videos/search?query=${query}&per_page=8`;
      const response = await fetch(url, { headers: { Authorization: process.env.PEXELS_API_KEY! } });
      if (!response.ok) throw new Error(`Pexels HTTP ${response.status}`);
      const payload = await response.json().catch(() => ({}));
      const videos = Array.isArray(payload?.videos) ? payload.videos : [];
      const candidate = videos.find((video: any) => Array.isArray(video.video_files) && video.video_files.length > 0);

      if (!candidate) {
        failed += 1;
        emit(mode, mode === 'sync' ? 'media_enrich_failed' : 'exercise_media_enrich_failed', { key: row.normalized_lookup_key, reason: 'no_video_found' });
        await sleep(requestDelayMs);
        continue;
      }

      const preferred = candidate.video_files.find((file: any) => file.quality === 'sd') || candidate.video_files[0];
      if (!preferred?.link) {
        failed += 1;
        emit(mode, mode === 'sync' ? 'media_enrich_failed' : 'exercise_media_enrich_failed', { key: row.normalized_lookup_key, reason: 'invalid_video_file' });
        await sleep(requestDelayMs);
        continue;
      }

      row.media_url = String(preferred.link);
      row.media_thumbnail_url = typeof candidate.image === 'string' ? candidate.image : row.media_thumbnail_url;
      row.media_type = 'video';
      row.media_provider = 'Pexels';

      ok += 1;
      emit(mode, mode === 'sync' ? 'media_enrich_ok' : 'exercise_media_enrich_success', { key: row.normalized_lookup_key, provider: 'Pexels' });
    } catch (error) {
      failed += 1;
      emit(mode, mode === 'sync' ? 'media_enrich_failed' : 'exercise_media_enrich_failed', { key: row.normalized_lookup_key, reason: error instanceof Error ? error.message : String(error) });
    }

    await sleep(requestDelayMs);
  }

  return { ok, failed };
}

async function tableExists(supabase: any, tableName: string): Promise<boolean> {
  const { error } = await supabase.from(tableName).select('id').limit(1);
  return !error;
}

async function seedAliases(supabase: any): Promise<number> {
  const exists = await tableExists(supabase, 'exercise_aliases');
  if (!exists) return 0;

  const aliases = [
    ['supino_reto_barra', 'barbell_bench_press'],
    ['supino_inclinado_halteres', 'incline_dumbbell_press'],
    ['rosca_direta', 'barbell_curl'],
    ['puxada_frontal', 'lat_pulldown'],
    ['barra_fixa', 'pull_up'],
    ['levantamento_terra', 'deadlift'],
    ['agachamento', 'squat'],
    ['leg_press', 'leg_press'],
    ['desenvolvimento', 'shoulder_press'],
  ] as const;

  let seeded = 0;
  for (const [aliasKey, canonicalKey] of aliases) {
    const { data: exercise } = await supabase
      .from('exercises')
      .select('id, normalized_lookup_key')
      .eq('normalized_lookup_key', canonicalKey)
      .limit(1)
      .maybeSingle();

    if (!exercise?.id) continue;

    const payload = {
      exercise_id: exercise.id,
      alias: aliasKey,
      alias_key: aliasKey,
      canonical_lookup_key: canonicalKey,
      locale: 'pt_BR',
      language: 'pt',
      alias_type: 'synonym',
    };

    const { error } = await supabase.from('exercise_aliases').upsert(payload, { onConflict: 'alias_key' });
    if (!error) seeded += 1;
  }

  return seeded;
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
  };

  emit(mode, mode === 'sync' ? 'started' : 'sync_exercises_started', { state_file: useStateFile ? stateFilePath : null });

  let offset = state.importOffset;
  while (true) {
    let batch: ExerciseDbItem[] = [];
    try {
      batch = await fetchExerciseDbBatch(importBatchSize, offset);
    } catch (error) {
      summary.failed += importBatchSize;
      emit(mode, mode === 'sync' ? 'batch_failed' : 'import_exercise_batch_failed', { offset, reason: error instanceof Error ? error.message : String(error) });
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
      const { data, error } = await supabase
        .from('exercises')
        .select('source_id,source,name,name_en,name_pt,slug,normalized_lookup_key,body_part,target_muscle,secondary_muscles,equipment,instructions,common_errors,breathing_tip,range_of_motion,media_url,media_thumbnail_url,media_type,media_provider,youtube_fallback_url,updated_at')
        .order('updated_at', { ascending: true })
        .range(mediaOffset, mediaOffset + mediaBatchSize - 1);

      if (error) {
        summary.mediaFailed += mediaBatchSize;
        emit(mode, mode === 'sync' ? 'media_enrich_failed' : 'exercise_media_enrich_failed', { offset: mediaOffset, reason: error.message });
        mediaOffset += mediaBatchSize;
        if (useStateFile) writeState(stateFilePath, { mediaOffset });
        continue;
      }
      if (!data?.length) break;

      const rows = data as ExercisePayload[];
      const media = await enrichWithPexels(rows, mode, requestDelayMs);
      summary.mediaEnriched += media.ok;
      summary.mediaFailed += media.failed;

      const upsert = await upsertExercises(supabase, rows, mode, upsertBatchSize);
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

  emit(mode, mode === 'sync' ? 'completed' : 'sync_exercises_completed', summary as unknown as Record<string, unknown>);
  return summary;
}
