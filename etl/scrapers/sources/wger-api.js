/**
 * KRONIA Scraper — Fonte: wger.de REST API
 * ==========================================
 * wger (https://wger.de) é um projeto open-source de gestão de treinos.
 * A API pública não requer autenticação para leitura.
 *
 * Dados coletados:
 *   - Exercícios com nome em PT-BR (quando disponível) e EN
 *   - Músculos primários e secundários
 *   - Categoria (grupo muscular)
 *   - Equipamentos necessários
 *   - Instruções de execução (HTML → texto limpo)
 */

'use strict';

const https = require('https');
const cache = require('../cache');

const BASE_URL   = 'https://wger.de/api/v2';
const LANGUAGE_PT = 18;   // ID do idioma Português no wger
const LANGUAGE_EN = 2;    // ID do idioma Inglês no wger
const PAGE_LIMIT  = 100;  // Max por página da API

// Mapeamento categoria wger → muscle_group KRONIA
const CATEGORY_MAP = {
  'Abs':          'Abdômen/Lombar',
  'Arms':         'Bíceps/Tríceps',
  'Back':         'Costas',
  'Calves':       'Panturrilha',
  'Chest':        'Peito',
  'Legs':         'Quadríceps/Isquiotibiais',
  'Shoulders':    'Ombros',
};

// Mapeamento equipamento wger → label PT-BR
const EQUIPMENT_MAP = {
  'Barbell':          'Barra',
  'SZ-Bar':           'Barra EZ',
  'Dumbbell':         'Halter',
  'Gym mat':          'Colchonete',
  'Swiss Ball':       'Bola Suíça',
  'Pull-up bar':      'Barra Fixa',
  'None (bodyweight)':'Peso Corporal',
  'Bench':            'Banco',
  'Incline bench':    'Banco Inclinado',
  'Kettlebell':       'Kettlebell',
  'Cable':            'Cabo/Polia',
  'Machine':          'Máquina',
  'Plate':            'Anilha',
  'Resistance Band':  'Elástico',
  'Foam Roll':        'Rolo de Espuma',
  'Other':            'Outro',
};

/**
 * Faz uma requisição GET à API wger e retorna o JSON.
 * @param {string} url
 * @returns {Promise<any>}
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'KRONIA-Scraper/1.0' },
    }, (res) => {
      if (res.statusCode === 429) {
        reject(new Error(`Rate limited — aguarde antes de tentar novamente (${url})`));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15_000, () => { req.destroy(); reject(new Error('Timeout: ' + url)); });
  });
}

/**
 * Retorna todos os resultados paginados de um endpoint.
 * @param {string} endpoint  Ex: '/exercise/?format=json&language=2'
 * @returns {Promise<any[]>}
 */
async function fetchAll(endpoint) {
  const results = [];
  let url = `${BASE_URL}${endpoint}&limit=${PAGE_LIMIT}&offset=0`;

  while (url) {
    const data = await fetchJSON(url);
    results.push(...(data.results || []));
    url = data.next || null;
    if (url) await sleep(300); // respeita rate limit
  }
  return results;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Remove tags HTML de uma string. */
function stripHtml(html) {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Busca o mapa de categorias (id → nome em inglês).
 * @returns {Promise<Map<number,string>>}
 */
async function fetchCategoryMap() {
  const cacheKey = 'wger_categories';
  const cached = cache.get(cacheKey);
  if (cached) return new Map(Object.entries(cached).map(([k, v]) => [Number(k), v]));

  const items = await fetchAll('/exercisecategory/?format=json');
  const map = {};
  for (const c of items) map[c.id] = c.name;
  cache.set(cacheKey, map);
  return new Map(Object.entries(map).map(([k, v]) => [Number(k), v]));
}

/**
 * Busca o mapa de músculos (id → nome).
 * @returns {Promise<Map<number,string>>}
 */
async function fetchMuscleMap() {
  const cacheKey = 'wger_muscles';
  const cached = cache.get(cacheKey);
  if (cached) return new Map(Object.entries(cached).map(([k, v]) => [Number(k), v]));

  const items = await fetchAll('/muscle/?format=json');
  const map = {};
  for (const m of items) map[m.id] = m.name_en || m.name;
  cache.set(cacheKey, map);
  return new Map(Object.entries(map).map(([k, v]) => [Number(k), v]));
}

/**
 * Busca o mapa de equipamentos (id → nome).
 * @returns {Promise<Map<number,string>>}
 */
async function fetchEquipmentMap() {
  const cacheKey = 'wger_equipment';
  const cached = cache.get(cacheKey);
  if (cached) return new Map(Object.entries(cached).map(([k, v]) => [Number(k), v]));

  const items = await fetchAll('/equipment/?format=json');
  const map = {};
  for (const e of items) map[e.id] = e.name;
  cache.set(cacheKey, map);
  return new Map(Object.entries(map).map(([k, v]) => [Number(k), v]));
}

/**
 * Busca todas as traduções de exercícios em PT-BR e EN.
 * Retorna um Map exerciseBase_id → { namePt, nameEn, descriptionPt, descriptionEn }
 * @returns {Promise<Map<number,object>>}
 */
async function fetchTranslations() {
  const cacheKey = 'wger_translations';
  const cached = cache.get(cacheKey);
  if (cached) return new Map(Object.entries(cached).map(([k, v]) => [Number(k), v]));

  const [ptTrans, enTrans] = await Promise.all([
    fetchAll(`/exercise/?format=json&language=${LANGUAGE_PT}`),
    fetchAll(`/exercise/?format=json&language=${LANGUAGE_EN}`),
  ]);

  const map = {};

  for (const t of enTrans) {
    const bid = t.exercise_base;
    if (!map[bid]) map[bid] = {};
    map[bid].nameEn = t.name;
    map[bid].descriptionEn = stripHtml(t.description);
  }

  for (const t of ptTrans) {
    const bid = t.exercise_base;
    if (!map[bid]) map[bid] = {};
    map[bid].namePt = t.name;
    map[bid].descriptionPt = stripHtml(t.description);
  }

  cache.set(cacheKey, map);
  return new Map(Object.entries(map).map(([k, v]) => [Number(k), v]));
}

/**
 * Coleta todos os exercícios do wger e normaliza para o schema KRONIA.
 *
 * Schema de saída por exercício:
 * {
 *   name: string,              // Nome PT-BR (fallback EN)
 *   name_en: string,
 *   muscle_group: string,      // Grupo muscular no padrão KRONIA
 *   muscles_primary: string[], // Músculos primários
 *   muscles_secondary: string[],
 *   equipment: string[],
 *   description: string,       // Instruções PT-BR (fallback EN)
 *   source: 'wger'
 * }
 *
 * @param {{ log?: (msg: string) => void }} [opts]
 * @returns {Promise<object[]>}
 */
async function scrapeExercises({ log = console.log } = {}) {
  const cacheKey = 'wger_exercises_normalized';
  const cached = cache.get(cacheKey);
  if (cached) {
    log(`[wger] Cache hit — ${cached.length} exercícios carregados do cache`);
    return cached;
  }

  log('[wger] Buscando metadados (categorias, músculos, equipamentos)…');
  const [categoryMap, muscleMap, equipmentMap, translations] = await Promise.all([
    fetchCategoryMap(),
    fetchMuscleMap(),
    fetchEquipmentMap(),
    fetchTranslations(),
  ]);

  log('[wger] Buscando bases de exercícios…');
  const bases = await fetchAll('/exerciseinfo/?format=json');
  log(`[wger] ${bases.length} exercícios base recebidos`);

  const exercises = [];

  for (const base of bases) {
    const trans   = translations.get(base.id) || {};
    const nameEn  = trans.nameEn || '';
    const namePt  = trans.namePt || '';
    const name    = namePt || nameEn;
    if (!name) continue;

    const categoryName = categoryMap.get(base.category?.id) || '';
    const muscleGroup  = CATEGORY_MAP[categoryName] || categoryName || 'Geral';

    const musclesPrimary   = (base.muscles || [])
      .map(m => muscleMap.get(m.id || m) || String(m.id || m))
      .filter(Boolean);

    const musclesSecondary = (base.muscles_secondary || [])
      .map(m => muscleMap.get(m.id || m) || String(m.id || m))
      .filter(Boolean);

    const equipment = (base.equipment || [])
      .map(e => EQUIPMENT_MAP[equipmentMap.get(e.id || e)] || equipmentMap.get(e.id || e) || '')
      .filter(Boolean);

    exercises.push({
      name,
      name_en:            nameEn,
      muscle_group:       muscleGroup,
      muscles_primary:    musclesPrimary,
      muscles_secondary:  musclesSecondary,
      equipment,
      description:        trans.descriptionPt || trans.descriptionEn || '',
      source:             'wger',
    });
  }

  log(`[wger] ${exercises.length} exercícios normalizados`);
  cache.set(cacheKey, exercises);
  return exercises;
}

module.exports = { scrapeExercises };
