/**
 * LGPD — Exportação de dados do usuário (Art. 18, II - LGPD)
 * GET /api/lgpd-export
 * Retorna todos os dados do usuário em JSON.
 */

var auth  = require('./_auth');
var cors  = require('./_cors');
var plans = require('./_plans');

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET')    { res.status(405).end(); return; }

  auth.requireAuth(req, res, function(user) {
    var uid = user.id;
    var collected = { user_id: uid, exported_at: new Date().toISOString() };
    var pending = 3;
    var errors = [];

    function done() {
      pending--;
      if (pending <= 0) {
        if (errors.length > 0) collected._errors = errors;
        res.setHeader('Content-Disposition', 'attachment; filename="titan-pro-meus-dados.json"');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(200).json(collected);
      }
    }

    // Perfil
    plans.supabaseRequest('GET', 'profiles?id=eq.' + uid + '&select=*', null, function(err, rows) {
      collected.profile = err ? null : (rows && rows[0]) || null;
      if (err) errors.push('profiles: ' + err);
      done();
    });

    // Histórico de treinos
    plans.supabaseRequest('GET', 'workout_history?user_id=eq.' + uid + '&select=*&order=trained_at.desc', null, function(err, rows) {
      collected.workout_history = err ? null : (rows || []);
      if (err) errors.push('workout_history: ' + err);
      done();
    });

    // Templates
    plans.supabaseRequest('GET', 'workout_templates?user_id=eq.' + uid + '&select=*', null, function(err, rows) {
      collected.workout_templates = err ? null : (rows || []);
      if (err) errors.push('workout_templates: ' + err);
      done();
    });
  });
};
