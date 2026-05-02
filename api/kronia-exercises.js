var cors = require('../src/server/apihelpers/_cors');
var auth = require('../src/server/apihelpers/_auth');
var rl   = require('../src/server/apihelpers/_ratelimit');

var _ExerciseApp    = null;
var _adminClient    = null;
var _loadAttempted  = false;
var _loadError      = null;

function ensureModulesLoaded() {
  if (_loadAttempted) return _loadError;
  _loadAttempted = true;
  try {
    var appMod      = require('../src/lib/exercises/application');
    var supabaseMod = require('../src/lib/supabase/admin');
    _ExerciseApp = appMod.KroniaExerciseApplication;
    _adminClient = supabaseMod.createAdminSupabaseClient;
    return null;
  } catch (err) {
    _loadError = err;
    console.error('[api/kronia-exercises] dependency load failed:', err && err.message ? err.message : String(err));
    return err;
  }
}

function buildSuccessPayload(data, meta) {
  return { success: true, type: 'exercise_details', message: 'Detalhes do exercício carregados com sucesso.', data: data, meta: meta || {} };
}

function buildPartialPayload(message, data, meta) {
  return { success: false, type: 'exercise_partial', message: message, data: data, meta: meta || {} };
}

function buildErrorPayload(message, code, meta, data) {
  return { success: false, type: 'exercise_error', message: message, error: { code: code || 'EXERCISE_ERROR' }, data: data || null, meta: meta || {} };
}

function normalizeEnvelope(result) {
  var meta = result.meta || {};
  var knownResolution = Number((meta && meta.confidenceScore) || 0) >= 0.9;
  var firstError = result.errors && result.errors[0];

  if (result.status === 'success' && result.data) {
    return { payload: buildSuccessPayload(result.data, Object.assign({}, meta, { knownResolution: knownResolution })), httpStatus: 200 };
  }

  if (!result.data) {
    var errorCode = (firstError && firstError.code) || 'EXERCISE_ERROR';
    return {
      payload: buildErrorPayload(
        (firstError && firstError.message) || 'Não foi possível carregar os detalhes do exercício.',
        errorCode,
        meta,
        null
      ),
      httpStatus: errorCode === 'EXERCISE_NOT_FOUND' ? 404 : 422,
    };
  }

  return {
    payload: buildPartialPayload(
      (firstError && firstError.message) || 'Não foi possível enriquecer os detalhes do exercício agora.',
      result.data,
      Object.assign({}, meta, { code: (firstError && firstError.code) || 'EXERCISE_PARTIAL', knownResolution: knownResolution })
    ),
    httpStatus: 206,
  };
}

module.exports = async function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  var loadErr = ensureModulesLoaded();
  if (loadErr) {
    return res.status(503).json(buildErrorPayload(
      'Serviço de exercícios temporariamente indisponível.',
      'SERVICE_UNAVAILABLE',
      { cause: loadErr && loadErr.message ? loadErr.message : String(loadErr) }
    ));
  }

  return auth.requireAuth(req, res, function(user) {
    return rl.rateLimit(req, res, async function() {
      try {
        var exerciseId   = '';
        var slug         = '';
        var lookupKey    = '';
        var exerciseName = '';
        var locale       = 'pt';

        if (req.method === 'GET') {
          var q = req.query || {};
          exerciseId   = String(q.id || '').trim();
          slug         = String(q.slug || '').trim();
          lookupKey    = String(q.lookupKey || q.normalized_lookup_key || '').trim();
          exerciseName = exerciseName || lookupKey || slug;
        } else if (req.method === 'POST') {
          var body = req.body || {};
          if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
          exerciseId   = typeof body.exerciseId === 'string'           ? body.exerciseId.slice(0, 120)           : '';
          slug         = typeof body.slug === 'string'                 ? body.slug.slice(0, 240)                 : '';
          lookupKey    = typeof body.normalized_lookup_key === 'string' ? body.normalized_lookup_key.slice(0, 240)
                       : (typeof body.normalizedLookupKey === 'string'  ? body.normalizedLookupKey.slice(0, 240)   : '');
          exerciseName = typeof body.exerciseName === 'string'         ? body.exerciseName.slice(0, 240)         : '';
          locale       = body.locale === 'en' ? 'en' : 'pt';
        } else {
          return res.status(405).end();
        }

        if (!exerciseId && !slug && !lookupKey) {
          return res.status(400).json(buildErrorPayload('Informe id, slug ou lookupKey.', 'VALIDATION_ERROR'));
        }

        var adminClient = _adminClient();
        var service     = new _ExerciseApp(adminClient);
        var result      = await service.getExerciseDetailsByName({
          userId:             user.id,
          exerciseId:         exerciseId   || undefined,
          slug:               slug         || undefined,
          normalizedLookupKey: lookupKey   || undefined,
          exerciseName:       exerciseName || lookupKey || slug || undefined,
          locale:             locale,
        });

        var envelope = normalizeEnvelope(result);
        return res.status(envelope.httpStatus).json(envelope.payload);
      } catch (err) {
        console.error('[api/kronia-exercises] erro interno:', err && err.message ? err.message : String(err));
        return res.status(500).json(buildErrorPayload(
          'Falha ao buscar detalhes do exercício.',
          'INTERNAL_ERROR',
          { cause: err && err.message ? err.message : 'unknown' }
        ));
      }
    });
  });
};
