import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@supabase/supabase-js';

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

type ExerciseRow = {
  source_id: string;
  source: string;
  name: string;
  name_en: string;
  name_pt: string;
  slug: string;
  normalized_lookup_key: string;
  body_part: string | null;
  target_muscle: string | null;
  secondary_muscles: string[];
  equipment: string | null;
  instructions: string[];
  common_errors: string[];
  breathing_tip: string | null;
  range_of_motion: string | null;
  media_url: string | null;
  media_thumbnail_url: string | null;
  media_type: 'video' | 'gif' | null;
  media_provider: 'Pexels' | 'ExerciseDB' | null;
  youtube_fallback_url: string;
  updated_at: string;
};

type State = {
  importOffset: number;
  mediaOffset: number;
  aliasCompleted: boolean;
  updatedAt: string;
};

const IMPORT_BATCH_SIZE = Number(process.env.EXERCISE_IMPORT_BATCH_SIZE || 120);
const UPSERT_BATCH_SIZE = Number(process.env.EXERCISE_UPSERT_BATCH_SIZE || 150);
const MEDIA_BATCH_SIZE = Number(process.env.EXERCISE_MEDIA_BATCH_SIZE || 80);
const REQUEST_DELAY_MS = Number(process.env.EXERCISE_REQUEST_DELAY_MS || 120);

const STATE_DIR = path.resolve(process.cwd(), '.cache');
const STATE_FILE = path.join(STATE_DIR, 'exercise-import-state.json');

const REQUIRED_ENVS = [
  'EXERCISEDB_BASE_URL',
  'EXERCISEDB_API_KEY',
  'PEXELS_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

function log(event: string, payload: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...payload }));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v || '').trim()).filter(Boolean) : [];
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

function youtubeFallbackUrl(name: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to ${name} proper form`)}`;
}

function resolveExerciseDbHeaders(baseUrl: string, apiKey: string) {
  const host = new URL(baseUrl).host;
  return {
    'X-RapidAPI-Key': apiKey,
    'X-RapidAPI-Host': host,
  };
}

function readState(): State {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      importOffset: Number(parsed.importOffset || 0),
      mediaOffset: Number(parsed.mediaOffset || 0),
      aliasCompleted: Boolean(parsed.aliasCompleted),
      updatedAt: String(parsed.updatedAt || new Date(0).toISOString()),
    };
  } catch {
    return { importOffset: 0, mediaOffset: 0, aliasCompleted: false, updatedAt: new Date(0).toISOString() };
  }
}

function writeState(next: Partial<State>) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const current = readState();
  const merged: State = {
    ...current,
    ...next,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(merged, null, 2));
}

async function fetchExerciseDbBatch(baseUrl: string, apiKey: string, limit: number, offset: number): Promise<ExerciseDbItem[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/exercises?limit=${limit}&offset=${offset}`;
  const response = await fetch(url, { headers: resolveExerciseDbHeaders(baseUrl, apiKey) });
  if (!response.ok) {
    throw new Error(`ExerciseDB HTTP ${response.status}`);
  }
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
}

function mapExercise(item: ExerciseDbItem): ExerciseRow {
  const nameEn = String(item.name || '').trim() || 'exercise';
  const normalized = normalizeLookupKey(nameEn);
  const instructions = toArray(item.instructions);
  const gifUrl = typeof item.gifUrl === 'string' ? item.gifUrl.trim() : '';

  return {
    source_id: String(item.id || normalized),
    source: 'ExerciseDB',
    name: nameEn,
    name_en: nameEn,
    name_pt: nameEn,
    slug: toSlug(nameEn),
    normalized_lookup_key: normalized || toSlug(nameEn).replace(/-/g, '_'),
    body_part: item.bodyPart ? String(item.bodyPart).toLowerCase() : null,
    target_muscle: item.target ? String(item.target).toLowerCase() : null,
    secondary_muscles: toArray(item.secondaryMuscles).map((s) => s.toLowerCase()),
    equipment: item.equipment ? String(item.equipment).toLowerCase() : null,
    instructions: instructions.length ? instructions : ['Execução guiada indisponível no catálogo de origem.'],
    common_errors: [],
    breathing_tip: null,
    range_of_motion: null,
    media_url: gifUrl || null,
    media_thumbnail_url: gifUrl || null,
    media_type: gifUrl ? 'gif' : null,
    media_provider: gifUrl ? 'ExerciseDB' : null,
    youtube_fallback_url: youtubeFallbackUrl(nameEn),
    updated_at: new Date().toISOString(),
  };
}

async function enrichMediaWithPexels(rows: ExerciseRow[], pexelsApiKey: string) {
  for (const row of rows) {
    if (row.media_type === 'video' && row.media_url) continue;
    log('exercise_media_enrich_started', { normalized_lookup_key: row.normalized_lookup_key, name_en: row.name_en });
    try {
      const query = encodeURIComponent(`${row.name_en} exercise`);
      const url = `https://api.pexels.com/videos/search?query=${query}&per_page=6`;
      const response = await fetch(url, { headers: { Authorization: pexelsApiKey } });
      if (!response.ok) throw new Error(`Pexels HTTP ${response.status}`);
      const payload = await response.json().catch(() => ({}));
      const videos = Array.isArray(payload?.videos) ? payload.videos : [];
      const best = videos.find((video: any) => Array.isArray(video.video_files) && video.video_files.length > 0);

      if (best) {
        const videoFile = best.video_files.find((f: any) => f.quality === 'sd') || best.video_files[0];
        if (videoFile?.link) {
          row.media_url = String(videoFile.link);
          row.media_thumbnail_url = typeof best.image === 'string' ? best.image : row.media_thumbnail_url;
          row.media_type = 'video';
          row.media_provider = 'Pexels';
          log('exercise_media_enrich_success', { normalized_lookup_key: row.normalized_lookup_key, provider: 'Pexels' });
          await sleep(REQUEST_DELAY_MS);
          continue;
        }
      }

      log('exercise_media_enrich_failed', {
        normalized_lookup_key: row.normalized_lookup_key,
        reason: row.media_url ? 'pexels_not_found_kept_exercisedb_media' : 'pexels_not_found',
      });
    } catch (error) {
      log('exercise_media_enrich_failed', {
        normalized_lookup_key: row.normalized_lookup_key,
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    await sleep(REQUEST_DELAY_MS);
  }
}

async function upsertRows(supabase: any, rows: ExerciseRow[]) {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_BATCH_SIZE);
    log('import_exercise_batch_started', { batchSize: chunk.length, batchStart: i });

    const { error } = await supabase
      .from('exercises')
      .upsert(chunk as any[], { onConflict: 'slug' });

    if (error) {
      log('exercise_upsert_failed', { batchStart: i, error: error.message });
      for (const row of chunk) {
        try {
          const { error: singleError } = await supabase.from('exercises').upsert(row as any, { onConflict: 'slug' });
          if (singleError) {
            log('exercise_upsert_failed', { normalized_lookup_key: row.normalized_lookup_key, error: singleError.message });
          } else {
            log('exercise_upsert_success', { normalized_lookup_key: row.normalized_lookup_key });
          }
        } catch (singleCatch) {
          log('exercise_upsert_failed', { normalized_lookup_key: row.normalized_lookup_key, error: String(singleCatch) });
        }
      }
    } else {
      for (const row of chunk) {
        log('exercise_upsert_success', { normalized_lookup_key: row.normalized_lookup_key });
      }
    }

    log('import_exercise_batch_completed', { batchSize: chunk.length, batchStart: i });
  }
}

async function tableExists(supabase: any, table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select('id').limit(1);
  return !error;
}

async function seedAliasesIfAvailable(supabase: any) {
  const exists = await tableExists(supabase, 'exercise_aliases');
  if (!exists) {
    log('exercise_aliases_skipped', { reason: 'table_not_found' });
    return;
  }

  const aliasPairs = [
    { alias: 'supino_reto_barra', match: 'barbell bench press' },
    { alias: 'supino_inclinado_halteres', match: 'incline dumbbell press' },
    { alias: 'rosca_direta', match: 'barbell curl' },
    { alias: 'agachamento_livre', match: 'barbell squat' },
    { alias: 'levantamento_terra_romeno', match: 'romanian deadlift' },
  ];

  for (const item of aliasPairs) {
    const { data: exercise, error } = await supabase
      .from('exercises')
      .select('id, normalized_lookup_key, name_en')
      .eq('normalized_lookup_key', normalizeLookupKey(item.match))
      .limit(1)
      .maybeSingle();

    if (error || !exercise || !exercise.id) continue;

    await supabase.from('exercise_aliases').upsert({
      exercise_id: exercise.id,
      alias: item.alias,
      language: 'pt',
      alias_type: 'synonym',
    }, { onConflict: 'exercise_id,alias,language' });
  }

  log('exercise_aliases_completed', { count: aliasPairs.length });
}

async function run() {
  for (const env of REQUIRED_ENVS) {
    if (!process.env[env]) {
      throw new Error(`Missing required env: ${env}`);
    }
  }

  const state = readState();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  let offset = state.importOffset;
  while (true) {
    let rows: ExerciseDbItem[] = [];
    try {
      rows = await fetchExerciseDbBatch(process.env.EXERCISEDB_BASE_URL!, process.env.EXERCISEDB_API_KEY!, IMPORT_BATCH_SIZE, offset);
    } catch (error) {
      log('import_exercise_batch_completed', { offset, status: 'failed_fetch', reason: error instanceof Error ? error.message : String(error) });
      offset += IMPORT_BATCH_SIZE;
      writeState({ importOffset: offset });
      continue;
    }

    if (!rows.length) break;

    const mapped = rows.map(mapExercise);
    await upsertRows(supabase, mapped);
    offset += IMPORT_BATCH_SIZE;
    writeState({ importOffset: offset });
    await sleep(REQUEST_DELAY_MS);
  }

  let mediaOffset = state.mediaOffset;
  while (true) {
    const { data, error } = await supabase
      .from('exercises')
      .select('source_id,name,name_en,name_pt,slug,normalized_lookup_key,body_part,target_muscle,secondary_muscles,equipment,instructions,common_errors,breathing_tip,range_of_motion,media_url,media_thumbnail_url,media_type,media_provider,youtube_fallback_url,source,updated_at')
      .order('updated_at', { ascending: true })
      .range(mediaOffset, mediaOffset + MEDIA_BATCH_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    const batch = data.map((item: any) => ({ ...item } as ExerciseRow));
    await enrichMediaWithPexels(batch, process.env.PEXELS_API_KEY!);
    await upsertRows(supabase, batch);

    mediaOffset += data.length;
    writeState({ mediaOffset });
  }

  if (!state.aliasCompleted) {
    await seedAliasesIfAvailable(supabase);
    writeState({ aliasCompleted: true });
  }

  log('exercise_import_completed', { importOffset: offset, mediaOffset });
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
