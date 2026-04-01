var fs = require('node:fs/promises');
var path = require('node:path');
var supabaseJs = require('@supabase/supabase-js');

var DEFAULT_EXERCISES_FILE = path.resolve(process.cwd(), 'data/exercises.json');

function validateRequiredEnv() {
  var missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(function(name) {
    return !process.env[name];
  });

  if (missing.length > 0) {
    throw new Error('Variáveis de ambiente obrigatórias ausentes: ' + missing.join(', '));
  }

  return {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
}

function getExercisesFile() {
  var rawFile = process.env.EXERCISES_FILE;
  return rawFile ? path.resolve(process.cwd(), rawFile) : DEFAULT_EXERCISES_FILE;
}

function chunk(array, size) {
  var chunks = [];
  for (var i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise(function(resolvePromise) {
    setTimeout(resolvePromise, ms);
  });
}

async function loadExercisesFromFile(exercisesFile) {
  var raw = await fs.readFile(exercisesFile, 'utf8');
  var parsed = JSON.parse(raw);
  var exercises = Array.isArray(parsed) ? parsed : parsed && parsed.exercises;

  if (!Array.isArray(exercises)) {
    throw new Error('Formato inválido em ' + exercisesFile + '. Esperado array ou objeto com chave "exercises".');
  }

  return exercises;
}

async function runExerciseImport(options) {
  var opts = options || {};
  var batchSize = opts.batchSize || 200;
  var batchDelayMs = opts.batchDelayMs == null ? 200 : opts.batchDelayMs;
  var exercisesFile = opts.exercisesFile || getExercisesFile();
  var logger = typeof opts.logger === 'function' ? opts.logger : function() {};

  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error('batchSize inválido. Use um inteiro positivo.');
  }

  var env = validateRequiredEnv();
  var supabase = supabaseJs.createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false }
  });

  var exercises = await loadExercisesFromFile(exercisesFile);
  var batches = chunk(exercises, batchSize);
  var batchLogs = [];

  logger('Iniciando importação: total=' + exercises.length + ', batchSize=' + batchSize + ', lotes=' + batches.length + '.');

  for (var index = 0; index < batches.length; index += 1) {
    var batch = batches[index];
    var batchNumber = index + 1;

    logger('Processando lote ' + batchNumber + '/' + batches.length + ' (' + batch.length + ' exercícios).');

    var startedAt = new Date();
    var rpc = await supabase.rpc('import_exercises_json', { payload: batch });

    if (rpc.error) {
      throw new Error('Erro no lote ' + batchNumber + '/' + batches.length + ': ' + rpc.error.message);
    }

    var finishedAt = new Date();
    var durationMs = finishedAt.getTime() - startedAt.getTime();
    var logEntry = {
      batch: batchNumber,
      totalBatches: batches.length,
      size: batch.length,
      durationMs: durationMs,
      status: 'ok'
    };

    batchLogs.push(logEntry);
    logger('Lote ' + batchNumber + '/' + batches.length + ' concluído em ' + durationMs + 'ms.');

    if (batchNumber < batches.length && batchDelayMs > 0) {
      await sleep(batchDelayMs);
    }
  }

  var countResult = await supabase.from('exercises').select('*', { count: 'exact', head: true });
  if (countResult.error) {
    throw new Error('Falha ao consultar total da tabela exercises: ' + countResult.error.message);
  }

  return {
    exercisesFile: exercisesFile,
    totalInputExercises: exercises.length,
    batchSize: batchSize,
    totalBatches: batches.length,
    batchLogs: batchLogs,
    finalExercisesCount: countResult.count || 0
  };
}

module.exports = {
  DEFAULT_EXERCISES_FILE: DEFAULT_EXERCISES_FILE,
  chunk: chunk,
  getExercisesFile: getExercisesFile,
  loadExercisesFromFile: loadExercisesFromFile,
  runExerciseImport: runExerciseImport,
  validateRequiredEnv: validateRequiredEnv
};
