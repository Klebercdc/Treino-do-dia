var https = require(`https`);

var TREINO_PROMPT = `Você é o TITAN COACH. Gere um treino em JSON.
RESPONDA APENAS COM JSON, SEM NENHUM TEXTO ANTES OU DEPOIS.
Formato: {"treinos":[{"nome":"A","grupo":"Peito","exercicios":[{"nome":"Supino Reto","series":4,"reps":"8-12"}]}]}
Regras: nomes A/B/C/D/E, 4-6 exercicios por treino, adapte ao objetivo do usuario.`;

var COACH_SYSTEM = `Você é o TITAN COACH, personal trainer integrado ao TITAN PRO. Máximo 120 palavras. Português informal.`;

function callNvidia(system, messages, maxTokens, temp, callback) {
  var KEY = process.env.NVIDIA_API_KEY;
  if (!KEY) return callback(`KEY missing`, null);
  var m = system ? [{ role: `system`, content: system }] : [];
  messages.forEach(function(x) { m.push(x); });
  var body = JSON.stringify({ model: `meta/llama-3.1-70b-instruct`, messages: m, max_tokens: maxTokens, temperature: temp, stream: false });
  var o = { hostname: `integrate.api.nvidia.com`, path: `/v1/chat/completions`, method: `POST`, headers: { [`Content-Type`]: `application/json`, [`Authorization`]: `Bearer ` + KEY, [`Content-Length`]: Buffer.byteLength(body) } };
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
  r.write(body);
  r.end();
}

function extrairExercicios(texto) {
  // Extrai exercícios de qualquer formato de texto
  var grupos = [];
  var grupoAtual = null;
  var linhas = texto.split(`\n`).map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
  
  linhas.forEach(function(linha) {
    // Detectar título de grupo
    var tituloMatch = linha.match(/^[*#]?\s*(treino\s+[A-Z]|dia\s+\d+)/i);
    if (tituloMatch) {
      var nome = linha.replace(/[*#()\[\]]/g, ``).replace(/treino\s*/i, ``).trim().substring(0, 12);
      grupoAtual = { nome: nome, exercicios: [] };
      grupos.push(grupoAtual);
      return;
    }
    // Detectar exercício
    var isEx = /^(\d+[.)]\s+|[*•\-+]\s+)[A-Za-zÀ-ú]/.test(linha);
    if (!isEx) return;
    // Ignorar dias da semana
    if (/segunda|terça|quarta|quinta|sexta|sábado|domingo/i.test(linha)) return;
    var nome = linha.replace(/^[\d.)*\-•+\s]+/, ``).split(/[:(\-–]/)[0].trim();
    if (nome.length < 3) return;
    var sm = linha.match(/(\d+)\s*s[eé]ries?/i);
    var rm = linha.match(/(\d+[-–]\d+|\d+)\s*reps?/i);
    if (!grupoAtual) { grupoAtual = { nome: `A`, exercicios: [] }; grupos.push(grupoAtual); }
    grupoAtual.exercicios.push({ nome: nome, series: sm ? parseInt(sm[1]) : 3, reps: rm ? rm[1] : `8-12` });
  });
  
  return grupos.filter(function(g) { return g.exercicios.length > 0; });
}

function parseJSON(text) {
  var clean = text.replace(/```json|```/g, ``).trim();
  var start = clean.indexOf(`{`);
  var end = clean.lastIndexOf(`}`);
  if (start === -1 || end === -1) throw new Error(`no json`);
  var p = JSON.parse(clean.slice(start, end + 1));
  if (!p.treinos || !Array.isArray(p.treinos) || p.treinos.length === 0) throw new Error(`invalid`);
  return p;
}

module.exports = function(req, res) {
  res.setHeader(`Access-Control-Allow-Origin`, `*`);
  res.setHeader(`Access-Control-Allow-Methods`, `POST, OPTIONS`);
  res.setHeader(`Access-Control-Allow-Headers`, `Content-Type`);
  if (req.method === `OPTIONS`) { res.status(200).end(); return; }
  if (req.method !== `POST`) { res.status(405).end(); return; }

  var b = req.body || {};
  var isGerarTreino = b.isGerarTreino === true;
  var messages = b.messages || [];
  var userMsg = messages.slice(-1)[0] || { role: `user`, content: `Gere um treino` };

  if (!isGerarTreino) {
    callNvidia(b.system || COACH_SYSTEM, messages, 800, 0.75, function(err, text) {
      if (err) return res.status(500).json({ error: err });
      res.status(200).json({ content: [{ type: `text`, text: text }] });
    });
    return;
  }

  // Gerar treino: tentar JSON primeiro (temp baixa = mais obediente)
  callNvidia(TREINO_PROMPT, [userMsg], 1200, 0.1, function(err, text) {
    // Tentar parsear JSON
    try {
      var parsed = parseJSON(text || ``);
      return res.status(200).json({ content: [{ type: `workout_json`, data: parsed }] });
    } catch(e) {}

    // Fallback: extrair do texto
    var grupos = extrairExercicios(text || ``);
    if (grupos.length > 0) {
      return res.status(200).json({ content: [{ type: `workout_json`, data: { treinos: grupos.map(function(g) { return { nome: g.nome, grupo: ``, exercicios: g.exercicios }; }) } }] });
    }

    // Última tentativa com temperatura ainda menor
    callNvidia(TREINO_PROMPT, [{ role: `user`, content: `Responda APENAS com JSON. ` + userMsg.content }], 1200, 0.0, function(err2, text2) {
      try {
        var parsed2 = parseJSON(text2 || ``);
        return res.status(200).json({ content: [{ type: `workout_json`, data: parsed2 }] });
      } catch(e2) {}
      var grupos2 = extrairExercicios(text2 || ``);
      if (grupos2.length > 0) {
        return res.status(200).json({ content: [{ type: `workout_json`, data: { treinos: grupos2.map(function(g) { return { nome: g.nome, grupo: ``, exercicios: g.exercicios }; }) } }] });
      }
      res.status(200).json({ content: [{ type: `text`, text: text2 || `Erro ao gerar treino. Tente novamente.` }] });
    });
  });