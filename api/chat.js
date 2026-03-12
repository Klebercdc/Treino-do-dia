var https = require(`https`);

var TREINO_SYSTEM = `Você é o TITAN COACH. Responda SOMENTE com JSON válido, sem texto antes ou depois, sem markdown. Formato: {"treinos":[{"nome":"A","grupo":"Peito","exercicios":[{"nome":"Supino Reto","series":4,"reps":"8-12"}]}]} Use nomes A,B,C,D,E. 4-6 exercicios por treino. APENAS JSON.`;

var COACH_SYSTEM = `Você é o TITAN COACH, personal trainer integrado ao TITAN PRO. Máximo 120 palavras. Português informal.`;

function isPedidoDeTreino(messages) {
  var ultima = (messages.slice(-1)[0] || {}).content || ``;
  return /\b(cri(e|ar?)|ger(e|ar?)|mont(e|ar?)|faz(er?)?|elabor(e|ar?))\b.{0,30}\b(treino|programa|plano|semana)/i.test(ultima);
}

function callNvidia(system, messages, maxTokens, temp, callback) {
  var KEY = process.env.NVIDIA_API_KEY;
  if (!KEY) return callback(`NVIDIA_API_KEY missing`, null);
  var m = [];
  if (system) m.push({ role: `system`, content: system });
  messages.forEach(function(x) { m.push(x); });
  var body = JSON.stringify({ model: `meta/llama-3.1-70b-instruct`, messages: m, max_tokens: maxTokens, temperature: temp, stream: false });
  var o = { hostname: `integrate.api.nvidia.com`, path: `/v1/chat/completions`, method: `POST`, headers: { [`Content-Type`]: `application/json`, [`Authorization`]: `Bearer ` + KEY, [`Content-Length`]: Buffer.byteLength(body) } };
  var r = https.request(o, function(s) {
    var d = ``;
    s.on(`data`, function(c) { d += c; });
    s.on(`end`, function() {
      try {
        var j = JSON.parse(d);
        callback(null, (j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||``);
      } catch(e) { callback(e.message, null); }
    });
  });
  r.on(`error`, function(e) { callback(e.message, null); });
  r.write(body);
  r.end();
}

function parseWorkout(text) {
  var clean = text.replace(/```json|```/g,``).trim();
  var s = clean.indexOf(`{`), e = clean.lastIndexOf(`}`);
  if (s===-1||e===-1) throw new Error(`no json`);
  var p = JSON.parse(clean.slice(s,e+1));
  if (!p.treinos||!p.treinos.length) throw new Error(`invalid`);
  return p;
}

function extrairDoTexto(text) {
  var grupos = [], atual = null;
  text.split(`\n`).map(function(l){return l.trim();}).filter(Boolean).forEach(function(linha) {
    if (/^[*#]?\s*(treino\s+[A-Z]|dia\s+\d+)/i.test(linha)) {
      var nome = linha.replace(/[*#()\[\]]/g,``).replace(/treino\s*/i,``).trim().substring(0,12);
      atual = {nome:nome,grupo:``,exercicios:[]}; grupos.push(atual); return;
    }
    if (!/^(\d+[.)]\s+|[*•\-+]\s+)[A-Za-zÀ-ú]/.test(linha)) return;
    if (/segunda|terça|quarta|quinta|sexta|sábado|domingo/i.test(linha)) return;
    var nome = linha.replace(/^[\d.)*\-•+\s]+/,``).split(/[:(\-–]/)[0].trim();
    if (nome.length<3) return;
    var sm=linha.match(/(\d+)\s*s[eé]ries?/i), rm=linha.match(/(\d+[-–]\d+|\d+)\s*reps?/i);
    if (!atual){atual={nome:`A`,grupo:``,exercicios:[]};grupos.push(atual);}
    atual.exercicios.push({nome:nome,series:sm?parseInt(sm[1]):3,reps:rm?rm[1]:`8-12`});
  });
  var validos = grupos.filter(function(g){return g.exercicios.length>0;});
  if (!validos.length) throw new Error(`no exercises`);
  return {treinos:validos};
}

function gerarTreino(userMsg, callback) {
  callNvidia(TREINO_SYSTEM, [userMsg], 1200, 0.1, function(err, text) {
    try { return callback(null, parseWorkout(text||``)); } catch(e) {}
    try { return callback(null, extrairDoTexto(text||``)); } catch(e2) {}
    // segunda tentativa
    callNvidia(TREINO_SYSTEM, [{role:`user`,content:`JSON apenas: `+userMsg.content}], 1200, 0.0, function(err2, text2) {
      try { return callback(null, parseWorkout(text2||``)); } catch(e3) {}
      try { return callback(null, extrairDoTexto(text2||``)); } catch(e4) {}
      callback(`Não consegui gerar o treino. Tente novamente.`, null);
    });
  });
}

module.exports = function(req, res) {
  res.setHeader(`Access-Control-Allow-Origin`,`*`);
  res.setHeader(`Access-Control-Allow-Methods`,`POST, OPTIONS`);
  res.setHeader(`Access-Control-Allow-Headers`,`Content-Type`);
  if (req.method===`OPTIONS`){res.status(200).end();return;}
  if (req.method!==`POST`){res.status(405).end();return;}
  if (!process.env.NVIDIA_API_KEY){res.status(500).json({error:`NVIDIA_API_KEY missing`});return;}

  var b = req.body||{};
  var messages = b.messages||[];
  var isGerarTreino = b.isGerarTreino===true || isPedidoDeTreino(messages);
  var userMsg = messages.slice(-1)[0]||{role:`user`,content:`Gere um treino`};

  if (isGerarTreino) {
    gerarTreino(userMsg, function(err, data) {
      if (err) return res.status(200).json({content:[{type:`text`,text:`⚠️ `+err}]});
      res.status(200).json({content:[{type:`workout_json`,data:data}]});
    });
  } else {
    callNvidia(b.system||COACH_SYSTEM, messages, 800, 0.75, function(err, text) {
      if (err) return res.status(500).json({error:err});
      res.status(200).json({content:[{type:`text`,text:text}]});
    });
  }
};