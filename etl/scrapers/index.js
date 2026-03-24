/**
 * KRONIA Web Scraping Library
 * ============================
 * Biblioteca de coleta de dados externos para resolver o Cold Start (Motor Frio)
 * do banco de dados KRONIA.
 *
 * Fontes suportadas:
 *   - wger   : API REST pública (wger.de) — exercícios multilíngues, músculos, equipamentos
 *   - exrx   : ExRx.net via Playwright — instruções detalhadas de execução
 *   - github : yuhonas/free-exercise-db (JSON) — ~900 exercícios com nível, mecânica, imagens
 *
 * Uso básico:
 *   const { KroniaScraper } = require('./etl/scrapers');
 *   const scraper = new KroniaScraper({ sources: ['wger'] });
 *   const exercises = await scraper.scrapeExercises();
 *   await scraper.exportJSON('./etl/scrapers/output/exercises.json');
 *
 * Uso via CLI:
 *   node etl/scrapers/cli.js --sources wger --output ./etl/scrapers/output/exercises.json
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const wgerSource   = require('./sources/wger-api');
const exrxSource   = require('./sources/exrx');
const githubSource = require('./sources/github-exdb');
const cache        = require('./cache');

const OUTPUT_DIR = path.join(__dirname, 'output');

// ── Normalização & Deduplicação ───────────────────────────────────────────────

/**
 * Normaliza o nome de um exercício para comparação (lowercase, sem acentos).
 * @param {string} name
 * @returns {string}
 */
function normalizeKey(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mescla exercícios de múltiplas fontes, deduplicando por nome normalizado.
 * Exercícios com mesmo nome têm seus campos mesclados (wger tem prioridade para nome PT).
 * @param {object[][]} exerciseLists
 * @returns {object[]}
 */
function mergeAndDeduplicate(exerciseLists) {
  const map = new Map();

  for (const list of exerciseLists) {
    for (const ex of list) {
      const key = normalizeKey(ex.name || ex.name_en || '');
      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, { ...ex });
      } else {
        // Mescla: preenche campos vazios com dados da nova fonte
        const existing = map.get(key);
        if (!existing.description && ex.description) existing.description     = ex.description;
        if (!existing.name_en    && ex.name_en)    existing.name_en           = ex.name_en;
        if ((!existing.muscles_primary   || !existing.muscles_primary.length)   && ex.muscles_primary)   existing.muscles_primary   = ex.muscles_primary;
        if ((!existing.muscles_secondary || !existing.muscles_secondary.length) && ex.muscles_secondary) existing.muscles_secondary = ex.muscles_secondary;
        if ((!existing.equipment         || !existing.equipment.length)         && ex.equipment)         existing.equipment         = ex.equipment;
        // Registra todas as fontes
        const sources = new Set([existing.source, ex.source].filter(Boolean));
        existing.source = [...sources].join('+');
      }
    }
  }

  return [...map.values()];
}

// ── KroniaScraper ─────────────────────────────────────────────────────────────

class KroniaScraper {
  /**
   * @param {{
   *   sources?: ('wger'|'exrx')[],         // Fontes ativas (padrão: ['wger'])
   *   exrxOptions?: {
   *     maxPerCategory?: number,            // Limite por categoria no ExRx (padrão: 20)
   *     categories?: string[],             // Filtrar categorias
   *   },
   *   log?: (msg: string) => void,         // Logger customizado
   * }} [options]
   */
  constructor({
    sources     = ['wger'],
    exrxOptions = {},
    log         = console.log,
  } = {}) {
    this.sources     = sources;
    this.exrxOptions = exrxOptions;
    this.log         = log;
    this._exercises  = null;
  }

  /**
   * Coleta exercícios de todas as fontes configuradas e retorna o resultado mesclado.
   * O resultado é cacheado na instância — chame novamente para re-coletar.
   *
   * @param {{ force?: boolean }} [opts]  force=true ignora cache em disco
   * @returns {Promise<object[]>}
   */
  async scrapeExercises({ force = false } = {}) {
    if (force) {
      this.log('[KroniaScraper] Limpando cache…');
      cache.clear();
    }

    const lists = [];

    if (this.sources.includes('wger')) {
      this.log('[KroniaScraper] Fonte: wger.de');
      const wgerExercises = await wgerSource.scrapeExercises({ log: this.log });
      lists.push(wgerExercises);
      this.log(`[KroniaScraper] wger → ${wgerExercises.length} exercícios`);
    }

    if (this.sources.includes('exrx')) {
      this.log('[KroniaScraper] Fonte: ExRx.net (Playwright)');
      const exrxExercises = await exrxSource.scrapeExercises({
        log: this.log,
        ...this.exrxOptions,
      });
      lists.push(exrxExercises);
      this.log(`[KroniaScraper] exrx → ${exrxExercises.length} exercícios`);
    }

    if (this.sources.includes('github')) {
      this.log('[KroniaScraper] Fonte: yuhonas/free-exercise-db (GitHub)');
      const githubExercises = await githubSource.scrapeExercises({ log: this.log });
      lists.push(githubExercises);
      this.log(`[KroniaScraper] github → ${githubExercises.length} exercícios`);
    }

    this._exercises = mergeAndDeduplicate(lists);
    this.log(`[KroniaScraper] Total após deduplicação: ${this._exercises.length} exercícios`);
    return this._exercises;
  }

  /**
   * Retorna estatísticas da última coleta.
   * @returns {object}
   */
  stats() {
    if (!this._exercises) return { total: 0, byGroup: {}, bySources: {} };

    const byGroup   = {};
    const bySources = {};

    for (const ex of this._exercises) {
      const g = ex.muscle_group || 'Sem grupo';
      byGroup[g]   = (byGroup[g]   || 0) + 1;

      const s = ex.source || 'unknown';
      bySources[s] = (bySources[s] || 0) + 1;
    }

    return {
      total: this._exercises.length,
      byGroup,
      bySources,
    };
  }

  /**
   * Exporta os exercícios coletados para um arquivo JSON.
   * @param {string} [filePath]  Caminho do arquivo (padrão: ./etl/scrapers/output/exercises.json)
   * @returns {Promise<string>}  Caminho do arquivo gerado
   */
  async exportJSON(filePath) {
    if (!this._exercises) {
      await this.scrapeExercises();
    }

    const outPath = filePath || path.join(OUTPUT_DIR, 'exercises.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const payload = {
      generated_at: new Date().toISOString(),
      total:        this._exercises.length,
      sources:      this.sources,
      exercises:    this._exercises,
    };

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    this.log(`[KroniaScraper] Exportado: ${outPath} (${this._exercises.length} exercícios)`);
    return outPath;
  }

  /**
   * Exporta para CSV simples (nome, grupo muscular, fonte).
   * @param {string} [filePath]
   * @returns {Promise<string>}
   */
  async exportCSV(filePath) {
    if (!this._exercises) {
      await this.scrapeExercises();
    }

    const outPath = filePath || path.join(OUTPUT_DIR, 'exercises.csv');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const header = 'name,name_en,muscle_group,muscles_primary,equipment,source';
    const rows   = this._exercises.map(ex => [
      `"${(ex.name       || '').replace(/"/g, '""')}"`,
      `"${(ex.name_en    || '').replace(/"/g, '""')}"`,
      `"${(ex.muscle_group || '').replace(/"/g, '""')}"`,
      `"${((ex.muscles_primary || []).join('; ')).replace(/"/g, '""')}"`,
      `"${((ex.equipment      || []).join('; ')).replace(/"/g, '""')}"`,
      `"${(ex.source      || '').replace(/"/g, '""')}"`,
    ].join(','));

    fs.writeFileSync(outPath, [header, ...rows].join('\n'), 'utf8');
    this.log(`[KroniaScraper] CSV exportado: ${outPath}`);
    return outPath;
  }

  /**
   * Retorna exercícios prontos para upsert no Supabase (schema da tabela `exercises`).
   * @returns {object[]}
   */
  toSupabaseRows() {
    if (!this._exercises) throw new Error('Execute scrapeExercises() antes de chamar toSupabaseRows()');
    return this._exercises.map(ex => ({
      name:              ex.name,
      muscle_group:      ex.muscle_group,
      source:            ex.source,
      // Campos extras (requerem migration no Supabase para existir):
      name_en:           ex.name_en           || null,
      description:       ex.description       || null,
      muscles_primary:   ex.muscles_primary   || [],
      muscles_secondary: ex.muscles_secondary || [],
      equipment:         ex.equipment         || [],
      // Campos enriquecidos (fonte: github)
      level:             ex.level             || null,
      force:             ex.force             || null,
      mechanic:          ex.mechanic          || null,
      image_url:         ex.image_url         || null,
    }));
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  KroniaScraper,
  cache,
  sources: {
    wger:   wgerSource,
    exrx:   exrxSource,
    github: githubSource,
  },
};
