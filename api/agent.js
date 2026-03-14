var https = require('https');
var nvidia = require('./_nvidia');

// ══════════════════════════════════════════
// FERRAMENTAS DOS AGENTS
// ══════════════════════════════════════════

var TOOLS = [
  {
    type: 'function',
    function: {
      name: 'analisar_progresso',
      description: 'Analisa a progressão de carga de um exercício específico ou de todos. Retorna dados reais de evolução de peso, reps e 1RM estimado por sessão.',
      parameters: {
        type: 'object',
        properties: {
          exercicio: { type: 'string', description: 'Nome do exercício (ex: "Supino Reto"). Omitir para analisar todos.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'detectar_plato',
      description: 'Detecta platô em exercícios comparando 1RM estimado entre últimas sessões. Retorna quais exercícios estagnaram e a variação percentual.',
      parameters: {
        type: 'object',
        properties: {
          exercicio: { type: 'string', description: 'Nome do exercício. Omitir para verificar todos.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calcular_nutricao',
      description: 'Calcula TMB, TDEE e macros ideais (proteína, carbo, gordura, calorias) baseado no perfil e objetivo do usuário.',
      parameters: {
        type: 'object',
        properties: {
          objetivo: {
            type: 'string',
            enum: ['hipertrofia', 'emagrecimento', 'manutencao', 'forca'],
            description: 'Objetivo nutricional'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analisar_recuperacao',
      description: 'Analisa RPE médio, tendência de fadiga e risco de overtraining com base nas últimas sessões.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tendencia_volume',
      description: 'Calcula volume total (kg × reps) por sessão ao longo das últimas semanas para identificar tendência.',
      parameters: {
        type: 'object',
        properties: {
          semanas: { type: 'number', description: 'Quantas semanas analisar (padrão: 8)' }
        }
      }
    }
  }
];

// ══════════════════════════════════════════
// IMPLEMENTAÇÃO DAS FERRAMENTAS
// ══════════════════════════════════════════

function calcRM(kg, reps) { return kg * (1 + reps / 30); }

function extrairProgresso(args, history) {
  var filtro = ((args && args.exercicio) || '').toLowerCase().trim();
  var mapa = {};
  (history || []).forEach(function(sess) {
    var data = (sess.createdAt || '').substring(0, 10) || 'N/A';
    ((sess.state || {}).sections || []).forEach(function(sec) {
      (sec.cards || []).forEach(function(card) {
        if (!card.name) return;
        if (filtro && !card.name.toLowerCase().includes(filtro)) return;
        var maxRM = 0, bestKg = 0, bestReps = 0;
        (card.values || []).forEach(function(v) {
          var kg = parseFloat(v.kg) || 0;
          var reps = parseFloat(v.reps) || 0;
          if (kg > 0 && reps > 0) {
            var rm = parseFloat(v.rm) || calcRM(kg, reps);
            if (rm > maxRM) { maxRM = rm; bestKg = kg; bestReps = reps; }
          }
        });
        if (maxRM > 0) {
          if (!mapa[card.name]) mapa[card.name] = [];
          mapa[card.name].push({ data: data, kg: bestKg, reps: bestReps, rm: Math.round(maxRM) });
        }
      });
    });
  });
  return mapa;
}

function toolAnalisarProgresso(args, userData) {
  var mapa = extrairProgresso(args, userData.history);
  if (!Object.keys(mapa).length) return { info: 'Nenhum dado de exercícios encontrado no histórico.' };
  var result = {};
  Object.keys(mapa).forEach(function(ex) {
    var entries = mapa[ex];
    var primeiro = entries[0].rm;
    var ultimo = entries[entries.length - 1].rm;
    var evolucao = entries.length > 1 ? Math.round(((ultimo - primeiro) / primeiro) * 100 * 10) / 10 : 0;
    result[ex] = {
      sessoes: entries.length,
      rmInicial: primeiro,
      rmAtual: ultimo,
      evolucaoPct: evolucao,
      historico: entries.slice(-6)
    };
  });
  return result;
}

function toolDetectarPlato(args, userData) {
  var mapa = extrairProgresso(args, userData.history);
  if (!Object.keys(mapa).length) return { info: 'Nenhum dado encontrado.' };
  var result = {};
  Object.keys(mapa).forEach(function(ex) {
    var entries = mapa[ex].slice(-6);
    if (entries.length < 3) return;
    var primeiro = entries[0].rm;
    var ultimo = entries[entries.length - 1].rm;
    var variacao = ((ultimo - primeiro) / primeiro) * 100;
    result[ex] = {
      emPlato: variacao < 2.5,
      variacaoPct: Math.round(variacao * 10) / 10,
      rmInicial: primeiro,
      rmAtual: ultimo,
      sessoesAnalisadas: entries.length
    };
  });
  return result;
}

function toolCalcularNutricao(args, userData) {
  var p = userData.profile || {};
  var peso = parseFloat(p.peso) || 75;
  var altura = parseFloat(p.altura) || 175;
  var idade = parseInt(p.idade) || 25;
  var sexo = (p.sexo || 'M').toUpperCase();
  var freq = parseInt(p.freq) || 3;
  var objetivo = (args && args.objetivo) || p.objetivo || 'hipertrofia';

  var tmb = sexo === 'F'
    ? Math.round(10 * peso + 6.25 * altura - 5 * idade - 161)
    : Math.round(10 * peso + 6.25 * altura - 5 * idade + 5);

  var mult = [1.2, 1.2, 1.375, 1.375, 1.55, 1.55, 1.725];
  var tdee = Math.round(tmb * (mult[freq] || 1.55));

  var calorias = tdee;
  if (objetivo === 'hipertrofia') calorias = tdee + 300;
  else if (objetivo === 'emagrecimento') calorias = tdee - 400;
  else if (objetivo === 'forca') calorias = tdee + 150;

  var protG = Math.round(peso * 2.0);
  var gordG = Math.round((calorias * 0.25) / 9);
  var carboG = Math.round((calorias - protG * 4 - gordG * 9) / 4);

  return {
    perfil: { peso: peso, altura: altura, idade: idade, sexo: sexo, freq: freq },
    tmb: tmb,
    tdee: tdee,
    caloriasMeta: calorias,
    objetivo: objetivo,
    macros: {
      proteina: { g: protG, range: peso * 1.6 + '-' + peso * 2.2 + 'g' },
      carboidrato: { g: carboG },
      gordura: { g: gordG }
    },
    timing: {
      preWorkout: '30-60min antes: 20-40g carbo + 10-20g proteína',
      posWorkout: 'Até 2h depois: 20-40g proteína com leucina + carbo'
    }
  };
}

function toolAnalisarRecuperacao(userData) {
  var history = (userData.history || []).slice(-12);
  var rpesPorSessao = [], volumes = [];

  history.forEach(function(sess) {
    var sessRPEs = [], vol = 0;
    ((sess.state || {}).sections || []).forEach(function(sec) {
      (sec.cards || []).forEach(function(card) {
        (card.values || []).forEach(function(v) {
          var rpe = parseFloat(v.rpe);
          if (rpe > 0) sessRPEs.push(rpe);
          var kg = parseFloat(v.kg) || 0;
          var reps = parseFloat(v.reps) || 0;
          vol += kg * reps;
        });
      });
    });
    if (sessRPEs.length) rpesPorSessao.push(sessRPEs.reduce(function(a, b) { return a + b; }, 0) / sessRPEs.length);
    if (vol > 0) volumes.push(vol);
  });

  var rpeMedia = rpesPorSessao.length
    ? Math.round((rpesPorSessao.reduce(function(a, b) { return a + b; }, 0) / rpesPorSessao.length) * 10) / 10
    : null;

  var rpeUlt3 = rpesPorSessao.slice(-3);
  var tendenciaRPE = rpeUlt3.length >= 2 ? Math.round((rpeUlt3[rpeUlt3.length - 1] - rpeUlt3[0]) * 10) / 10 : 0;

  return {
    rpeMediaGeral: rpeMedia,
    tendenciaRPE: tendenciaRPE,
    alertaOvertraining: rpeMedia !== null && (rpeMedia > 8.5 || tendenciaRPE > 0.5),
    recomendarDeload: rpeMedia !== null && rpeMedia > 8.8,
    sessoesAnalisadas: history.length,
    interpretacao: rpeMedia === null ? 'Sem dados de RPE'
      : rpeMedia > 8.8 ? 'RPE muito alto — deload recomendado'
      : rpeMedia > 7.5 ? 'RPE moderado-alto — monitorar'
      : 'RPE saudável — boa recuperação'
  };
}

function toolTendenciaVolume(args, userData) {
  var semanas = (args && args.semanas) || 8;
  var limite = semanas * 2;
  var history = (userData.history || []).slice(-limite);

  return history.map(function(sess) {
    var vol = 0;
    ((sess.state || {}).sections || []).forEach(function(sec) {
      (sec.cards || []).forEach(function(card) {
        (card.values || []).forEach(function(v) {
          vol += (parseFloat(v.kg) || 0) * (parseFloat(v.reps) || 0);
        });
      });
    });
    return { data: (sess.createdAt || '').substring(0, 10), volume: Math.round(vol), duracao: sess.durationMin || null };
  });
}

function executeTool(name, args, userData) {
  try {
    switch (name) {
      case 'analisar_progresso':  return toolAnalisarProgresso(args, userData);
      case 'detectar_plato':      return toolDetectarPlato(args, userData);
      case 'calcular_nutricao':   return toolCalcularNutricao(args, userData);
      case 'analisar_recuperacao': return toolAnalisarRecuperacao(userData);
      case 'tendencia_volume':    return toolTendenciaVolume(args, userData);
      default: return { error: 'Ferramenta desconhecida: ' + name };
    }
  } catch (e) {
    return { error: e.message };
  }
}

// ══════════════════════════════════════════
// CHAMADA NVIDIA COM SUPORTE A TOOLS
// ══════════════════════════════════════════

function callNvidiaAgent(messages, tools, callback) {
  var KEY = process.env.NVIDIA_API_KEY;
  if (!KEY) return callback('NVIDIA_API_KEY missing', null);

  var payload = {
    model: 'meta/llama-3.3-70b-instruct',
    messages: messages,
    tools: tools,
    tool_choice: 'auto',
    max_tokens: 1500,
    temperature: 0.7,
    stream: false
  };

  nvidia.callNvidiaAgent(KEY, payload, 30000, 3, callback);
}

// ══════════════════════════════════════════
// AGENT LOOP — até 6 iterações
// ══════════════════════════════════════════

var AGENT_SYSTEM = `Você é o TITAN EXPERT, especialista completo em musculação, nutrição esportiva e suplementação.

REGRA PRINCIPAL: Quando o usuário perguntar sobre progresso, platô, nutrição, recuperação ou volume — SEMPRE use as ferramentas disponíveis antes de responder. Não chute — use dados reais.

Ferramentas disponíveis:
- analisar_progresso: evolução de carga por exercício
- detectar_plato: identifica estagnação
- calcular_nutricao: TDEE, macros personalizados
- analisar_recuperacao: RPE, overtraining, deload
- tendencia_volume: volume total por sessão

Após usar ferramentas, analise os dados e responda de forma personalizada e específica.

Personalidade: Coach de verdade. Português coloquial. Direto ao ponto. Sem rodeios. Máximo 400 palavras.
Base científica: ISSN, JISSN, sistema MEV/MAV/MRV. Suplementação apenas Tier 1 (creatina, whey, cafeína, beta-alanina, vitamina D3).`;

function agentLoop(userMessages, userData, callback) {
  var MAX_ITER = 6;
  var iter = 0;

  var msgs = [{ role: 'system', content: AGENT_SYSTEM }].concat(userMessages);

  function iterate() {
    if (iter++ >= MAX_ITER) return callback(null, 'Limite de iterações atingido.');

    callNvidiaAgent(msgs, TOOLS, function(err, msg) {
      if (err) return callback(err, null);

      // Sem tool calls → resposta final
      if (!msg.tool_calls || !msg.tool_calls.length) {
        return callback(null, msg.content || 'Sem resposta.');
      }

      // Adiciona mensagem do assistant com tool calls
      msgs.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });

      // Executa cada tool call e adiciona resultado
      msg.tool_calls.forEach(function(tc) {
        var args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) {}
        var result = executeTool(tc.function.name, args, userData);
        msgs.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(result)
        });
      });

      iterate();
    });
  }

  iterate();
}

// ══════════════════════════════════════════
// HANDLER
// ══════════════════════════════════════════

module.exports = function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }
  if (!process.env.NVIDIA_API_KEY) { res.status(500).json({ error: 'NVIDIA_API_KEY missing' }); return; }

  var b = req.body || {};
  var messages = b.messages || [];
  var userData = {
    history: (b.history || []).slice(-25),
    profile: b.profile || {}
  };

  agentLoop(messages, userData, function(err, text) {
    if (err) return res.status(500).json({ error: err });
    res.status(200).json({ content: [{ type: 'text', text: text }] });
  });
};
