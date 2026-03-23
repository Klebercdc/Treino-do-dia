/**
 * KRONIA Scraper — Cache em disco
 * Evita re-scraping de dados já coletados.
 * Formato: JSON gzipado em ./etl/scrapers/.cache/
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const CACHE_DIR = path.join(__dirname, '.cache');

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheKey(key) {
  // Sanitiza o nome para uso como nome de arquivo
  return key.replace(/[^a-z0-9_-]/gi, '_') + '.json.gz';
}

/**
 * Lê um item do cache.
 * @param {string} key
 * @param {number} maxAgeMs - Idade máxima em ms (padrão: 24h)
 * @returns {any|null}
 */
function get(key, maxAgeMs = 24 * 60 * 60 * 1000) {
  ensureCacheDir();
  const file = path.join(CACHE_DIR, cacheKey(key));
  if (!fs.existsSync(file)) return null;

  const stat = fs.statSync(file);
  if (Date.now() - stat.mtimeMs > maxAgeMs) {
    fs.unlinkSync(file);
    return null;
  }

  try {
    const compressed = fs.readFileSync(file);
    const json = zlib.gunzipSync(compressed).toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Grava um item no cache.
 * @param {string} key
 * @param {any} data
 */
function set(key, data) {
  ensureCacheDir();
  const file = path.join(CACHE_DIR, cacheKey(key));
  const json = JSON.stringify(data);
  const compressed = zlib.gzipSync(Buffer.from(json, 'utf8'));
  fs.writeFileSync(file, compressed);
}

/**
 * Remove um item do cache.
 * @param {string} key
 */
function del(key) {
  const file = path.join(CACHE_DIR, cacheKey(key));
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

/** Limpa todo o cache. */
function clear() {
  ensureCacheDir();
  for (const f of fs.readdirSync(CACHE_DIR)) {
    fs.unlinkSync(path.join(CACHE_DIR, f));
  }
}

/** Lista as chaves em cache (sem extensão). */
function keys() {
  ensureCacheDir();
  return fs.readdirSync(CACHE_DIR)
    .filter(f => f.endsWith('.json.gz'))
    .map(f => f.replace(/\.json\.gz$/, ''));
}

module.exports = { get, set, del, clear, keys };
