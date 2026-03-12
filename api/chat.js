var https = require(`https`);

var TREINO_SYSTEM = `Você é o TITAN COACH. Responda SOMENTE com JSON válido, sem texto antes ou depois, sem markdown.
Formato obrigatório exato:
{"treinos":[{"nome":"A","grupo":"Peito/Tríceps","exercicios":[{"nome":"Supino Reto","series":4,"reps":"8-12","tipo":"forca"}]}]}
Regras:
- Use nome A, B, C, D, E para cada dia
- 4-6 exercicios por treino
- Para cardio use tipo "cardio" e reps como "30min"
- Adapte ao objetivo e frequencia do usuario
- APENAS JSON. Absolutamente nada mais.`;

var COACH_SYSTEM = `Você é o TITAN COACH, personal trainer do usuário integrado ao app TITAN PRO.
Máximo 120 palavras. Português informal. Use dados reais do histórico quando disponível.`;

function callNvidia(messages, system, maxTokens, callback) {
  var m = [];
  if (system) m.push({ role: `system`, content: system });
  messages.forEach(function(x) { m.push(x); });
  var p = JSON.stringify({ model: `meta/llama-3.1-70b-instruct`, messages: m, max_tokens: maxTokens, temperature: 0.3, stream: false });
  var o = { hostname: `integrate.api.nvidia.com`, path: `/v1/chat/completions`, method: `POST`, headers: { [`Content-Type`]: `application/json`, [`Authorization`]: `Bearer ` + process.env.NVIDIA_API_KEY, [`Content-Length`]: Buffer.byteLength(p) } };
  var r = https.request(o, function(s) {
    var d = ``;
    s.on(`data`, function(c) { d += c; });
    s.on(`end`, function() {
      try {
        var j = JSON.parse(d);
        callback(null, (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ``);
      } catch(e) { callback(e.message, null); }
    });
  });
  r.on(`error`, function(e) { callback(e.message, null); });
  r.write(p);
  r.end();
}

module.exports = function(req, res) {
  res.setHeader(`Access-Control-Allow-Origin`, `*`);
  res.setHeader(`Access-Control-Allow-Methods`, `POST, OPTIONS`);
  res.setHeader(`Access-Control-Allow-Headers`, `Content-Type`);
  if (req.method === `OPTIONS`) { res.status(200).end(); return; }
  if (req.method !== `POST`) { res.status(405).end(); return; }
  if (!process.env.NVIDIA_API_KEY) { res.status(500).json({ error: `KEY missing` }); return; }

  var b = req.body || {};
  var isGerarTreino = b.isGerarTreino === true;

  if (isGerarTreino) {
    // Tentar até 3 vezes para garantir JSON válido
    var userMsg = (b.messages || []).slice(-1)[0] || { role: `user`, content: `Gere um treino` };
    var tentativas = 0;

    function tentar() {
      tentativas++;
      callNvidia([userMsg], TREINO_SYSTEM, 1200, function(err, text) {
        if (err) { return res.status(500).json({ error: err }); }
        try {
          // Limpar markdown se houver
          var clean = text.replace(/```json|```/g, ``).trim();
          // Encontrar JSON
          var start = clean.indexOf(`{`);
          var end = clean.lastIndexOf(`}`);
          if (start === -1 || end === -1) throw new Error(`no json`);
          var parsed = JSON.parse(clean.slice(start, end + 1));
          if (!parsed.treinos || !Array.isArray(parsed.treinos) || parsed.treinos.length === 0) throw new Error(`invalid`);
          return res.status(200).json({ content: [{ type: `workout_json`, data: parsed }] });
        } catch(e) {
          if (tentativas < 3) return tentar();
          // Fallback: retornar texto
          return res.status(200).json({ content: [{ type: `text`, text: text }] });
        }
      });
    }
    tentar();

  } else {
    var system = b.system || COACH_SYSTEM;
    callNvidia(b.messages || [], system, 800, function(err, text) {
      if (err) { return res.status(500).json({ error: err }); }
      res.status(200).json({ content: [{ type: `text`, text: text }] });
    });
  }
};