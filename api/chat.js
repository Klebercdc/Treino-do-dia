var https = require(`https`);

var TREINO_SYSTEM = `Você é o TITAN COACH. O usuário quer gerar um treino.
Responda SOMENTE com JSON válido, sem texto antes ou depois, sem markdown, sem explicações.
Formato obrigatório:
{"treinos":[{"nome":"A","grupo":"Peito/Tríceps","exercicios":[{"nome":"Supino Reto","series":4,"reps":"8-12"}]}]}
Use quantos treinos forem necessários (A, B, C...). Cada treino 4-6 exercícios. Adapte ao objetivo e frequência do usuário. APENAS JSON.`;

module.exports = function(req, res) {
  res.setHeader(`Access-Control-Allow-Origin`, `*`);
  res.setHeader(`Access-Control-Allow-Methods`, `POST, OPTIONS`);
  res.setHeader(`Access-Control-Allow-Headers`, `Content-Type`);
  if (req.method === `OPTIONS`) { res.status(200).end(); return; }
  if (req.method !== `POST`) { res.status(405).end(); return; }
  var KEY = process.env.NVIDIA_API_KEY;
  if (!KEY) { res.status(500).json({ error: `KEY missing` }); return; }
  var b = req.body || {};
  var isGerarTreino = b.isGerarTreino === true;
  var systemPrompt = isGerarTreino ? TREINO_SYSTEM : (b.system || ``);
  var m = [];
  if (systemPrompt) m.push({ role: `system`, content: systemPrompt });
  (b.messages || []).forEach(function(x) { m.push(x); });
  var p = JSON.stringify({ model: `meta/llama-3.1-70b-instruct`, messages: m, max_tokens: 1000, temperature: 0.7, stream: false });
  var o = { hostname: `integrate.api.nvidia.com`, path: `/v1/chat/completions`, method: `POST`, headers: { [`Content-Type`]: `application/json`, [`Authorization`]: `Bearer ` + KEY, [`Content-Length`]: Buffer.byteLength(p) } };
  var r = https.request(o, function(s) {
    var d = ``;
    s.on(`data`, function(c) { d += c; });
    s.on(`end`, function() {
      try {
        var j = JSON.parse(d);
        var t = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ``;
        if (isGerarTreino) {
          try {
            var jm = t.match(/\{[\s\S]*"treinos"[\s\S]*\}/);
            if (jm) {
              var parsed = JSON.parse(jm[0]);
              return res.status(200).json({ content: [{ type: `workout_json`, data: parsed }] });
            }
          } catch(e2) {}
        }
        res.status(200).json({ content: [{ type: `text`, text: t }] });
      } catch(e) { res.status(500).json({ error: d.slice(0, 100) }); }
    });
  });
  r.on(`error`, function(e) { res.status(500).json({ error: e.message }); });
  r.write(p);
  r.end();
};