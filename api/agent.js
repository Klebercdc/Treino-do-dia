var https = require('https');
// nvidia removido — usando apenas Groq (_gemini.js)
var gemini  = require('../src/server/apihelpers/_gemini');
var auth    = require('../src/server/apihelpers/_auth');
var cors    = require('../src/server/apihelpers/_cors');
var rl      = require('../src/server/apihelpers/_ratelimit');
var plans   = require('../src/server/apihelpers/_plans');
var logger  = require('../src/server/apihelpers/_logger');
var prompts = require('../src/server/apihelpers/_systemPrompts');
var diet    = require('../src/server/apihelpers/_diet');
var responseUtil = require('../src/server/apihelpers/_response');
var intent = require('../src/server/apihelpers/_intent');
var access = require('../src/server/apihelpers/_access');

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
      name: 'calcular_dieta',
      description: 'Calcula TMB, TDEE, macros (proteína, carbo, gordura, calorias) e monta plano alimentar completo com refeições adaptadas ao perfil, objetivo e restrições alimentares do usuário.',
      parameters: {
        type: 'object',
        properties: {
          objetivo: {
            type: 'string',
            description: 'Objetivo nutricional (ex: hipertrofia, emagrecimento, manutencao). Omitir para usar o objetivo do perfil.'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'verificar_deload',
      description: 'Verifica se o usuário precisa de deload analisando semanas de treino consecutivas, tendência de RPE e sinais de fadiga acumulada.',
      parameters: { type: 'object', properties: {} }
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

function toolCalcularDieta(args, userData) {
  var p = Object.assign({}, userData.profile || {});
  if (args && args.objetivo) p.objetivo = args.objetivo;

  var plan = diet.buildDietPlan(p);
  var peso = parseFloat(p.peso) || 75;

  // Resumo compacto das refeições para contexto da IA
  var refeicoes = (plan.refeicoes || []).map(function(r) {
    return r.horario + ' ' + r.nome + ': ' + r.proteinas.slice(0, 1).join(', ') + ' + ' + r.carbos.slice(0, 1).join(', ');
  });

  return {
    objetivo:     p.objetivo || 'manter',
    calorias:     plan.meta.calorias,
    macros: {
      proteina:   { g: plan.meta.proteina, gPorKg: diet.round(plan.meta.proteina / peso, 1) },
      carbo:      { g: plan.meta.carbo },
      gordura:    { g: plan.meta.gordura }
    },
    hidratacao:   plan.hidratacao.litros + 'L/dia',
    refeicoes:    refeicoes,
    observacoes:  plan.observacoes,
    timing: {
      preTreino:  'Carbo 1-2h antes do treino — energia sem pico insulínico',
      posTreino:  '20-40g proteína com leucina em até 2h — janela anabólica'
    }
  };
}

function toolVerificarDeload(userData) {
  var history = (userData.history || []);
  var semanas = Math.ceil(history.length / 2); // ~2 sessões/semana

  var rec = toolAnalisarRecuperacao(userData);
  var vol = toolTendenciaVolume({ semanas: 4 }, userData);

  // Detecta plateau de volume (últimas 2 semanas vs 2 anteriores)
  var volUlt = vol.slice(-4).reduce(function(s, v) { return s + v.volume; }, 0) / 4;
  var volAnt = vol.slice(-8, -4).reduce(function(s, v) { return s + v.volume; }, 0) / 4;
  var tendVol = volAnt > 0 ? Math.round(((volUlt - volAnt) / volAnt) * 100) : 0;

  var precisaDeload = rec.recomendarDeload ||
    (semanas >= 8 && rec.rpeMediaGeral > 8.0) ||
    (semanas >= 12);

  return {
    semanasConsecutivas:   semanas,
    rpeMedia:              rec.rpeMediaGeral,
    tendenciaRPE:          rec.tendenciaRPE,
    tendenciaVolumePct:    tendVol,
    recomendarDeload:      precisaDeload,
    motivoPrincipal:       precisaDeload
      ? (semanas >= 12 ? 'Mais de 12 semanas sem deload — obrigatório'
         : rec.rpeMediaGeral > 8.8 ? 'RPE médio acima de 8.8 — acúmulo de fadiga crítico'
         : 'RPE elevado com semanas suficientes — deload preventivo')
      : 'Sem indicativo de deload agora',
    protocolo: precisaDeload ? {
      duracao:   '1 semana',
      volume:    'Reduza para 50% das séries habituais',
      carga:     'Mantenha a intensidade (não é descanso total)',
      foco:      'Técnica, mobilidade e recuperação ativa'
    } : null
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
      case 'analisar_progresso':   return toolAnalisarProgresso(args, userData);
      case 'detectar_plato':       return toolDetectarPlato(args, userData);
      case 'calcular_dieta':       return toolCalcularDieta(args, userData);
      case 'analisar_recuperacao': return toolAnalisarRecuperacao(userData);
      case 'tendencia_volume':     return toolTendenciaVolume(args, userData);
      case 'verificar_deload':     return toolVerificarDeload(userData);
      default: return { error: 'Ferramenta desconhecida: ' + name };
    }
  } catch (e) {
    return { error: e.message };
  }
}

// ══════════════════════════════════════════
// CHAMADA GROQ COM SUPORTE A TOOLS
// ══════════════════════════════════════════

function callAgent(messages, tools, callback) {
  var GROQ_KEY = process.env.GROQ_API_KEY;

  var payload = {
    messages: messages,
    tools: tools,
    tool_choice: 'auto',
    max_tokens: 1500,
    temperature: 0.7,
    stream: false
  };

  if (GROQ_KEY) {
    gemini.callGeminiAgent(GROQ_KEY, payload, 30000, 3, function(err, msg) {
      if (!err) return callback(null, msg);

      // Fallback resiliente: em alguns casos o provider retorna HTTP 400 por
      // falha de geração de function call ("Failed to call a function").
      // Nesses cenários, seguimos sem tools para evitar quebra da experiência.
      if (/failed to call a function/i.test(String(err || ''))) {
        var noToolPayload = {
          messages: messages,
          max_tokens: 1200,
          temperature: 0.4,
          stream: false
        };
        return gemini.callGemini(GROQ_KEY, noToolPayload, 30000, 2, function(fallbackErr, text) {
          if (fallbackErr) return callback(err, null);
          callback(null, { content: text || '' });
        });
      }

      callback(err, null);
    });
  } else {
    callback('GROQ_API_KEY não configurada', null);
  }
}

// ══════════════════════════════════════════
// AGENT LOOP — até 6 iterações
// ══════════════════════════════════════════

function buildAgentSystem(userData) {
  return prompts.buildAgentSystem(userData.profile || {});
}

function agentLoop(userMessages, userData, callback) {
  var MAX_ITER = 6;
  var iter = 0;

  var msgs = [{ role: 'system', content: buildAgentSystem(userData) }].concat(userMessages);

  function iterate() {
    if (iter++ >= MAX_ITER) return callback(null, 'Limite de iterações atingido.');

    callAgent(msgs, TOOLS, function(err, msg) {
      if (err) return callback(err, null);

      if (!msg.tool_calls || !msg.tool_calls.length) {
        return callback(null, msg.content || 'Sem resposta.');
      }

      msgs.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });

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
// STREAMING AGENT LOOP — SSE via Groq
// ══════════════════════════════════════════

function agentLoopStream(userMessages, userData, res) {
  var MAX_ITER = 6;
  var iter = 0;
  var msgs = [{ role: 'system', content: buildAgentSystem(userData) }].concat(userMessages);
  var GROQ_KEY = process.env.GROQ_API_KEY;

  function sendDone() {
    try { res.write('data: [DONE]\n\n'); res.end(); } catch (e) {}
  }

  // Fallback: no Groq key — run non-streaming, send all at once
  if (!GROQ_KEY) {
    agentLoop(userMessages, userData, function(err, text) {
      var t = err ? ('Erro: ' + err) : (text || 'Sem resposta.');
      try { res.write('data: ' + JSON.stringify({ d: t }) + '\n\n'); } catch (e) {}
      sendDone();
    });
    return;
  }

  function iterate() {
    if (iter++ >= MAX_ITER) return sendDone();

    var payload = {
      messages: msgs,
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: 1500,
      temperature: 0.7
    };

    gemini.callGeminiStreamWithTools(GROQ_KEY, payload, 30000,
      function onDelta(delta) {
        if (delta.content) {
          try { res.write('data: ' + JSON.stringify({ d: delta.content }) + '\n\n'); } catch (e) {}
        }
      },
      function onDone(toolCalls, contentAccum) {
        if (toolCalls && toolCalls.length) {
          // Process tool calls, then continue streaming
          msgs.push({ role: 'assistant', content: contentAccum || '', tool_calls: toolCalls });
          toolCalls.forEach(function(tc) {
            var args = {};
            try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) {}
            var result = executeTool(tc.function.name, args, userData);
            msgs.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(result) });
            try { res.write('data: ' + JSON.stringify({ tool: tc.function.name }) + '\n\n'); } catch (e) {}
          });
          iterate();
        } else {
          // Final text has been streamed chunk by chunk already
          sendDone();
        }
      },
      function onError(err) {
        if (/failed to call a function/i.test(String(err || ''))) {
          var noToolPayload = {
            messages: msgs,
            max_tokens: 1200,
            temperature: 0.4,
            stream: false
          };
          return gemini.callGemini(GROQ_KEY, noToolPayload, 30000, 2, function(fallbackErr, text) {
            if (fallbackErr) {
              try { res.write('data: ' + JSON.stringify({ error: 'Serviço de IA temporariamente indisponível.' }) + '\n\n'); } catch (e) {}
              sendDone();
              return;
            }
            var t = text || '';
            try { res.write('data: ' + JSON.stringify({ d: t }) + '\n\n'); } catch (e) {}
            sendDone();
          });
        }

        try { res.write('data: ' + JSON.stringify({ error: err }) + '\n\n'); } catch (e) {}
        sendDone();
      }
    );
  }

  iterate();
}

// ══════════════════════════════════════════
// HANDLER
// ══════════════════════════════════════════

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    return responseUtil.sendJson(res, 405, { success: false, type: 'error', message: 'Método não permitido.', error: 'METHOD_NOT_ALLOWED', meta: { fallback: true } });
  }

  auth.requireAuth(req, res, function(user) {
    rl.rateLimit(req, res, function() {
      var b = req.body || {};
      var accessProfile = access.buildAccessProfile(user);

      var messages = b.messages || [];
      if (!Array.isArray(messages)) {
        return responseUtil.sendJson(res, 400, { success: false, type: 'error', message: 'messages deve ser um array', error: 'INVALID_MESSAGES', meta: { fallback: true } });
      }
      if (messages.length > 50) {
        return responseUtil.sendJson(res, 400, { success: false, type: 'error', message: 'Número de mensagens excede o limite de 50', error: 'TOO_MANY_MESSAGES', meta: { fallback: true } });
      }
      var ALLOWED_ROLES = ['user', 'assistant', 'system', 'tool'];
      messages = messages.map(function(m) {
        if (!m || typeof m !== 'object') return { role: 'user', content: '' };
        var role = ALLOWED_ROLES.includes(String(m.role)) ? String(m.role) : 'user';
        var content = String(m.content || '').slice(0, 4000);
        return { role: role, content: content };
      });

      var userData = {
        history: (b.history || []).slice(-25),
        profile: b.profile || {}
      };
      var lastContent = intent.safeExtractLastUserMessage(messages);
      var detectedIntent = intent.detectIntent(lastContent);
      if (detectedIntent === 'greeting') {
        return responseUtil.sendJson(res, 200, {
          success: true,
          type: 'greeting',
          action: null,
          message: 'Oi 👋 Como posso te ajudar hoje?',
          data: null,
          error: null,
          meta: { local: true, tokensSaved: true }
        });
      }
      if (detectedIntent === 'workout') {
        return responseUtil.sendJson(res, 200, {
          success: true,
          type: 'workout_intent',
          action: 'open_workout_flow',
          message: 'Beleza 💪 Vamos montar seu treino.',
          data: null,
          error: null,
          meta: { local: true, tokensSaved: true }
        });
      }
      if (detectedIntent === 'diet') {
        return responseUtil.sendJson(res, 200, {
          success: true,
          type: 'diet_intent',
          action: 'open_diet_flow',
          message: 'Perfeito 🍽️ Vamos montar sua dieta.',
          data: null,
          error: null,
          meta: { local: true, tokensSaved: true }
        });
      }

      plans.getQuotaInfo(user.id, function(qErr, quota) {
        if (qErr) return responseUtil.sendJson(res, 503, { success: false, type: 'error', message: 'Não consegui processar agora.', error: 'QUOTA_CHECK_FAILED', meta: { fallback: true } });
        if (!quota.allowed) {
          return responseUtil.sendJson(res, 402, {
            success: false,
            type: 'error',
            message: 'Limite do plano gratuito atingido. Faça upgrade para continuar.',
            error: 'QUOTA_EXCEEDED',
            data: { quota: { used: quota.used, limit: quota.limit, plan: quota.plan } },
            meta: { fallback: true }
          });
        }

      // SSE streaming mode
      if (b.stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        return plans.checkAndIncrementQuota(user.id, res, function() {
          agentLoopStream(messages, userData, res);
        }, { accessProfile: accessProfile });
      }

      // Non-streaming JSON mode (backwards compatible)
      agentLoop(messages, userData, function(err, text) {
        if (err) {
          console.error('[agent] provider_fallback:', err);
          return responseUtil.sendJson(res, 503, {
            success: false,
            type: 'error',
            action: null,
            message: 'Não consegui processar agora.',
            data: null,
            error: 'PROVIDER_UNAVAILABLE',
            meta: { fallback: true }
          });
        }
        var estimatedPrompt = JSON.stringify(messages).length / 4;
        var estimatedCompletion = (text || '').length / 4;
        var modelUsed = process.env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : 'meta/llama-3.3-70b-instruct';
        logger.logUsage({ userId: user.id, endpoint: 'agent', promptTokens: Math.round(estimatedPrompt), completionTokens: Math.round(estimatedCompletion), model: modelUsed, tools: TOOLS.map(function(t){ return t.function.name; }).join(',') });
        plans.checkAndIncrementQuota(user.id, res, function() {
          responseUtil.sendJson(res, 200, {
            success: true,
            type: 'text',
            action: null,
            message: text || 'Sem resposta.',
            data: { content: [{ type: 'text', text: text || 'Sem resposta.' }] },
            error: null,
            meta: {}
          });
        }, { accessProfile: accessProfile });
      });
      }, { accessProfile: accessProfile });
    }, { max: 30, windowMs: 60000 }, user.id);
  });
};
