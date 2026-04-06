import * as fs from 'node:fs';
import * as path from 'node:path';
import { sanitizeMediaUrl } from './media-utils';

type LocalExerciseRecord = {
  id?: string | number;
  slug?: string | null;
  name?: string | null;
  name_pt?: string | null;
  name_en?: string | null;
  bodyPart?: string | null;
  body_part?: string | null;
  target?: string | null;
  target_muscle?: string | null;
  equipment?: string | null;
  search_terms?: string[] | null;
  gifUrl?: string | null;
  gif_url?: string | null;
};

export type LocalCatalogMatch = {
  gifUrl: string;
  sourceId: string | null;
  slug: string | null;
  normalizedLookupKey: string;
  nameEn: string | null;
  score: number;
  matchedBy: string;
};

type ResolverInput = {
  name?: string | null;
  slug?: string | null;
  normalizedLookupKey?: string | null;
  targetMuscle?: string | null;
  equipment?: string | null;
  searchTerms?: string[] | null;
};

type IndexedLocalRecord = {
  raw: LocalExerciseRecord;
  names: string[];
  tokens: Set<string>;
  normalizedLookupKey: string;
  gifUrl: string | null;
  targetMuscle: string;
  equipment: string;
};

const LOCAL_CATALOG_FILE = path.resolve(process.cwd(), 'data/exercises.json');
const TOKEN_OVERRIDES: Record<string, string[]> = {
  push_up: ['push-up', 'push up', 'pushup'],
  pull_up: ['pull-up', 'pull up', 'pullup'],
  chin_up: ['chin-up', 'chin up', 'chinup', 'pull-up', 'pull up'],
  shoulder_press: ['overhead press'],
  arnold_press: ['overhead press'],
  seated_row: ['row'],
  single_arm_dumbbell_row: ['dumbbell row', 'row'],
  hack_squat: ['squat'],
  bulgarian_split_squat: ['split squat'],
  walking_lunge: ['lunge'],
  decline_bench_press: ['bench press'],
  close_grip_bench_press: ['bench press close grip', 'bench press'],
  pec_deck: ['chest fly', 'fly'],
};

let cachedIndex: IndexedLocalRecord[] | null = null;

function normalizeToken(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLookupKey(value: string): string {
  return normalizeToken(value).replace(/\s+/g, '_');
}

function tokenize(value: string): string[] {
  return normalizeToken(value)
    .split(' ')
    .filter(Boolean)
    .filter((token) => token.length > 1);
}

function buildCandidatePhrases(input: ResolverInput): string[] {
  const base = [
    input.normalizedLookupKey ? String(input.normalizedLookupKey).replace(/_/g, ' ') : '',
    input.slug ? String(input.slug).replace(/[-_]+/g, ' ') : '',
    input.name ? String(input.name) : '',
    ...(Array.isArray(input.searchTerms) ? input.searchTerms.map((item) => String(item || '')) : []),
  ]
    .map((value) => normalizeToken(value))
    .filter(Boolean);

  const lookupKey = normalizeLookupKey(
    input.normalizedLookupKey
      || input.slug
      || input.name
      || base[0]
      || '',
  );
  const override = TOKEN_OVERRIDES[lookupKey] || [];

  return Array.from(new Set([...base, ...override.map((item) => normalizeToken(item)).filter(Boolean)]));
}

function scoreMatch(record: IndexedLocalRecord, input: ResolverInput): { score: number; matchedBy: string } {
  const phrases = buildCandidatePhrases(input);
  if (!phrases.length) return { score: 0, matchedBy: 'none' };

  const targetMuscle = normalizeToken(input.targetMuscle || '');
  const equipment = normalizeToken(input.equipment || '');
  const targetBoost = targetMuscle && record.targetMuscle && record.targetMuscle.includes(targetMuscle) ? 0.08 : 0;
  const equipmentBoost = equipment && record.equipment && record.equipment.includes(equipment) ? 0.05 : 0;

  let best = { score: 0, matchedBy: 'none' };

  for (const phrase of phrases) {
    const queryTokens = new Set(tokenize(phrase));
    if (!queryTokens.size) continue;

    if (record.names.includes(phrase)) {
      return { score: 1, matchedBy: `exact:${phrase}` };
    }

    const lookupKey = normalizeLookupKey(phrase);
    if (lookupKey && record.normalizedLookupKey === lookupKey) {
      return { score: 0.985, matchedBy: `lookup:${lookupKey}` };
    }

    let overlap = 0;
    for (const token of Array.from(queryTokens)) {
      if (record.tokens.has(token)) overlap += 1;
    }
    const tokenScore = overlap / queryTokens.size;
    const substringBoost = record.names.some((name) => name.includes(phrase) || phrase.includes(name)) ? 0.08 : 0;
    const score = Number(Math.min(0.96, tokenScore + targetBoost + equipmentBoost + substringBoost).toFixed(4));

    if (score > best.score) {
      best = { score, matchedBy: `tokens:${phrase}:${overlap}/${queryTokens.size}` };
    }
  }

  return best;
}

function loadCatalogIndex(): IndexedLocalRecord[] {
  if (cachedIndex) return cachedIndex;

  const raw = JSON.parse(fs.readFileSync(LOCAL_CATALOG_FILE, 'utf8'));
  const list: LocalExerciseRecord[] = Array.isArray(raw) ? raw : Array.isArray(raw?.exercises) ? raw.exercises : [];

  cachedIndex = list.map((item) => {
    const names = [
      item.slug ? String(item.slug).replace(/[-_]+/g, ' ') : '',
      item.name,
      item.name_pt,
      item.name_en,
      ...(Array.isArray(item.search_terms) ? item.search_terms : []),
    ]
      .map((value) => normalizeToken(String(value || '')))
      .filter(Boolean);

    return {
      raw: item,
      names: Array.from(new Set(names)),
      tokens: new Set(names.flatMap((value) => tokenize(value))),
      normalizedLookupKey: normalizeLookupKey(item.name_en || item.name_pt || item.name || item.slug || ''),
      gifUrl: sanitizeMediaUrl(item.gifUrl || item.gif_url || null),
      targetMuscle: normalizeToken(item.target_muscle || item.target || ''),
      equipment: normalizeToken(item.equipment || ''),
    };
  }).filter((item) => item.gifUrl);

  return cachedIndex;
}

export function resolveLocalCatalogMedia(input: ResolverInput): LocalCatalogMatch | null {
  const index = loadCatalogIndex();
  let best: LocalCatalogMatch | null = null;

  for (const record of index) {
    const { score, matchedBy } = scoreMatch(record, input);
    if (score < 0.52 || !record.gifUrl) continue;

    const candidate: LocalCatalogMatch = {
      gifUrl: record.gifUrl,
      sourceId: record.raw.id != null ? String(record.raw.id) : null,
      slug: record.raw.slug ? String(record.raw.slug) : null,
      normalizedLookupKey: record.normalizedLookupKey,
      nameEn: record.raw.name_en ? String(record.raw.name_en) : null,
      score,
      matchedBy,
    };

    if (!best || candidate.score > best.score) best = candidate;
  }

  return best;
}
