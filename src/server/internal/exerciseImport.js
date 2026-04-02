var fs = require('node:fs/promises');
var path = require('node:path');
var supabaseJs = require('@supabase/supabase-js');

var DEFAULT_EXERCISES_FILE = path.resolve(process.cwd(), 'data/exercises.json');
var DEFAULT_BATCH_SIZE = 100;
var IMPORT_LOCK_KEY = 948221;
var JOB_TYPE = 'exercise_import';

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

function createSupabaseAdminClient() {
  var env = validateRequiredEnv();
  return supabaseJs.createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false }
  });
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

function sanitizeErrorMessage(error) {
  var message = error instanceof Error ? error.message : String(error);
  message = message.replace(/([A-Za-z]:)?[\\/][^ ]+/g, '[path]');
  return message.slice(0, 300);
}

function validateDuplicates(exercises) {
  var seen = Object.create(null);
  for (var i = 0; i < exercises.length; i += 1) {
    var item = exercises[i] || {};
    var key = [item.exercise_id, item.name, item.slug].filter(Boolean).join('|');
    if (!key) {
      continue;
    }
    if (seen[key]) {
      throw new Error('Exercícios duplicados detectados no payload.');
    }
    seen[key] = true;
  }
}

async function hasRunningImport(supabase) {
  var attempts = [
    { p_job_type: JOB_TYPE },
    { p_type: JOB_TYPE },
    { job_type: JOB_TYPE }
  ];

  for (var i = 0; i < attempts.length; i += 1) {
    var result = await supabase.rpc('admin_has_running_import', attempts[i]);
    if (!result.error) {
      return result.data === true;
    }
  }

  throw new Error('Falha ao verificar importação em andamento.');
}

async function acquireImportLock(supabase) {
  var lockResult = await supabase.rpc('admin_acquire_import_lock', { p_lock_key: IMPORT_LOCK_KEY });
  if (lockResult.error) {
    throw new Error('Falha ao adquirir lock de importação.');
  }
  return lockResult.data === true;
}

async function releaseImportLock(supabase) {
  try {
    await supabase.rpc('admin_release_import_lock', { p_lock_key: IMPORT_LOCK_KEY });
  } catch (error) {
    console.error('[exercise-import:lock] Falha ao liberar lock.', {
      message: sanitizeErrorMessage(error)
    });
  }
}

async function createImportJob(supabase, payload) {
  var result = await supabase.from('admin_import_jobs').insert(payload).select('id').single();
  if (result.error) {
    throw new Error('Falha ao criar job de importação.');
  }
  return result.data.id;
}

async function updateImportJob(supabase, jobId, patch) {
  if (!jobId) {
    throw new Error('Falha ao atualizar admin_import_jobs: jobId ausente.');
  }

  var result = await supabase.from('admin_import_jobs').update(patch).eq('id', jobId);
  if (result.error) {
    throw new Error('Falha ao atualizar admin_import_jobs.');
  }
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
    throw new Error('Formato inválido do JSON de exercícios. Esperado array ou objeto com chave "exercises".');
  }

  return exercises;
}

async function getExercisesCount(supabase) {
  var countResult = await supabase.from('exercises').select('*', { count: 'exact', head: true });
  if (countResult.error) {
    throw new Error('Falha ao consultar total da tabela exercises.');
  }
  return countResult.count || 0;
}

async function runExerciseImport(options) {
  var opts = options || {};
  var batchSize = opts.batchSize;
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    batchSize = DEFAULT_BATCH_SIZE;
  }

  var batchDelayMs = opts.batchDelayMs == null ? 200 : opts.batchDelayMs;
  var exercisesFile = opts.exercisesFile || getExercisesFile();
  var limit = opts.limit;
  var dryRun = opts.dryRun === true;
  var requestedBy = opts.requestedBy || 'unknown';
  var lockAlreadyHeld = opts.lockAlreadyHeld === true;
  var logger = typeof opts.logger === 'function' ? opts.logger : function() {};

  if (limit != null && (!Number.isInteger(limit) || limit <= 0)) {
    throw new Error('limit inválido. Use um inteiro positivo.');
  }

  var supabase = createSupabaseAdminClient();
  var lockAcquired = false;
  var jobId = null;
  var started = new Date().toISOString();
  var exercises = await loadExercisesFromFile(exercisesFile);
  validateDuplicates(exercises);

  var sourceExercises = limit == null ? exercises : exercises.slice(0, limit);
  var batches = chunk(sourceExercises, batchSize);
  var processedBatches = 0;
  var importedOrUpdated = 0;
  var failedBatch = null;
  var finalExercisesCount = null;

  try {
    if (!lockAlreadyHeld) {
      var running = await hasRunningImport(supabase);
      if (running) {
        return {
          jobId: null,
          started: started,
          dryRun: dryRun,
          totalExercises: sourceExercises.length,
          batchSize: batchSize,
          totalBatches: batches.length,
          processedBatches: 0,
          importedOrUpdated: 0,
          totalInTable: null,
          status: 'already_running',
          failedBatch: null
        };
      }

      lockAcquired = await acquireImportLock(supabase);
      if (!lockAcquired) {
        return {
          jobId: null,
          started: started,
          dryRun: dryRun,
          totalExercises: sourceExercises.length,
          batchSize: batchSize,
          totalBatches: batches.length,
          processedBatches: 0,
          importedOrUpdated: 0,
          totalInTable: null,
          status: 'already_running',
          failedBatch: null
        };
      }
    }

    jobId = await createImportJob(supabase, {
      job_type: JOB_TYPE,
      status: 'running',
      lock_key: IMPORT_LOCK_KEY,
      requested_by: requestedBy,
      total_exercises: sourceExercises.length,
      total_batches: batches.length,
      processed_batches: 0,
      imported_or_updated: 0,
      failed_batch: null,
      dry_run: dryRun,
      limit_count: limit == null ? null : limit,
      batch_size: batchSize,
      metadata: { source: 'data/exercises.json', started: started }
    });

    logger('Iniciando importação: total=' + sourceExercises.length + ', batchSize=' + batchSize + ', lotes=' + batches.length + ', dryRun=' + dryRun + '.');

    for (var index = 0; index < batches.length; index += 1) {
      var batch = batches[index];
      var batchNumber = index + 1;
      logger('Processando lote ' + batchNumber + '/' + batches.length + ' (' + batch.length + ' exercícios).');

      if (!dryRun) {
        var rpc = await supabase.rpc('import_exercises_json', { payload: batch });
        if (rpc.error) {
          failedBatch = batchNumber;
          throw new Error('Erro no lote ' + batchNumber + '/' + batches.length + ': ' + sanitizeErrorMessage(rpc.error));
        }
        importedOrUpdated += batch.length;
      }

      processedBatches += 1;
      await updateImportJob(supabase, jobId, {
        processed_batches: processedBatches,
        imported_or_updated: dryRun ? 0 : importedOrUpdated
      });

      logger('Lote ' + batchNumber + '/' + batches.length + ' concluído com sucesso.');
      if (batchNumber < batches.length && batchDelayMs > 0) {
        await sleep(batchDelayMs);
      }
    }

    if (!dryRun) {
      finalExercisesCount = await getExercisesCount(supabase);
    }

    await updateImportJob(supabase, jobId, {
      status: 'completed',
      finished_at: new Date().toISOString(),
      processed_batches: processedBatches,
      imported_or_updated: dryRun ? 0 : importedOrUpdated
    });

    return {
      jobId: jobId,
      status: 'completed',
      dryRun: dryRun,
      totalExercises: sourceExercises.length,
      batchSize: batchSize,
      totalBatches: batches.length,
      processedBatches: processedBatches,
      importedOrUpdated: dryRun ? 0 : importedOrUpdated,
      totalInTable: finalExercisesCount,
      failedBatch: null
    };
  } catch (error) {
    var updateError = null;

    if (jobId) {
      try {
        await updateImportJob(supabase, jobId, {
          status: 'failed',
          finished_at: new Date().toISOString(),
          failed_batch: failedBatch,
          error_message: sanitizeErrorMessage(error),
          processed_batches: processedBatches,
          imported_or_updated: dryRun ? 0 : importedOrUpdated
        });
      } catch (innerError) {
        updateError = innerError;
      }
    }

    if (updateError) {
      throw new Error('Falha durante importação e também ao persistir status de erro em admin_import_jobs.');
    }

    throw error;
  } finally {
    logger('Finalização do import.');
    if (!lockAlreadyHeld && lockAcquired) {
      await releaseImportLock(supabase);
    }
  }
}

module.exports = {
  JOB_TYPE: JOB_TYPE,
  IMPORT_LOCK_KEY: IMPORT_LOCK_KEY,
  DEFAULT_BATCH_SIZE: DEFAULT_BATCH_SIZE,
  DEFAULT_EXERCISES_FILE: DEFAULT_EXERCISES_FILE,
  chunk: chunk,
  createSupabaseAdminClient: createSupabaseAdminClient,
  getExercisesCount: getExercisesCount,
  getExercisesFile: getExercisesFile,
  hasRunningImport: hasRunningImport,
  loadExercisesFromFile: loadExercisesFromFile,
  runExerciseImport: runExerciseImport,
  sanitizeErrorMessage: sanitizeErrorMessage,
  validateRequiredEnv: validateRequiredEnv
};
