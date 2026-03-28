/**
 * GET /api/cron-scraper
 * ═══════════════════════════════════════════════════════════════
 * KRONIA Cron — Atualização semanal do banco de exercícios
 *
 * Executado automaticamente toda segunda-feira às 04:00 UTC
 * pelo Vercel Cron (configurado em vercel.json).
 *
 * O que faz:
 *   1. Baixa ~900 exercícios do free-exercise-db (GitHub CDN)
 *   2. Faz upsert na tabela `exercises` do Supabase
 *   3. Retorna estatísticas da operação
 *
 * Segurança:
 *   - Verifica o header x-cron-secret (valor em CRON_SECRET no Vercel)
 *   - O Vercel envia automaticamente ao executar crons
 *   - Chamada manual requer o mesmo secret no header
 *
 * Variáveis de ambiente obrigatórias:
 *   SUPABASE_URL         — URL do projeto Supabase
 *   SUPABASE_SERVICE_KEY — chave service_role (necessária para INSERT em exercises)
 *   CRON_SECRET          — segredo para proteger chamadas manuais
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

var https  = require('https');
var crypto = require('crypto');
var cors   = require('./_cors');

var SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
var SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
var CRON_SECRET  = process.env.CRON_SECRET || '';

var EXDB_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
var EXDB_IMG = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

// ── Mapeamentos (mesmo padrão do github-exdb.js) ──────────────────────────────

var MUSCLE_GROUP = {
  abdominals:'Abdômen/Lombar', abductors:'Glúteos', adductors:'Quadríceps/Isquiotibiais',
  biceps:'Bíceps/Tríceps', calves:'Panturrilha', chest:'Peito', forearms:'Antebraço',
  glutes:'Glúteos', hamstrings:'Quadríceps/Isquiotibiais', lats:'Costas',
  'lower back':'Abdômen/Lombar', 'middle back':'Costas', neck:'Pescoço',
  quadriceps:'Quadríceps/Isquiotibiais', shoulders:'Ombros', traps:'Costas', triceps:'Bíceps/Tríceps',
};

var EQUIPMENT_PT = {
  barbell:'Barra', dumbbell:'Halter', 'body only':'Peso Corporal', machine:'Máquina',
  cable:'Cabo/Polia', kettlebells:'Kettlebell', bands:'Elástico',
  'medicine ball':'Bola Medicinal', 'exercise ball':'Bola Suíça',
  'foam roll':'Rolo de Espuma', 'e-z curl bar':'Barra EZ', other:'Outro',
};

// ── Helpers HTTP ──────────────────────────────────────────────────────────────

function httpsGET(url) {
  return new Promise(function(resolve, reject) {
    var urlObj = new URL(url);
    var chunks = [];
    var req = https.request({
      hostname: urlObj.hostname, port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'User-Agent': 'KRONIA-Cron/1.0', 'Accept': 'application/json' },
    }, function(res) {
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch(e) { reject(new Error('JSON inválido')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, function() { req.destroy(); reject(new Error('Timeout: ' + url)); });
    req.end();
  });
}

function supaUpsert(table, rows) {
  return new Promise(function(resolve, reject) {
    var body    = JSON.stringify(rows);
    var urlObj  = new URL(SUPABASE_URL + '/rest/v1/' + table);
    var req = https.request({
      hostname: urlObj.hostname, port: 443,
      path:     urlObj.pathname + '?on_conflict=name',
      method:   'POST',
      headers: {
        'apikey':        SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type':  'application/json',
        'Prefer':        'resolution=merge-duplicates,return=minimal',
        'Content-Length': Buffer.byteLength(body),
      },
    }, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() { resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', reject);
    req.setTimeout(30000, function() { req.destroy(); reject(new Error('Timeout upsert')); });
    req.write(body);
    req.end();
  });
}

// ── Normalização ──────────────────────────────────────────────────────────────

function normalizeExercises(raw) {
  return raw
    .filter(function(ex) { return ex.name; })
    .map(function(ex) {
      var pm          = (ex.primaryMuscles || [])[0] || '';
      var muscleGroup = MUSCLE_GROUP[pm] || 'Geral';
      var eqKey       = (ex.equipment || '').toLowerCase();
      var equipment   = EQUIPMENT_PT[eqKey] || ex.equipment || '';
      var imageUrl    = (ex.images && ex.images.length > 0) ? EXDB_IMG + ex.images[0] : null;
      var instructions = Array.isArray(ex.instructions)
        ? ex.instructions  // guarda como array para o campo TEXT[] do Supabase
        : (ex.instructions ? [ex.instructions] : null);

      return {
        name:              ex.name,
        muscle_group:      muscleGroup,
        source:            'free-exercise-db',
        // Campos da migration 005
        instructions:      instructions,
        image_url:         imageUrl,
        level:             ex.level    || null,
        equipment:         equipment   || null,
        force_type:        ex.force    || null,
        mechanic:          ex.mechanic || null,
        secondary_muscles: ex.secondaryMuscles && ex.secondaryMuscles.length ? ex.secondaryMuscles : null,
      };
    });
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET')     { res.status(405).json({ error: 'Use GET' }); return; }

  // Segurança: valida o secret do cron (timing-safe para evitar timing attacks)
  var secret = req.headers['x-cron-secret'] || (req.query && req.query.secret) || '';
  var secretBuf   = Buffer.from(CRON_SECRET || '');
  var receivedBuf = Buffer.from(secret);
  var validSecret = CRON_SECRET &&
    receivedBuf.length === secretBuf.length &&
    crypto.timingSafeEqual(receivedBuf, secretBuf);
  if (!validSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!SERVICE_KEY) {
    res.status(500).json({ error: 'SUPABASE_SERVICE_KEY não configurada' });
    return;
  }

  var startAt = Date.now();
  var log     = [];

  try {
    // 1. Baixa exercícios
    log.push({ ts: Date.now(), msg: 'Buscando free-exercise-db…' });
    var raw  = await httpsGET(EXDB_URL);
    log.push({ ts: Date.now(), msg: raw.length + ' exercícios brutos recebidos' });

    var rows = normalizeExercises(raw);
    log.push({ ts: Date.now(), msg: rows.length + ' exercícios normalizados' });

    // 2. Upsert em batches de 200 (limite do Supabase REST)
    var BATCH    = 200;
    var batches  = Math.ceil(rows.length / BATCH);
    var inserted = 0;
    var errors   = 0;

    for (var i = 0; i < batches; i++) {
      var batch  = rows.slice(i * BATCH, (i + 1) * BATCH);
      var result = await supaUpsert('exercises', batch);
      if (result.status >= 200 && result.status < 300) {
        inserted += batch.length;
        log.push({ ts: Date.now(), msg: 'Batch ' + (i + 1) + '/' + batches + ' OK (' + batch.length + ' rows)' });
      } else {
        errors++;
        log.push({ ts: Date.now(), msg: 'Batch ' + (i + 1) + ' ERRO: status ' + result.status });
      }
    }

    var elapsed = ((Date.now() - startAt) / 1000).toFixed(1);
    log.push({ ts: Date.now(), msg: 'Concluído em ' + elapsed + 's — ' + inserted + ' exercícios upsertados, ' + errors + ' erros' });

    res.status(200).json({
      ok:        true,
      total:     rows.length,
      inserted:  inserted,
      errors:    errors,
      elapsed_s: parseFloat(elapsed),
      log:       log,
    });

  } catch(e) {
    log.push({ ts: Date.now(), msg: 'ERRO FATAL: ' + e.message });
    res.status(500).json({ ok: false, error: e.message, log: log });
  }
};
