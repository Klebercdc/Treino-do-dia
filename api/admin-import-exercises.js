var exerciseImport = require('../src/server/internal/exerciseImport');

function isAuthorized(req) {
  var expected = process.env.IMPORT_ADMIN_KEY;
  var provided = req.headers['x-admin-key'];

  if (!expected) {
    return { ok: false, reason: 'IMPORT_ADMIN_KEY não configurada no ambiente.' };
  }

  if (!provided || provided !== expected) {
    return { ok: false, reason: 'x-admin-key inválido.' };
  }

  return { ok: true };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método não permitido. Use POST.' });
  }

  var auth = isAuthorized(req);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, error: auth.reason });
  }

  try {
    var summary = await exerciseImport.runExerciseImport({
      batchSize: 200,
      exercisesFile: exerciseImport.DEFAULT_EXERCISES_FILE,
      batchDelayMs: 200
    });

    return res.status(200).json({
      ok: true,
      message: 'Importação concluída com sucesso.',
      summary: {
        exercisesFile: summary.exercisesFile,
        totalInputExercises: summary.totalInputExercises,
        batchSize: summary.batchSize,
        totalBatches: summary.totalBatches,
        batches: summary.batchLogs,
        finalExercisesCount: summary.finalExercisesCount
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
