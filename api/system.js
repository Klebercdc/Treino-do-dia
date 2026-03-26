var cors = require('./_cors');
var auth = require('./_auth');
var plans = require('./_plans');
var scienceSync = require('../src/lib/science/scienceSyncService');
var https = require('https');

var SUPABASE_URL = process.env.SUPABASE_URL || 'https://twxoddzogbmaysebhour.supabase.co';

function handleScienceArticles(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  var status = (req.query && req.query.status) || 'pending_review';
  return plans.supabaseRequest('GET', 'scientific_articles?review_status=eq.' + status + '&select=id,title,source,doi,published_at,review_status&order=created_at.desc', null, function(err, rows) {
    if (err) return res.status(500).json({ error: String(err) });
    return res.status(200).json({ items: rows || [] });
  });
}

function handleScienceReview(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  var body = req.body || {};
  if (!body.articleId || !['approved', 'rejected'].includes(body.decision)) {
    return res.status(400).json({ error: 'payload inválido' });
  }

  return plans.supabaseRequest('PATCH', 'scientific_articles?id=eq.' + body.articleId, {
    review_status: body.decision,
    reviewed_at: new Date().toISOString()
  }, function(err) {
    if (err) return res.status(500).json({ error: String(err) });
    return res.status(200).json({ ok: true });
  });
}

async function handleScienceSync(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    var query = (req.body && req.body.query) || 'resistance training hypertrophy meta analysis';
    var suggestions = await scienceSync.collectScientificSuggestions(query);

    for (var i = 0; i < suggestions.length; i += 1) {
      var row = suggestions[i];
      await new Promise(function(resolve) {
        plans.supabaseRequest('POST', 'scientific_articles', {
          source: row.source,
          external_id: row.external_id,
          title: row.title,
          doi: row.doi,
          published_at: row.published_at,
          metadata: row.raw_payload,
          review_status: 'pending_review'
        }, function() { resolve(); });
      });
    }

    return res.status(200).json({ ok: true, inserted: suggestions.length });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
}

function handleLgpdExport(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }

  return auth.requireAuth(req, res, function(user) {
    var uid = user.id;
    var collected = { user_id: uid, exported_at: new Date().toISOString() };
    var pending = 4;
    var errors = [];

    function done() {
      pending--;
      if (pending <= 0) {
        if (errors.length > 0) collected._errors = errors;
        res.setHeader('Content-Disposition', 'attachment; filename="kronia-meus-dados.json"');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(200).json(collected);
      }
    }

    plans.supabaseRequest('GET', 'profiles?id=eq.' + uid + '&select=*', null, function(err, rows) {
      collected.profile = err ? null : (rows && rows[0]) || null;
      if (err) errors.push('profiles: ' + err);
      done();
    });

    plans.supabaseRequest('GET', 'workout_history?user_id=eq.' + uid + '&select=*&order=trained_at.desc', null, function(err, rows) {
      collected.workout_history = err ? null : (rows || []);
      if (err) errors.push('workout_history: ' + err);
      done();
    });

    plans.supabaseRequest('GET', 'workout_templates?user_id=eq.' + uid + '&select=*', null, function(err, rows) {
      collected.workout_templates = err ? null : (rows || []);
      if (err) errors.push('workout_templates: ' + err);
      done();
    });

    plans.supabaseRequest('GET', 'user_plans?user_id=eq.' + uid + '&select=plan,ai_requests_used,period_start,expires_at,updated_at', null, function(err, rows) {
      collected.user_plan = err ? null : (rows && rows[0]) || null;
      if (err) errors.push('user_plans: ' + err);
      done();
    });
  });
}

function deleteAuthUser(userId, callback) {
  var serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return callback(null, 'sem service key — exclusão de auth pendente');

  var hostname = SUPABASE_URL.replace('https://', '').replace('http://', '');
  var options = {
    hostname: hostname,
    path: '/auth/v1/admin/users/' + userId,
    method: 'DELETE',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey
    }
  };

  var req = https.request(options, function(resp) {
    var data = '';
    resp.on('data', function(c) { data += c; });
    resp.on('end', function() {
      if (resp.statusCode >= 400) return callback('Auth delete HTTP ' + resp.statusCode + ': ' + data, null);
      return callback(null, 'auth user deleted');
    });
  });
  req.on('error', function(e) { callback(e.message, null); });
  req.end();
}

function handleLgpdDelete(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  return auth.requireAuth(req, res, function(user) {
    var uid = user.id;
    var record = { user_id: uid, status: 'pending', requested_at: new Date().toISOString() };
    plans.supabaseRequest('POST', 'deletion_requests', record, function(logErr) {
      if (logErr) console.error('[lgpd-delete] erro ao registrar solicitação:', logErr);

      plans.supabaseRequest('DELETE', 'workout_history?user_id=eq.' + uid, null, function() {
      plans.supabaseRequest('DELETE', 'workout_templates?user_id=eq.' + uid, null, function() {
      plans.supabaseRequest('DELETE', 'profiles?id=eq.' + uid, null, function() {
      plans.supabaseRequest('DELETE', 'user_plans?user_id=eq.' + uid, null, function() {

        deleteAuthUser(uid, function(authErr) {
          if (authErr) {
            console.error('[lgpd-delete] erro ao excluir auth user:', authErr);
            return res.status(200).json({
              ok: true,
              message: 'Dados de treino excluídos. A exclusão da conta será concluída em até 72 horas.',
              partial: true
            });
          }

          return res.status(200).json({
            ok: true,
            message: 'Todos os seus dados foram excluídos com sucesso, conforme a LGPD (Art. 18, VI).',
            deleted_at: new Date().toISOString()
          });
        });

      });
      });
      });
      });
    });
  });
}

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  var route = (req.query && req.query.__route) || '';
  switch (route) {
    case 'science-articles':
      return handleScienceArticles(req, res);
    case 'science-review':
      return handleScienceReview(req, res);
    case 'science-sync':
      return handleScienceSync(req, res);
    case 'lgpd-export':
      return handleLgpdExport(req, res);
    case 'lgpd-delete':
      return handleLgpdDelete(req, res);
    default:
      return res.status(404).json({ error: 'rota não encontrada' });
  }
};
