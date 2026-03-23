/**
 * KRONIA Scraper — Fonte: ExRx.net (via Playwright)
 * ==================================================
 * ExRx.net é a maior base pública de exercícios com instruções detalhadas,
 * músculos envolvidos e classificação por equipamento.
 *
 * Esta fonte usa Playwright para renderizar as páginas JavaScript e extrair
 * dados estruturados, com rate limiting e cache automático.
 *
 * ATENÇÃO: Use com moderação. Respeite o robots.txt e não execute em loops
 * sem os delays configurados. Destina-se apenas a enriquecer dados já
 * existentes (cold-start), não a monitoramento contínuo.
 */

'use strict';

const cache = require('../cache');

const EXRX_BASE = 'https://exrx.net';
const DELAY_MS  = 1500; // delay entre requests (ms)

// Mapeamento de categoria ExRx → muscle_group KRONIA
const CATEGORY_MAP = {
  'Chest':           'Peito',
  'Back':            'Costas',
  'Shoulders':       'Ombros',
  'Upper Arm':       'Bíceps/Tríceps',
  'Forearm':         'Antebraço',
  'Thighs':          'Quadríceps/Isquiotibiais',
  'Hamstrings':      'Quadríceps/Isquiotibiais',
  'Glutes':          'Glúteos',
  'Calves':          'Panturrilha',
  'Waist':           'Abdômen/Lombar',
  'Hip Flexors':     'Abdômen/Lombar',
  'Neck':            'Pescoço',
  'Cardiorespiratory': 'Cardio',
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Inicializa o browser Playwright com configurações conservadoras.
 * @returns {Promise<{browser, page}>}
 */
async function launchBrowser() {
  // Importação dinâmica para não quebrar ambientes sem Playwright instalado
  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (compatible; KRONIA-Scraper/1.0; +https://github.com/klebercdc/treino-do-dia)',
    locale:    'pt-BR,pt;q=0.9,en;q=0.8',
    viewport:  { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Bloqueia recursos desnecessários para acelerar scraping
  await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,mp4,webm}', r => r.abort());
  await page.route('**/ads/**', r => r.abort());
  await page.route('**/google-analytics.com/**', r => r.abort());

  return { browser, page };
}

/**
 * Extrai a lista de categorias de exercícios da página principal do ExRx.
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{category: string, url: string}>>}
 */
async function scrapeCategories(page) {
  await page.goto(`${EXRX_BASE}/Lists/Directory`, { waitUntil: 'domcontentloaded', timeout: 20_000 });

  return page.evaluate((base) => {
    const results = [];
    // Links de categorias ficam em <div class="col-sm-6"> > <ul> > <li> > <a>
    document.querySelectorAll('article a[href*="/Lists/"]').forEach(a => {
      const href = a.getAttribute('href') || '';
      const text = a.textContent.trim();
      if (text && href && !href.includes('#')) {
        results.push({
          category: text,
          url: href.startsWith('http') ? href : base + href,
        });
      }
    });
    return results;
  }, EXRX_BASE);
}

/**
 * Extrai links de exercícios de uma página de categoria.
 * @param {import('playwright').Page} page
 * @param {string} categoryUrl
 * @returns {Promise<Array<{name: string, url: string}>>}
 */
async function scrapeExerciseLinks(page, categoryUrl) {
  await page.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });

  return page.evaluate((base) => {
    const results = [];
    document.querySelectorAll('article a[href*="/WeightExercises/"], article a[href*="/Aerobic/"]').forEach(a => {
      const name = a.textContent.trim();
      const href = a.getAttribute('href') || '';
      if (name && href) {
        results.push({
          name,
          url: href.startsWith('http') ? href : base + href,
        });
      }
    });
    return results;
  }, EXRX_BASE);
}

/**
 * Extrai dados detalhados de um exercício individual.
 * @param {import('playwright').Page} page
 * @param {string} exerciseUrl
 * @param {string} muscleGroup
 * @returns {Promise<object|null>}
 */
async function scrapeExerciseDetail(page, exerciseUrl, muscleGroup) {
  try {
    await page.goto(exerciseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  } catch {
    return null;
  }

  return page.evaluate(({ url, muscleGroup }) => {
    // Nome do exercício
    const h1 = document.querySelector('h1.page-header, h1');
    const name = h1 ? h1.textContent.trim() : '';
    if (!name) return null;

    // Músculos (target e sinergistas)
    const musclesPrimary   = [];
    const musclesSecondary = [];

    // A estrutura do ExRx lista músculos em seções específicas
    document.querySelectorAll('.muscle-list li, .target li, .synergists li').forEach((li, _i) => {
      const section = li.closest('.muscle-list, .target, .synergists');
      if (!section) return;
      const sectionTitle = (section.querySelector('h4, h3')?.textContent || '').toLowerCase();
      const muscleName   = li.textContent.trim();

      if (sectionTitle.includes('target') || sectionTitle.includes('primary')) {
        musclesPrimary.push(muscleName);
      } else {
        musclesSecondary.push(muscleName);
      }
    });

    // Instruções de execução
    const instructionEl = document.querySelector('.exercise-description, article p');
    const description   = instructionEl ? instructionEl.textContent.trim() : '';

    // Classificação por equipamento (está no título ou breadcrumb)
    const breadcrumbs = Array.from(document.querySelectorAll('nav a, .breadcrumb a'))
      .map(a => a.textContent.trim())
      .filter(Boolean);

    return {
      name,
      muscle_group:      muscleGroup,
      muscles_primary:   musclesPrimary,
      muscles_secondary: musclesSecondary,
      equipment:         breadcrumbs.slice(-2, -1), // penúltimo breadcrumb = equipamento
      description,
      url,
      source: 'exrx',
    };
  }, { url: exerciseUrl, muscleGroup });
}

/**
 * Coleta exercícios do ExRx usando Playwright.
 *
 * @param {{
 *   maxPerCategory?: number,  // Limite de exercícios por categoria (padrão: 20)
 *   categories?: string[],    // Filtrar categorias (padrão: todas)
 *   log?: (msg: string) => void
 * }} [opts]
 * @returns {Promise<object[]>}
 */
async function scrapeExercises({
  maxPerCategory = 20,
  categories     = [],
  log            = console.log,
} = {}) {
  const cacheKey = `exrx_exercises_max${maxPerCategory}_cats${categories.sort().join('-') || 'all'}`;
  const cached   = cache.get(cacheKey);
  if (cached) {
    log(`[exrx] Cache hit — ${cached.length} exercícios carregados do cache`);
    return cached;
  }

  log('[exrx] Iniciando browser Playwright…');
  const { browser, page } = await launchBrowser();

  const allExercises = [];

  try {
    log('[exrx] Buscando categorias…');
    const rawCategories = await scrapeCategories(page);
    await sleep(DELAY_MS);

    const filteredCategories = categories.length > 0
      ? rawCategories.filter(c => categories.some(f => c.category.toLowerCase().includes(f.toLowerCase())))
      : rawCategories;

    log(`[exrx] ${filteredCategories.length} categorias encontradas`);

    for (const cat of filteredCategories) {
      const muscleGroup = CATEGORY_MAP[cat.category] || cat.category;
      log(`[exrx] Categoria: ${cat.category} → ${muscleGroup}`);

      let links;
      try {
        links = await scrapeExerciseLinks(page, cat.url);
        await sleep(DELAY_MS);
      } catch (err) {
        log(`[exrx] Erro ao listar ${cat.category}: ${err.message}`);
        continue;
      }

      const limited = links.slice(0, maxPerCategory);
      log(`[exrx]   ${limited.length}/${links.length} exercícios coletados`);

      for (const link of limited) {
        const exCacheKey = `exrx_ex_${link.url.replace(/\W+/g, '_')}`;
        let exercise = cache.get(exCacheKey, 7 * 24 * 60 * 60 * 1000); // cache 7 dias

        if (!exercise) {
          exercise = await scrapeExerciseDetail(page, link.url, muscleGroup);
          await sleep(DELAY_MS);
          if (exercise) cache.set(exCacheKey, exercise);
        }

        if (exercise) allExercises.push(exercise);
      }
    }

    log(`[exrx] Total: ${allExercises.length} exercícios coletados`);
    cache.set(cacheKey, allExercises);
  } finally {
    await browser.close();
  }

  return allExercises;
}

module.exports = { scrapeExercises };
