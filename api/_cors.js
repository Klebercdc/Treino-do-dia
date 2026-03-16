/**
 * Helper de CORS — aplica whitelist de origens permitidas.
 * Somente o domínio de produção e localhost em dev são aceitos.
 * Em produção (VERCEL_ENV=production), localhost é bloqueado.
 */

var PROD_ORIGINS = ['https://treino-do-dia-orpin.vercel.app'];
var DEV_ORIGINS  = ['http://localhost:3000', 'http://localhost:5173'];

var ALLOWED_ORIGINS = process.env.VERCEL_ENV === 'production'
  ? PROD_ORIGINS
  : PROD_ORIGINS.concat(DEV_ORIGINS);

function setCors(req, res) {
  var origin = req.headers['origin'] || '';
  var allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

module.exports = { setCors: setCors };
