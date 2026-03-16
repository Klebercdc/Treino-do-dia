/**
 * GET /api/config
 * Retorna configurações públicas do app (não sensíveis).
 * A URL de checkout é lida da variável de ambiente CHECKOUT_URL,
 * evitando hardcode no frontend.
 *
 * Variável necessária no Vercel:
 *   CHECKOUT_URL = https://pay.hotmart.com/SEU_PRODUTO_ID
 */

var cors = require('./_cors');

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET')    { res.status(405).end(); return; }

  var checkoutUrl = process.env.CHECKOUT_URL || '';

  res.status(200).json({
    checkoutUrl:    checkoutUrl,
    freePlanLimit:  parseInt(process.env.FREE_AI_LIMIT || '15', 10)
  });
};
