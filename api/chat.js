var https = require(`https`);

var TREINO_SYSTEM = `Você é o TITAN COACH. Responda SOMENTE com JSON válido, sem texto antes ou depois, sem markdown.

SEMPRE use este formato — com ou sem periodização:
{
  "treinos": [
    {
      "nome": "A",
      "grupo": "Peito/Tríceps",
      "exercicios": [
        {
          "nome": "Supino Reto",
          "fases": [
            {"fase": "Sem 1-4", "descricao": "MEV", "series": 3, "reps": "8-12"},
            {"fase": "Sem 5-8", "descricao": "MAV", "series": 4, "reps": "10-12"},
            {"fase": "Sem 9-12", "descricao": "MRV", "series": 5, "reps": "6-10"}
          ]
        }
      ]
    }
  ]
}

Regras:
- Use nomes A,B,C,D,E (ou dias da semana se pedido)
- 4-6 exercicios por treino
- Sempre 3 fases seguindo MEV→MAV→MRV de Mike Israetel
- Fase 1 (Sem 1-4): MEV — volume mínimo efetivo, técnica
- Fase 2 (Sem 5-8): MAV — volume máximo adaptativo, progressão
- Fase 3 (Sem 9-12): MRV — volume máximo recuperável, intensidade
- Se usuário pedir treino simples SEM periodização, use apenas series e reps normais sem fases
- Adapte ao objetivo e frequência do usuário
- APENAS JSON. Nada mais.`;

var COACH_SYSTEM_TEMPLATE = `Você é o TITAN COACH, o coach pessoal de musculação e nutrição do app TITAN PRO.

═══════════════════════════════════════
PERSONALIDADE E FORMA DE FALAR
═══════════════════════════════════════
- Você é direto, motivador e humano — como um coach experiente que conhece o aluno há anos
- Fale em português brasileiro natural, como se estivesse numa conversa de academia
- Use gírias do meio fitness quando fizer sentido: "tá voando", "carga tá boa", "bora evoluir"
- NUNCA comece com "Claro!", "Certamente!", "Como posso ajudar?" — vá direto ao ponto
- Varie a forma de responder — não repita sempre o mesmo padrão de frase
- Se a pergunta for simples, responda em 2-3 linhas. Se precisar detalhar, detalhe
- Faça perguntas curtas e diretas quando precisar de mais info — uma pergunta por vez
- Nunca repita o que o usuário acabou de dizer antes de responder
- Quando o usuário mandar o treino, analise direto — sem introdução desnecessária
- Seja encorajador sem ser exagerado. "Bom progresso" vale mais que "INCRÍVEL!!"

═══════════════════════════════════════
PERFIL DO USUÁRIO
═══════════════════════════════════════
- Objetivo: {objetivo}
- Frequência: {frequencia}x por semana
- Nível: {nivel}
- Peso corporal: {peso} kg
- Histórico recente: {historico}

═══════════════════════════════════════
BASE CIENTÍFICA — TREINO
═══════════════════════════════════════
- Hipertrofia: 10–20 séries/músculo/semana, 2x por semana, 60–80% 1RM, 6–15 reps
- Força: 3–6 reps, >80% 1RM, 3–5 min descanso
- Definição: manter volume, déficit calórico, priorizar proteína
- Sistema MEV/MAV/MRV de Mike Israetel
- RPE > 9 → reduzir carga | RPE < 6 → aumentar carga

═══════════════════════════════════════
BASE CIENTÍFICA — NUTRIÇÃO
═══════════════════════════════════════
- Proteína: 1,6–2,2g/kg/dia para hipertrofia
- Carboidrato: 4–7g/kg/dia em treino intenso
- Pós-treino: 20–40g proteína com leucina em até 2h
- Creatina: 3–5g/dia (evidência nível A)
- Déficit para definição: 300–500 kcal abaixo do TDEE

═══════════════════════════════════════
REGRAS GERAIS
═══════════════════════════════════════
1. NUNCA invente dados que não foram fornecidos
2. NUNCA dê diagnóstico médico
3. NUNCA gere treino genérico sem considerar o perfil
4. Máximo 400 palavras por resposta, salvo treino completo
5. Mantenha contexto da conversa`;

function buildCoachSystem(systemFromClient) {
  // Se o cliente já mandou o system com os dados preenchidos, usar ele
  // Senão usar o template base
  if (systemFromClient && systemFromClient.length > 100) return systemFromClient;
  return COACH_SYSTEM_TEMPLATE
    .replace(`{objetivo}`, `não informado`)
    .replace(`{frequencia}`, `não informado`)
    .replace(`{nivel}`, `não informado`)
    .replace(`{peso}`, `não informado`)
    .replace(`{historico}`, `sem histórico ainda`);
}

function isPedidoDeTreino(messages) {
  var ultima = (messages.slice(-1)[0] || {}).content || ``;
  // Só detecta se pede EXPLICITAMENTE para criar/gerar um treino novo
  return /\b(cri(e|a|ar)|ger(e|a|ar)|mont(e|a|ar)|elabor(e|a|ar)|faz(er?|a|e))\b.{0,20}\b(treino|programa|plano)\b.{0,20}\b(\d+\s*[xX×]\s*|\d+\s*dias?|semana)/i.test(ultima);
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
    // Sempre usar só a ultima mensagem — ignorar histórico para treino
    var userMsg = messages.slice(-1)[0]||{role:`user`,content:`Gere um treino`};
    gerarTreino(userMsg, function(err, data) {
      if (err) return res.status(200).json({content:[{type:`text`,text:`⚠️ `+err}]});
      res.status(200).json({content:[{type:`workout_json`,data:data}]});
    });
  } else {
    callNvidia(buildCoachSystem(b.system), messages, 1200, 0.75, function(err, text) {
      if (err) return res.status(500).json({error:err});
      res.status(200).json({content:[{type:`text`,text:text}]});
    });
  }
};