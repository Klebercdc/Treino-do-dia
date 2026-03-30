/**
 * _response.js — BLOCO 1
 * Envelope JSON padronizado para todas as rotas de chat.
 *
 * Contrato:
 *   success  boolean
 *   type     string  ('greeting' | 'workout_intent' | 'diet_intent' | 'general' | 'error')
 *   action   string | null  ('open_workout_flow' | 'open_diet_flow' | null)
 *   message  string  (texto visível ao usuário)
 *   data     object | null
 *   error    string | null  (código de erro, ex: 'PROVIDER_UNAVAILABLE')
 *   meta     object  (flags internas: local, fallback, tokensSaved...)
 */

function createApiEnvelope(partial) {
  var p = partial || {};
  return {
    success: typeof p.success === 'boolean' ? p.success : true,
    type:    typeof p.type   === 'string'  ? p.type    : 'general',
    action:  p.action  !== undefined       ? p.action  : null,
    message: typeof p.message === 'string' ? p.message : '',
    data:    p.data    !== undefined       ? p.data    : null,
    error:   p.error   !== undefined       ? p.error   : null,
    meta:    (p.meta && typeof p.meta === 'object') ? p.meta : {}
  };
}

/**
 * Envia sempre Content-Type application/json; charset=utf-8.
 * Nunca deixa o backend retornar HTML, texto puro ou stack trace.
 */
function sendJson(res, statusCode, payload) {
  var body;
  try {
    body = JSON.stringify(payload);
  } catch (e) {
    body = JSON.stringify({
      success: false, type: 'error', action: null,
      message: 'Erro interno de serialização.',
      data: null, error: 'SERIALIZATION_ERROR', meta: {}
    });
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(statusCode).end(body);
}

module.exports = { createApiEnvelope: createApiEnvelope, sendJson: sendJson };
