/**
 * Helper de CORS — aplica whitelist de origens permitidas.
 * Somente o domínio de produção e localhost em dev são aceitos.
 * Em produção (VERCEL_ENV=production), localhost é bloqueado.
 */

var PROD_ORIGINS = [
  'https://treino-do-dia-orpin.vercel.app',
  'https://kronia.app.br',
  'https://www.kronia.app.br'
];
var DEV_ORIGINS  = ['http://localhost:3000', 'http://localhost:5173'];

var ALLOWED_ORIGINS = process.env.VERCEL_ENV === 'production'
  ? PROD_ORIGINS
  : PROD_ORIGINS.concat(DEV_ORIGINS);

var ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
var ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Request-Id',
  'X-Cron-Secret',
  'Cron-Secret'
].join(', ');

function setCors(req, res) {
  var origin = req.headers['origin'] || '';
  var allowed = ALLOWED_ORIGINS.includes(origin) ? origin : null;

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', allowed);
  }
  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  res.setHeader('Vary', 'Origin');
}

module.exports = { setCors: setCors };
