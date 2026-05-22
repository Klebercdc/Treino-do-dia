'use strict';

var auth = require('../src/server/apihelpers/_auth');
var cors = require('../src/server/apihelpers/_cors');
var rl = require('../src/server/apihelpers/_ratelimit');
var responseUtil = require('../src/server/apihelpers/_response');

module.exports = function (req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return responseUtil.sendJson(res, 405, {
      success: false,
      error: 'Method not allowed',
    });
  }

  auth.requireAuth(req, res, function (user) {
    rl.rateLimit(req, res, async function () {
      try {
        var message =
          req.body && typeof req.body.message === 'string'
            ? req.body.message.trim()
            : '';

        if (!message) {
          return responseUtil.sendJson(res, 400, {
            success: false,
            error: 'O campo "message" é obrigatório.',
          });
        }

        var agentModule = await import('../src/lib/agents/kronosAgent.js');
        var result = await agentModule.runKronosAgent(user.id, message);

        return responseUtil.sendJson(res, 200, {
          success: true,
          resposta: result.resposta,
          iteracoes: result.iteracoes,
        });
      } catch (err) {
        return responseUtil.sendJson(res, 500, {
          success: false,
          error: 'Erro interno do agente KRONOS.',
          meta: {
            message:
              err && err.message ? err.message : String(err || 'unknown'),
          },
        });
      }
    });
  });
};
