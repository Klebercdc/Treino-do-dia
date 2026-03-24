/**
 * KRONIA Scraper — Fonte: yuhonas/free-exercise-db (GitHub)
 * ==========================================================
 * Base JSON pública com ~900 exercícios em inglês, incluindo:
 *   - Músculos primários e secundários
 *   - Nível de dificuldade (beginner / intermediate / expert)
 *   - Mecânica (compound / isolation)
 *   - Tipo de força (push / pull / static)
 *   - Instruções de execução passo a passo
 *   - URLs de imagens (GitHub CDN — sem custo)
 *
 * Fonte: https://github.com/yuhonas/free-exercise-db
 * Sem autenticação, sem Playwright, sem rate limiting.
 * Cache em disco por 7 dias (raramente atualizado).
 *
 * Estrutura do JSON bruto por exercício:
 * {
 *   id:               string,   // "Barbell_Bench_Press"
 *   name:             string,   // "Barbell Bench Press"
 *   force:            string|null, // "push" | "pull" | "static"
 *   level:            string,   // "beginner" | "intermediate" | "expert"
 *   mechanic:         string|null, // "compound" | "isolation"
 *   equipment:        string,   // "barbell" | "dumbbell" | "body only" | ...
 *   primaryMuscles:   string[], // ["chest"]
 *   secondaryMuscles: string[], // ["shoulders", "triceps"]
 *   instructions:     string[], // array de parágrafos
 *   category:         string,   // "strength" | "cardio" | "stretching" | ...
 *   images:           string[], // ["Barbell_Bench_Press/0.jpg", ...]
 * }
 */

'use strict';

const https = require('https');
const cache = require('../cache');

const JSON_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

// Mapeamento primaryMuscle → muscle_group KRONIA (PT-BR)
const MUSCLE_GROUP_MAP = {
  'abdominals':  'Abdômen/Lombar',
  'abductors':   'Glúteos',
  'adductors':   'Quadríceps/Isquiotibiais',
  'biceps':      'Bíceps/Tríceps',
  'calves':      'Panturrilha',
  'chest':       'Peito',
  'forearms':    'Antebraço',
  'glutes':      'Glúteos',
  'hamstrings':  'Quadríceps/Isquiotibiais',
  'lats':        'Costas',
  'lower back':  'Abdômen/Lombar',
  'middle back': 'Costas',
  'neck':        'Pescoço',
  'quadriceps':  'Quadríceps/Isquiotibiais',
  'shoulders':   'Ombros',
  'traps':       'Costas',
  'triceps':     'Bíceps/Tríceps',
};

// Mapeamento equipment → PT-BR
const EQUIPMENT_MAP = {
  'barbell':       'Barra',
  'dumbbell':      'Halter',
  'body only':     'Peso Corporal',
  'machine':       'Máquina',
  'cable':         'Cabo/Polia',
  'kettlebells':   'Kettlebell',
  'bands':         'Elástico',
  'medicine ball': 'Bola Medicinal',
  'exercise ball': 'Bola Suíça',
  'foam roll':     'Rolo de Espuma',
  'e-z curl bar':  'Barra EZ',
  'other':         'Outro',
};

// Mapeamento category → PT-BR (tipo de exercício)
const CATEGORY_MAP = {
  'strength':      'Força',
  'stretching':    'Flexibilidade',
  'cardio':        'Cardio',
  'plyometrics':   'Pliometria',
  'powerlifting':  'Powerlifting',
  'strongman':     'Strongman',
  'olympic weightlifting': 'Levantamento Olímpico',
};

/**
 * Faz GET e retorna JSON (sem autenticação).
 * @param {string} url
 * @returns {Promise<any>}
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'KRONIA-Scraper/1.0' },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(new Error('JSON inválido: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30_000, () => { req.destroy(); reject(new Error('Timeout: ' + url)); });
  });
}

/**
 * Coleta exercícios do free-exercise-db e normaliza para schema KRONIA enriquecido.
 *
 * Schema de saída (superconjunto do schema padrão):
 * {
 *   name:              string,   // Nome EN (única língua disponível)
 *   name_en:           string,
 *   muscle_group:      string,   // Grupo muscular KRONIA (PT-BR)
 *   muscles_primary:   string[], // Ex: ["chest"]
 *   muscles_secondary: string[], // Ex: ["shoulders", "triceps"]
 *   equipment:         string[], // PT-BR, ex: ["Barra"]
 *   description:       string,   // Instruções concatenadas
 *   level:             string,   // "beginner" | "intermediate" | "expert"
 *   force:             string,   // "push" | "pull" | "static" | ""
 *   mechanic:          string,   // "compound" | "isolation" | ""
 *   category:          string,   // PT-BR
 *   image_url:         string,   // Primeira imagem (GitHub CDN)
 *   source:            'github'
 * }
 *
 * @param {{ log?: (msg: string) => void }} [opts]
 * @returns {Promise<object[]>}
 */
async function scrapeExercises({ log = console.log } = {}) {
  const cacheKey = 'github_exdb_exercises_v2';
  const cached   = cache.get(cacheKey, 7 * 24 * 60 * 60 * 1000); // 7 dias
  if (cached) {
    log(`[github-exdb] Cache hit — ${cached.length} exercícios carregados`);
    return cached;
  }

  log(`[github-exdb] Buscando base completa…`);
  log(`[github-exdb] URL: ${JSON_URL}`);

  const raw = await fetchJSON(JSON_URL);
  if (!Array.isArray(raw)) throw new Error('[github-exdb] Resposta inesperada — esperado array');
  log(`[github-exdb] ${raw.length} exercícios brutos recebidos`);

  const exercises = [];

  for (const ex of raw) {
    if (!ex.name) continue;

    const primaryMuscle = (ex.primaryMuscles || [])[0] || '';
    const muscleGroup   = MUSCLE_GROUP_MAP[primaryMuscle] || 'Geral';

    const eqRaw  = (ex.equipment || '').toLowerCase();
    const eqPT   = EQUIPMENT_MAP[eqRaw] || ex.equipment || '';

    const catPT  = CATEGORY_MAP[(ex.category || '').toLowerCase()] || ex.category || '';

    const instructions = Array.isArray(ex.instructions)
      ? ex.instructions.join('\n')
      : (ex.instructions || '');

    const imageUrl = (ex.images && ex.images.length > 0)
      ? IMG_BASE + ex.images[0]
      : '';

    exercises.push({
      name:              ex.name,
      name_en:           ex.name,
      muscle_group:      muscleGroup,
      muscles_primary:   ex.primaryMuscles   || [],
      muscles_secondary: ex.secondaryMuscles || [],
      equipment:         eqPT ? [eqPT] : [],
      description:       instructions,
      level:             ex.level    || '',
      force:             ex.force    || '',
      mechanic:          ex.mechanic || '',
      category:          catPT,
      image_url:         imageUrl,
      source:            'github',
    });
  }

  log(`[github-exdb] ${exercises.length} exercícios normalizados`);
  cache.set(cacheKey, exercises);
  return exercises;
}

module.exports = { scrapeExercises };
