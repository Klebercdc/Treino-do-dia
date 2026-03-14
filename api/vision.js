var https = require('https');

var VISION_SYSTEM = `Você é o TITAN COACH, o coach pessoal de musculação e nutrição do app TITAN PRO.
Analise imagens relacionadas a treino, nutrição, progresso físico ou exercícios.
Responda em português brasileiro, de forma direta e prática. Máximo 300 palavras.`;

var VALID_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function callClaude(messages, callback) {
  var KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return callback('ANTHROPIC_API_KEY missing', null);

  var body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: VISION_SYSTEM,
    messages: messages
  });

  var options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  var req = https.request(options, function(s) {
    var d = '';
    s.on('data', function(c) { d += c; });
    s.on('end', function() {
      try {
        var j = JSON.parse(d);
        if (j.type === 'error') return callback('API Error: ' + s.statusCode + ' ' + JSON.stringify(j.error), null);
        var text = (j.content && j.content[0] && j.content[0].text) || '';
        callback(null, text);
      } catch (e) { callback(e.message, null); }
    });
  });
  req.on('error', function(e) { callback(e.message, null); });
  req.setTimeout(30000, function() { req.destroy(new Error('timeout')); });
  req.write(body);
  req.end();
}

module.exports = function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(500).json({ error: 'ANTHROPIC_API_KEY missing' }); return; }

  var b = req.body || {};
  var imageBase64 = b.imageBase64;
  var text = b.text || 'Analise esta imagem';

  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

  // Ensure media_type is always a valid value — fixes the "media_type: Field required" error
  var mediaType = VALID_MEDIA_TYPES.includes(b.imageMediaType) ? b.imageMediaType : 'image/jpeg';

  var content = [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: imageBase64
      }
    },
    { type: 'text', text: text }
  ];

  callClaude([{ role: 'user', content: content }], function(err, reply) {
    if (err) return res.status(500).json({ error: err });
    res.status(200).json({ content: [{ type: 'text', text: reply }] });
  });
};
