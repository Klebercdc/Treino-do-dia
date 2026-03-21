var https = require(`https`);
var nvidia = require('./_nvidia');
var gemini = require('./_gemini');
var auth = require('./_auth');
var cors = require('./_cors');
var rl = require('./_ratelimit');
var plans = require('./_plans');
var logger = require('./_logger');

var TREINO_SYSTEM = `Você é o KRONOS. Responda SOMENTE com JSON válido, sem texto antes ou depois, sem markdown.

Formato obrigatório para QUALQUER treino (com ou sem periodização):
{
  "treinos": [
    {
      "nome": "A",
      "grupo": "Peito/Tríceps",
      "exercicios": [
        {
          "nome": "Supino Reto",
          "fases": [
            {"fase": "Sem 1-4", "label": "MEV", "series": 3, "reps": "8-12"},
            {"fase": "Sem 5-8", "label": "MAV", "series": 4, "reps": "10-12"},
            {"fase": "Sem 9-12", "label": "MRV", "series": 5, "reps": "6-10"}
          ]
        }
      ]
    }
  ]
}

Regras:
- Use nomes A, B, C, D, E para os dias de treino
- 4-6 exercícios por treino
- SEMPRE inclua 3 fases por exercício seguindo MEV→MAV→MRV
- Fase 1 (Sem 1-4): MEV — volume mínimo efetivo, foco em técnica
- Fase 2 (Sem 5-8): MAV — volume máximo adaptativo, progressão de carga
- Fase 3 (Sem 9-12): MRV — volume máximo recuperável, intensidade máxima
- Adapte séries e reps ao objetivo do usuário (força/hipertrofia/definição)
- APENAS JSON. Absolutamente nada mais.

RACIOCÍNIO BIOMECÂNICO OBRIGATÓRIO — pense antes de prescrever cada exercício:
Antes de incluir qualquer exercício, raciocine internamente sobre as articulações envolvidas:

JOELHO: Agachamento livre, Leg Press, Cadeira Extensora, Passada, Búlgaro → compressão patelofemoral alta. Se o usuário tem joelho comprometido, substitua por Leg Press com amplitude reduzida, Abdução, Extensão parcial ou Hip Thrust.

COTOVELO: Tríceps Testa (Skull Crusher), Rosca Direta com Barra, Spider Curl → alta tensão no tendão distal do bíceps e epicôndilo. Dor no cotovelo → prefira Rosca Martelo, Cabo, Pulley Corda.

OMBRO: Desenvolvimento atrás da nuca, Elevação Frontal com barra, Supino com pegada fechada → impingement do manguito rotador. Ombro vulnerável → prefira Desenvolvimento neutro, Elevação Lateral com cabo, Crucifixo.

COLUNA LOMBAR: Stiff, Remada Curvada, Good Morning → alta carga de cisalhamento L4-L5. Hérnia/lombar → prefira Remada Máquina, Puxada, Leg Press no lugar de agachamento.

QUADRIL: Hip Thrust e Agachamento Profundo → alto torque no acetábulo. Problema no quadril → Extensão de Quadril na Máquina, Abdução Sentado.

REGRA GERAL: Nunca prescreva um exercício que force uma articulação lesionada. Pense no padrão de movimento real (empurrar, puxar, agachar, dobrar, rodar) e escolha o exercício que executa esse padrão com menor risco para o perfil do usuário.

BASE DE EXERCÍCIOS POR EVIDÊNCIA CIENTÍFICA (EMG + Schoenfeld + NSCA):
Priorize SEMPRE estes exercícios por grupo muscular:

PEITO: Supino Reto com Barra (ativação peitoral maior superior+inferior), Supino Inclinado 30-45° (maior ativação feixe clavicular), Crucifixo com Halteres (máximo alongamento sob carga), Crossover Cabo (tensão constante), Flexão Diamante (triceps+peitoral)

COSTAS: Barra Fixa Pronada (maior ativação latíssimo), Remada Curvada com Barra (trapézio+romboides+latíssimo), Puxada Frente Pegada Aberta (latíssimo), Remada Unilateral Haltere (amplitude máxima), Remada Baixa Cabo (tensão constante no latíssimo)

OMBROS: Desenvolvimento com Barra/Halteres (deltóide anterior+médio), Elevação Lateral com Cabo (tensão constante no deltóide médio), Elevação Frontal Haltere (deltóide anterior), Crucifixo Inverso/Peck Deck Invertido (deltóide posterior), Encolhimento (trapézio superior)

BÍCEPS: Rosca Direta Barra (maior ativação bíceps braquial), Rosca Inclinada Haltere (alongamento máximo), Rosca Concentrada (pico de contração), Rosca Martelo (braquiorradial+bíceps), Rosca Spider Curl (curto+longo)

TRÍCEPS: Tríceps Testa/Francês (cabeça longa em alongamento), Tríceps Pulley Corda (cabeça lateral), Mergulho em Paralelas (todas as cabeças), Extensão Overhead (cabeça longa máxima ativação), Tríceps Coice Haltere (isolamento)

PERNAS (QUADRÍCEPS): Agachamento Livre (máximo recrutamento muscular total), Leg Press 45° (seguro e eficaz), Hack Squat (ênfase no vasto lateral), Cadeira Extensora (isolamento VMO), Agachamento Búlgaro (unilateral+glúteo)

PERNAS (POSTERIOR): Stiff/Levantamento Terra Romeno (isquiotibiais em alongamento), Mesa Flexora (isolamento isquiotibiais), Cadeira Flexora (bíceps femoral), Good Morning (posterior cadeia), Levantamento Terra Convencional (cadeia posterior completa)

GLÚTEOS: Agachamento Profundo, Hip Thrust com Barra (maior ativação glúteo máximo — Contreras 2015), Elevação Pélvica, Abdução com Cabo, Passada/Avanço

PANTURRILHA: Panturrilha em Pé (gastrocnêmio), Panturrilha Sentado (sóleo), Leg Press Panturrilha

ABDÔMEN: Prancha (core estabilizador), Abdominal Roda (reto abdominal), Elevação de Pernas (iliopsoas+reto), Russian Twist (oblíquos), Dead Bug (core profundo)`;

var COACH_SYSTEM_TEMPLATE = `Você é o KRONOS, o coach pessoal de musculação e nutrição do app KRONIA.

═══════════════════════════════════════
PERSONALIDADE E FORMA DE FALAR
═══════════════════════════════════════
- Você é um coach de verdade, não um chatbot — fale como gente fala
- Português brasileiro coloquial, como numa conversa de WhatsApp ou academia
- NUNCA comece com "Claro!", "Certamente!", "Olá!", "Como posso ajudar?" — vá direto ao ponto
- Saudação simples ("Oi", "Ola", "E aí") = responda de forma curta e casual, sem monólogo
- Resposta simples = 1-3 linhas. Detalhe só quando a pergunta pede
- Nunca repita o que o usuário disse. Nunca faça introduções desnecessárias
- Varie o jeito de responder — não repita padrões de frase
- Faça perguntas só quando realmente precisar de info — uma por vez, no fim
- Use gírias do meio quando fizer sentido: "tá voando", "bora", "massa"
- Encorajador sem exagero — "bom progresso" é melhor que "INCRÍVEL!!"
- Quando não souber algo sobre o usuário, pergunte — não invente
- NUNCA assuma que o usuário está falando de treino se ele não mencionou treino
- Comentário casual ("cansei", "tô bem", "kkkk") = responda como amigo, não como coach analisando treino
- Só use dados do perfil/histórico se o usuário perguntar algo relacionado

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

RACIOCÍNIO BIOMECÂNICO (pense antes de prescrever):
- Joelho: agachamento, leg press, extensora, passada → compressão patelofemoral. Alternativa: hip thrust, abdução, prensa com amplitude curta
- Cotovelo: skull crusher, rosca barra, spider curl → epicondilite. Alternativa: corda pulley, rosca martelo, cabo
- Ombro: desenvolvimento atrás da nuca, elevação frontal barra → impingement. Alternativa: desenvolvimento neutro, elevação lateral cabo
- Coluna: stiff, remada curvada, good morning → cisalhamento lombar. Alternativa: remada máquina, puxada, extensão costas
- Nunca prescreva exercício que force articulação com restrição declarada. Pense no padrão de movimento real e no risco para ESTE usuário.

═══════════════════════════════════════
BASE CIENTÍFICA — NUTRIÇÃO
═══════════════════════════════════════
- Proteína: 1,6–2,2g/kg/dia para hipertrofia
- Carboidrato: 4–7g/kg/dia em treino intenso
- Pós-treino: 20–40g proteína com leucina em até 2h
- Creatina: 3–5g/dia (evidência nível A)
- Déficit para definição: 300–500 kcal abaixo do TDEE

RACIOCÍNIO CULINÁRIO (pense antes de prescrever dieta):
- Valide se o método de preparo faz sentido: frango, peixe, carne bovina → podem ser grelhados. Arroz, feijão, macarrão → cozidos. Salada → cru. Nunca escreva "alface grelhada" ou "arroz frito" sem contexto.
- Quantidades realistas: 100g de frango grelhado = filé médio. 200g de arroz cru ≠ 200g cozido (cozido pesa ~3x mais). Informe sempre o peso do alimento no estado em que vai ser consumido (cozido/grelhado/cru).
- Ofereça medidas caseiras para quem não tem balança: concha (= ~80-100g de feijão/arroz cozido), colher de sopa (= ~15g de azeite / ~20g de pasta), xícara (= ~240ml / ~150g de arroz cozido), pegador (= ~100g de macarrão cozido), filé médio (= ~100-120g de proteína grelhada).

═══════════════════════════════════════
REGRAS GERAIS
═══════════════════════════════════════
1. NUNCA invente dados que não foram fornecidos
2. NUNCA dê diagnóstico médico
3. NUNCA gere treino genérico sem considerar o perfil
4. Máximo 400 palavras por resposta, salvo treino completo
5. Mantenha contexto da conversa`;

function buildCoachSystem(systemFromClient) {
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
  return /\b(cri(e|a|ar)|ger(e|a|ar)|mont(e|a|ar)|elabor(e|a|ar)|faz(er?|a|e))\b.{0,20}\b(treino|programa|plano)\b.{0,20}\b(\d+\s*[xX×]\s*|\d+\s*dias?|semana)/i.test(ultima);
}

function callChat(system, messages, maxTokens, temp, userId, endpoint, callback) {
  var GROQ_KEY   = process.env.GROQ_API_KEY;
  var NVIDIA_KEY = process.env.NVIDIA_API_KEY;
  var m = [];
  if (system) m.push({ role: `system`, content: system });
  messages.forEach(function(x) { m.push(x); });
  var payload = { messages: m, max_tokens: maxTokens, temperature: temp, stream: false };

  function onResult(err, result) {
    if (err) return callback(err, null);
    if (userId) {
      logger.logUsage({ userId: userId, endpoint: endpoint || 'chat', promptTokens: result.usage.prompt_tokens, completionTokens: result.usage.completion_tokens, model: result.model });
    }
    callback(null, result.text);
  }

  if (GROQ_KEY) {
    gemini.callGeminiFull(GROQ_KEY, payload, 25000, 3, onResult);
  } else if (NVIDIA_KEY) {
    payload.model = `meta/llama-3.3-70b-instruct`;
    nvidia.callNvidiaFull(NVIDIA_KEY, payload, 25000, 3, onResult);
  } else {
    callback('Nenhuma chave de API configurada (GROQ_API_KEY ou NVIDIA_API_KEY)', null);
  }
}

function parseWorkout(text) {
  var clean = text.replace(/```json|```/g,'').trim();
  var s = clean.indexOf('{'), e = clean.lastIndexOf('}');
  if (s===-1||e===-1) throw new Error('no json');
  var p = JSON.parse(clean.slice(s,e+1));
  if (!p.treinos||!p.treinos.length) throw new Error('invalid');
  p.treinos.forEach(function(t) {
    (t.exercicios||[]).forEach(function(ex) {
      if (ex.fases && ex.fases.length > 0) {
        ex.series = ex.fases[0].series || 3;
        ex.reps   = ex.fases[0].reps   || '8-12';
      }
      ex.series = ex.series || 3;
      ex.reps   = ex.reps   || '8-12';
    });
  });
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

function gerarTreino(userMsg, userId, callback) {
  callChat(TREINO_SYSTEM, [userMsg], 4000, 0.1, userId, 'chat-treino', function(err, text) {
    try { return callback(null, parseWorkout(text||``)); } catch(e) {}
    try { return callback(null, extrairDoTexto(text||``)); } catch(e2) {}
    callChat(TREINO_SYSTEM, [{role:`user`,content:`JSON apenas: `+userMsg.content}], 4000, 0.0, userId, 'chat-treino-retry', function(err2, text2) {
      try { return callback(null, parseWorkout(text2||``)); } catch(e3) {}
      try { return callback(null, extrairDoTexto(text2||``)); } catch(e4) {}
      callback(`Erro ao gerar treino: ` + (err2||'resposta inválida da IA') + `. Tente novamente.`, null);
    });
  });
}

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method===`OPTIONS`){res.status(200).end();return;}
  if (req.method!==`POST`){res.status(405).end();return;}
  if (!process.env.GROQ_API_KEY && !process.env.NVIDIA_API_KEY){res.status(500).json({error:'Nenhuma chave de API configurada'});return;}

  auth.requireAuth(req, res, function(user) {
    rl.rateLimit(req, res, function() {
    plans.checkAndIncrementQuota(user.id, res, function() {
      var b = req.body||{};

      var messages = b.messages||[];
      if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages deve ser um array' });
      if (messages.length > 50) return res.status(400).json({ error: 'Número de mensagens excede o limite de 50' });
      var ALLOWED_ROLES = ['user', 'assistant', 'system'];
      messages = messages.map(function(m) {
        if (!m || typeof m !== 'object') return { role: 'user', content: '' };
        var role = ALLOWED_ROLES.includes(String(m.role)) ? String(m.role) : 'user';
        var content = String(m.content || '').slice(0, 4000);
        return { role: role, content: content };
      });

      var isGerarTreino = b.isGerarTreino===true || isPedidoDeTreino(messages);
      var userMsg = messages.slice(-1)[0]||{role:`user`,content:`Gere um treino`};

      if (isGerarTreino) {
        gerarTreino(userMsg, user.id, function(err, data) {
          if (err) return res.status(200).json({content:[{type:`text`,text:`⚠️ `+err}]});
          res.status(200).json({content:[{type:`workout_json`,data:data}]});
        });
      } else {
        callChat(buildCoachSystem(b.system), messages, 1200, 0.75, user.id, 'chat', function(err, text) {
          if (err) return res.status(500).json({error:err});
          res.status(200).json({content:[{type:`text`,text:text}]});
        });
      }
    });
    }, { max: 40, windowMs: 60000 }, user.id);
  });
};
