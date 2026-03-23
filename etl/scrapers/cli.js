#!/usr/bin/env node
/**
 * KRONIA Scraper — CLI
 * ====================
 * Interface de linha de comando para executar a biblioteca de web scraping.
 *
 * Uso:
 *   node etl/scrapers/cli.js [opções]
 *
 * Opções:
 *   --sources <lista>      Fontes separadas por vírgula: wger,exrx  (padrão: wger)
 *   --output  <arquivo>    Arquivo de saída JSON                     (padrão: etl/scrapers/output/exercises.json)
 *   --csv                  Também exporta CSV
 *   --force                Ignora cache e re-coleta tudo
 *   --stats                Mostra estatísticas após coleta
 *   --max-per-category <n> Limite de exercícios por categoria (exrx)  (padrão: 20)
 *   --categories <lista>   Filtrar categorias do exrx (ex: Chest,Back)
 *   --help                 Mostra esta ajuda
 *
 * Exemplos:
 *   # Coleta somente da API wger (rápido, sem Playwright)
 *   node etl/scrapers/cli.js --sources wger --stats
 *
 *   # Coleta do ExRx com Playwright (mais lento, dados mais ricos)
 *   node etl/scrapers/cli.js --sources exrx --max-per-category 10
 *
 *   # Combina as duas fontes e exporta CSV
 *   node etl/scrapers/cli.js --sources wger,exrx --csv --stats
 *
 *   # Re-coleta ignorando cache
 *   node etl/scrapers/cli.js --sources wger --force
 */

'use strict';

const path = require('path');
const { KroniaScraper } = require('./index');

// ── Parsing de argumentos ─────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    sources:        ['wger'],
    output:         null,
    csv:            false,
    force:          false,
    stats:          false,
    maxPerCategory: 20,
    categories:     [],
    help:           false,
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--sources':
        args.sources = (argv[++i] || 'wger').split(',').map(s => s.trim());
        break;
      case '--output':
        args.output = argv[++i];
        break;
      case '--csv':
        args.csv = true;
        break;
      case '--force':
        args.force = true;
        break;
      case '--stats':
        args.stats = true;
        break;
      case '--max-per-category':
        args.maxPerCategory = parseInt(argv[++i], 10) || 20;
        break;
      case '--categories':
        args.categories = (argv[++i] || '').split(',').map(s => s.trim());
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
KRONIA Web Scraper — CLI
========================
Coleta dados de exercícios de fontes públicas para resolver o Cold Start do banco.

Uso:
  node etl/scrapers/cli.js [opções]

Opções:
  --sources <lista>        Fontes: wger,exrx  (padrão: wger)
  --output  <arquivo>      Arquivo JSON de saída
  --csv                    Também exporta CSV
  --force                  Re-coleta ignorando cache
  --stats                  Exibe estatísticas por grupo muscular e fonte
  --max-per-category <n>   Limite de exercícios por categoria [exrx] (padrão: 20)
  --categories <lista>     Filtrar categorias [exrx] (ex: Chest,Back)
  --help                   Esta mensagem

Exemplos:
  node etl/scrapers/cli.js --sources wger --stats
  node etl/scrapers/cli.js --sources wger,exrx --csv --stats
  node etl/scrapers/cli.js --sources exrx --max-per-category 10 --categories "Chest,Back"
  node etl/scrapers/cli.js --force

Fontes disponíveis:
  wger  — API REST pública wger.de (rápido, sem browser)
  exrx  — ExRx.net via Playwright (lento, dados ricos de instrução)
`);
}

// ── Formatação de estatísticas ────────────────────────────────────────────────

function printStats(stats) {
  console.log('\n═══ Estatísticas ═══');
  console.log(`Total de exercícios: ${stats.total}`);

  console.log('\nPor grupo muscular:');
  const groups = Object.entries(stats.byGroup).sort((a, b) => b[1] - a[1]);
  for (const [g, n] of groups) {
    const bar = '█'.repeat(Math.round(n / stats.total * 30));
    console.log(`  ${g.padEnd(35)} ${String(n).padStart(4)}  ${bar}`);
  }

  console.log('\nPor fonte:');
  for (const [s, n] of Object.entries(stats.bySources)) {
    console.log(`  ${s.padEnd(20)} ${n}`);
  }
  console.log('════════════════════\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Valida fontes
  const validSources = new Set(['wger', 'exrx']);
  const invalid = args.sources.filter(s => !validSources.has(s));
  if (invalid.length > 0) {
    console.error(`Fonte(s) inválida(s): ${invalid.join(', ')}`);
    console.error('Fontes válidas: wger, exrx');
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════╗');
  console.log('║  KRONIA Web Scraper — Motor Frio OFF ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`Fontes:  ${args.sources.join(', ')}`);
  console.log(`Cache:   ${args.force ? 'IGNORADO (--force)' : 'ativo'}`);
  console.log('');

  const scraper = new KroniaScraper({
    sources:     args.sources,
    exrxOptions: {
      maxPerCategory: args.maxPerCategory,
      categories:     args.categories,
    },
    log: (msg) => console.log(`  ${msg}`),
  });

  const start = Date.now();
  await scraper.scrapeExercises({ force: args.force });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\nColeta concluída em ${elapsed}s`);

  // Exporta JSON
  const jsonPath = await scraper.exportJSON(args.output);
  console.log(`JSON: ${path.relative(process.cwd(), jsonPath)}`);

  // Exporta CSV (opcional)
  if (args.csv) {
    const csvPath = jsonPath.replace(/\.json$/, '.csv');
    await scraper.exportCSV(csvPath);
    console.log(`CSV:  ${path.relative(process.cwd(), csvPath)}`);
  }

  // Estatísticas
  if (args.stats) {
    printStats(scraper.stats());
  }
}

main().catch(err => {
  console.error('\nErro fatal:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
