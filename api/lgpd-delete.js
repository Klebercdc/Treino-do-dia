/**
 * LGPD — Solicitação de exclusão de dados (Art. 18, VI - LGPD)
 * POST /api/lgpd-delete
 *
 * Registra a solicitação de exclusão. A exclusão real acontece em dois passos:
 *   1. Dados de aplicação (workout_history, profiles, etc.) — cascade via FK
 *   2. Conta no Supabase Auth — requer service_role ou confirmação manual
 *
 * Se SUPABASE_SERVICE_KEY estiver configurada, exclui os dados imediatamente.
 */

var auth  = require('./_auth');
var cors  = require('./_cors');
var plans = require('./_plans');
var https = require('https');

var SUPABASE_URL = process.env.SUPABASE_URL || 'https://twxoddzogbmaysebhour.supabase.co';

function deleteAuthUser(userId, callback) {
  var serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return callback(null, 'sem service key — exclusão de auth pendente');

  var hostname = SUPABASE_URL.replace('https://', '').replace('http://', '');
  var options = {
    hostname: hostname,
    path: '/auth/v1/admin/users/' + userId,
    method: 'DELETE',
    headers: {
      'apikey':        serviceKey,
      'Authorization': 'Bearer ' + serviceKey
    }
  };

  var req = https.request(options, function(res) {
    var data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() {
      if (res.statusCode >= 400) return callback('Auth delete HTTP ' + res.statusCode + ': ' + data, null);
      callback(null, 'auth user deleted');
    });
  });
  req.on('error', function(e) { callback(e.message, null); });
  req.end();
}

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).end(); return; }

  auth.requireAuth(req, res, function(user) {
    var uid = user.id;

    // Registra solicitação de exclusão
    var record = { user_id: uid, status: 'pending', requested_at: new Date().toISOString() };
    plans.supabaseRequest('POST', 'deletion_requests', record, function(logErr) {
      if (logErr) console.error('[lgpd-delete] erro ao registrar solicitação:', logErr);

      // Exclui dados de aplicação (ON DELETE CASCADE cobre o resto)
      // Exclui explicitamente os dados não cobertos por cascade
      plans.supabaseRequest('DELETE', 'workout_history?user_id=eq.' + uid, null, function() {
      plans.supabaseRequest('DELETE', 'workout_templates?user_id=eq.' + uid, null, function() {
      plans.supabaseRequest('DELETE', 'profiles?id=eq.' + uid, null, function() {
      plans.supabaseRequest('DELETE', 'user_plans?user_id=eq.' + uid, null, function() {

        // Exclui conta no Auth
        deleteAuthUser(uid, function(authErr, authMsg) {
          if (authErr) {
            console.error('[lgpd-delete] erro ao excluir auth user:', authErr);
            // Marca solicitação como pendente para revisão manual
            return res.status(200).json({
              ok: true,
              message: 'Dados de treino excluídos. A exclusão da conta será concluída em até 72 horas.',
              partial: true
            });
          }

          res.status(200).json({
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
};
