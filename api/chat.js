var https = require(`https`);
// nvidia removido — usando apenas Groq (_gemini.js)
var gemini   = require('./_gemini');
var auth     = require('./_auth');
var cors     = require('./_cors');
var rl       = require('./_ratelimit');
var plans    = require('./_plans');
var logger   = require('./_logger');
var intent       = require('./_intent');
var responseUtil = require('./_response');
var access       = require('./_access');
var dietflow     = require('./_dietflow');
var workoutflow  = require('./_workoutflow');
var diet         = require('./_diet');
var prompts      = require('./_systemPrompts');
var scienceInsight = require('../src/lib/science/scienceInsightService');

// ─── Sistema de treino — JSON estruturado ──────────────────────────
var TREINO_SYSTEM = `Você é o KRONOS, treinador pessoal aplicado. Responda SOMENTE com JSON válido.

Formato obrigatório:
{
  "treinos": [
    {
      "nome": "A",
      "grupo": "Peito/Tríceps",
      "exercicios": [
        {
          "nome": "Supino Reto",
          "fases": [
            {"fase": "Sem 1-4", "label": "MEV", "series": 3, "reps": "10-12", "cadencia": "2-1-2", "descanso": "90s"},
            {"fase": "Sem 5-8", "label": "MAV", "series": 4, "reps": "8-10",  "cadencia": "2-0-2", "descanso": "75s"},
            {"fase": "Sem 9-12","label": "MRV", "series": 5, "reps": "6-8",   "cadencia": "3-1-1", "descanso": "60s"}
          ],
          "tecnica": "Desça a barra até tocar o peitoral. Escápulas retraídas durante toda a execução.",
          "alerta":  ""
        }
      ]
    }
  ],
  "orientacoes": {
    "aquecimento": "5-10 min mobilidade articular + 1-2 séries de aquecimento (50% da carga) antes de cada exercício principal.",
    "progressao":  "Aumente carga quando executar o limite superior de reps nas 3 séries com boa técnica.",
    "descanso_semanal": "Respeite 48h de recuperação para o mesmo grupo muscular.",
    "recuperacao": "7-9h de sono. Ingestão proteica distribuída. Reduz volume na semana de deload (sem 13)."
  }
}

REGRAS CRÍTICAS:
- 4-6 exercícios por sessão — qualidade supera quantidade
- SEMPRE 3 fases MEV→MAV→MRV com progressão real de volume e intensidade
- Campo "tecnica": instrução de execução específica para o exercício — não genérico
- Campo "alerta": preencha SOMENTE se o usuário tiver restrição que afete este exercício
- APENAS JSON. Sem texto antes ou depois.

LÓGICA POR NÍVEL — ajuste absolutamente tudo com base no nível:

INICIANTE (< 1 ano):
- Prioridade máxima: padrões de movimento. Técnica antes de carga.
- Divisão: Full Body 3x ou Upper/Lower 4x. NÃO Split por grupos musculares ainda.
- Volume: 3 séries por exercício. 10-15 reps. 3-5 compostos por sessão.
- Descanso: 90-120s. Progressão: adicionar carga a cada sessão (novice effect).
- Exercícios: Agachamento, Supino, Remada, Desenvolvimento, Levantamento Terra — dominar esses 5.
- Isolamentos: apenas complementares, não protagonistas.
- Erro mais comum: volume excessivo antes de ter base motora.

INTERMEDIÁRIO (1-3 anos):
- Divisão: Push/Pull/Legs 6x, Upper/Lower 4-5x ou PPL comprimido.
- Volume: 10-16 séries/músculo/semana. 3-4 séries por exercício. 8-12 reps compostos, 12-15 isolamentos.
- Progressão: dupla progressão (reps → carga). Periodização ondulante diária (DUP) funciona bem.
- Técnicas avançadas: Drop-set e rest-pause apenas no último exercício. Não abusar.
- Descanso: 75-90s. Frequência: 2x/músculo/semana mínimo.
- Deload: a cada 8 semanas.

AVANÇADO (3-7 anos):
- Divisão: Split 5-6x por semana. Alta frequência (3x/músculo possível).
- Volume: 16-22 séries/músculo/semana no MAV. Individualizar por grupo.
- Técnicas: Drop-sets, Rest-pause, Cluster sets, Myo-reps, Blood flow restriction (BFR) em isolamentos.
- Periodização: Bloco (acumulação → intensificação → realização) ou Conjugado.
- Progressão: microcargas (0,5-1kg). Registrar RIR (Reps in Reserve) por série.
- Deload: a cada 6 semanas. Protocolo de deload ativo (volume -50%, intensidade mantida).

ELITE / COMPETIDOR (7+ anos ou atleta de palco):
- Periodização de bloco avançada: Off-season (hipertrofia máxima) → Pre-contest (manutenção + déficit) → Peak week.
- Volume: até 25+ séries/grupo lagging. Grupos fracos recebem frequência 3-4x/semana.
- Técnicas: Supersets pré-exaustão, Giant sets, Occlusion training, Pause reps.
- Cardio no pré-contest: LISS 45-60min + HIIT 2-3x/semana. Preservação muscular é prioridade.
- Peak week: manipulação de carboidratos e sódio, redução de volume, treino de depleção.
- Referência: metodologia Meadows, Israetel, Helms, Norton.

LÓGICA POR OBJETIVO — parametrize com precisão:
Hipertrofia: 10-20 séries/músculo/semana. 60-80% 1RM. 6-15 reps. 2x frequência/semana. Tensão mecânica + dano + estresse metabólico.
Força máxima (Powerlifting): 3-6 reps. 80-95% 1RM. 3-5 min descanso. Foco em S/B/D. Periodização linear ou DUP.
Hipertrofia/Força (Powerbuilding): Compostos pesados (3-6 reps) + acessórios volume (8-15 reps).
Definição: Manter volume do MAV (não reduzir). Déficit calórico. Cardio para déficit adicional. Proteína ≥ 2,2g/kg.
Emagrecimento: Déficit 300-500 kcal. Treino resistido > cardio para preservação muscular. Priorizar compostos.
Condicionamento: Circuitos. Descanso 30-60s. Supersets agonista-antagonista. Complexos com barra.
Reabilitação/Funcional: Amplitude controlada. Carga baixa-moderada. Foco em estabilidade e padrão motor.

RACIOCÍNIO BIOMECÂNICO — processe ANTES de prescrever:
Joelho comprometido → Leg Press amplitude reduzida, Hip Thrust, Abdução — NÃO Agachamento profundo, Extensora completa
Cotovelo comprometido → Rosca Martelo, Corda Pulley — NÃO Skull Crusher, Rosca Direta Barra
Ombro comprometido → Desenvolvimento neutro, Elevação Lateral Cabo — NÃO Desenvolvimento atrás da nuca, Elevação Frontal Barra
Lombar comprometida → Remada Máquina, Puxada, Leg Press — NÃO Stiff, Remada Curvada, Good Morning
Sem restrição → escolha os exercícios de maior ativação EMG por grupo.

BASE EMG/EVIDÊNCIA (Schoenfeld, Contreras, NSCA):
Peito: Supino Reto Barra, Supino Inclinado 30-45°, Crucifixo Halteres, Crossover Cabo
Costas: Barra Fixa Pronada, Remada Curvada Barra, Puxada Aberta, Remada Unilateral
Ombros: Desenvolvimento Halteres, Elevação Lateral Cabo, Crucifixo Inverso
Bíceps: Rosca Inclinada Haltere, Rosca Concentrada, Rosca Martelo, Rosca Spider
Tríceps: Tríceps Francês, Extensão Overhead, Mergulho Paralelas, Pulley Corda
Quadríceps: Agachamento Livre, Leg Press 45°, Hack Squat, Búlgaro
Posterior: Stiff/RDL, Mesa Flexora, Levantamento Terra Convencional
Glúteos: Hip Thrust Barra (Contreras 2015 — maior ativação glúteo máximo), Abdução Cabo
Panturrilha: Panturrilha em Pé (gastrocnêmio), Panturrilha Sentado (sóleo)
Core: Prancha, Abdominal Roda, Dead Bug, Elevação de Pernas`;

// COACH_SYSTEM_TEMPLATE movido para _systemPrompts.js — compartilhado com agent.js

function formatDietSummary(plan) {
  return 'Dieta montada: ' + plan.meta.calorias + ' kcal/dia | '
    + plan.meta.proteina + 'g proteína | '
    + plan.meta.carbo    + 'g carbo | '
    + plan.meta.gordura  + 'g gordura | '
    + plan.hidratacao.litros + 'L água.';
}

// buildCoachSystem delegado para _systemPrompts.js (compartilhado com agent.js)
function buildCoachSystem(systemFromClient, context) {
  return prompts.buildCoachSystem(systemFromClient, context);
}

function isPedidoDeTreino(messages) {
  var ultima = (messages.slice(-1)[0] || {}).content || ``;
  return /\b(cri(e|a|ar)|ger(e|a|ar)|mont(e|a|ar)|elabor(e|a|ar)|faz(er?|a|e))\b.{0,20}\b(treino|programa|plano)\b.{0,20}\b(\d+\s*[xX×]\s*|\d+\s*dias?|semana)/i.test(ultima);
}

function callChat(system, messages, maxTokens, temp, userId, endpoint, callback) {
  var GROQ_KEY = process.env.GROQ_API_KEY;
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
  } else {
    callback('GROQ_API_KEY não configurada', null);
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
  if (req.method!==`POST`){
    return responseUtil.sendJson(res, 405, { success: false, type: 'error', message: 'Método não permitido.', error: 'METHOD_NOT_ALLOWED', meta: { fallback: true } });
  }

  auth.requireAuth(req, res, function(user) {
    rl.rateLimit(req, res, function() {
      var accessProfile = access.buildAccessProfile(user);
      function runPaidAiCall(executor, done) {
        plans.getQuotaInfo(user.id, function(qErr, quota) {
          if (qErr) {
            console.error('[chat] erro ao verificar quota (fail-closed):', qErr);
            return responseUtil.sendJson(res, 503, {
              success: false,
              type: 'error',
              action: null,
              message: 'Não consegui processar agora.',
              data: null,
              error: 'PROVIDER_UNAVAILABLE',
              meta: { fallback: true, reason: 'quota_check_failed' }
            });
          }

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

          executor(function(err, payload) {
            if (err) return done(err);
            plans.checkAndIncrementQuota(user.id, res, function() {
              done(null, payload, quota);
            }, { accessProfile: accessProfile });
          }, quota);
        }, { accessProfile: accessProfile });
      }

      var b = req.body || {};

      var messages = b.messages || [];
      if (!Array.isArray(messages)) {
        return responseUtil.sendJson(res, 400, { success: false, type: 'error', message: 'messages deve ser um array', error: 'INVALID_MESSAGES', meta: { fallback: true } });
      }
      if (messages.length > 50) {
        return responseUtil.sendJson(res, 400, { success: false, type: 'error', message: 'Número de mensagens excede o limite de 50', error: 'TOO_MANY_MESSAGES', meta: { fallback: true } });
      }
      var ALLOWED_ROLES = ['user', 'assistant', 'system'];
      messages = messages.map(function(m) {
        if (!m || typeof m !== 'object') return { role: 'user', content: '' };
        var role = ALLOWED_ROLES.includes(String(m.role)) ? String(m.role) : 'user';
        var content = String(m.content || '').slice(0, 4000);
        return { role: role, content: content };
      });

      var lastMsg        = messages.slice(-1)[0] || { role: 'user', content: '' };
      var lastContent    = intent.safeExtractLastUserMessage(messages);
      var detectedIntent = intent.detectIntent(lastContent);
      var convState      = b.conversationState || null;
      console.log('[chat] intent_detected:', detectedIntent);

      if (!convState && b.isDietDirect !== true && b.isGerarTreino !== true) {
        if (detectedIntent === 'greeting') {
          console.log('[chat] local_greeting_response');
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
      }

      // ── FLUXO DE DIETA ──────────────────────────────────────────
      // Se há um fluxo ativo de coleta de dados
      if (convState && convState.mode === 'diet') {
        var stepResult = dietflow.continueDietFlow(convState.stepIndex, convState.collected, lastContent);

        // Ainda coletando dados — sem consumir quota
        if (!stepResult.finished) {
            return responseUtil.sendJson(res, 200, {
              success: true,
              type: 'text',
              message: stepResult.response,
              data: { conversationState: {
                mode:      stepResult.mode,
                stepIndex: stepResult.stepIndex,
                collected: stepResult.collected
              } },
              meta: { local: true, flow: 'diet' }
            });
          }

        var dietPlan = diet.buildDietPlan(stepResult.collected);
        responseUtil.sendJson(res, 200, {
          success: true,
          type: 'diet_result',
          message: formatDietSummary(dietPlan),
          data: {
            content: [{ type: 'diet_result', data: dietPlan, text: formatDietSummary(dietPlan) }],
            conversationState: null
          },
          meta: { local: true, tokensSaved: true }
        });

        return; // async — não cai no resto
      }

      // ── FLUXO DE TREINO ──────────────────────────────────────────
      if (convState && convState.mode === 'workout') {
        var wfResult = workoutflow.continueWorkoutFlow(convState.stepIndex, convState.collected, lastContent);

        if (!wfResult.finished) {
          return res.status(200).json({
            content: [{ type: 'text', text: wfResult.response }],
            conversationState: {
              mode:      wfResult.mode,
              stepIndex: wfResult.stepIndex,
              collected: wfResult.collected
            }
          });
        }

        // Perfil completo — gera treino com contexto rico
        runPaidAiCall(function(nextCall) {
          var richMsg = { role: 'user', content: workoutflow.buildWorkoutMessage(wfResult.collected) };
          gerarTreino(richMsg, user.id, function(err, data) {
            if (err) return nextCall(err);
            nextCall(null, data);
          });
        }, function(err, data) {
          if (err) return res.status(200).json({ content: [{ type: 'text', text: '⚠️ ' + err }] });
          res.status(200).json({
            content: [{ type: 'workout_json', data: data }],
            conversationState: null
          });
        });

        return;
      }

      // ── INTENT: exercise discovery ────────────────────────────────
      if (!b.isGerarTreino && !b.isDietDirect && intent.isExerciseDiscovery(lastContent)) {
        return responseUtil.sendJson(res, 200, {
          success: true,
          type: 'text',
          message: 'Buscando exercício...',
          data: {
            isExerciseDiscovery: true,
            exerciseQuery: lastContent
          },
          meta: { local: true }
        });
      }

      // ── INTENT: novo pedido de dieta ─────────────────────────────
      if (!b.isGerarTreino && !b.isDietDirect && intent.isDietStart(lastContent)) {
        var flowStart = dietflow.startDietFlow();
        return res.status(200).json({
          content: [{ type: 'text', text: flowStart.response }],
          conversationState: {
            mode:      flowStart.mode,
            stepIndex: flowStart.stepIndex,
            collected: flowStart.collected
          }
        });
      }

      // ── INTENT: novo pedido de treino via flow ────────────────────
      // Mensagens simples como "quero um treino" ou "me monta um treino"
      // que não contêm os dados completos na mensagem
      if (!b.isGerarTreino && !isPedidoDeTreino(messages) && intent.detectIntent(lastContent) === 'workout_request') {
        var wfStart = workoutflow.startWorkoutFlow();
        return res.status(200).json({
          content: [{ type: 'text', text: wfStart.response }],
          conversationState: {
            mode:      wfStart.mode,
            stepIndex: wfStart.stepIndex,
            collected: wfStart.collected
          }
        });
      }

      // ── DIETA DIRETA — gerada pelo formulário de dieta (isDietDirect=true) ────
      // O prompt já contém todos os dados do usuário incluindo proteínas preferidas.
      // Usa limite maior de tokens para garantir a dieta completa com todas as refeições.
      if (b.isDietDirect === true) {
        runPaidAiCall(function(nextCall) {
          callChat(buildCoachSystem(b.system, b.context || {}), messages, 3000, 0.4, user.id, 'chat-diet-direct', function(err, text) {
            if (err) {
              console.error('[chat] provider_fallback:', err);
              return nextCall(err);
            }
            nextCall(null, text);
          });
        }, function(err, text) {
          if (err) return responseUtil.sendJson(res, 503, { success: false, type: 'error', message: 'Não consegui processar agora.', error: 'PROVIDER_UNAVAILABLE', meta: { fallback: true } });
          responseUtil.sendJson(res, 200, { success: true, type: 'text', message: text, data: { content: [{ type: 'text', text: text }] }, meta: {} });
        });
        return;
      }

      // ── TREINO + CHAT GERAL (fluxo original intacto) ─────────────
      // Passa o contexto do body para buildCoachSystem quando disponível
      var coachContext = b.context || {};
      var isGerarTreino = b.isGerarTreino === true || isPedidoDeTreino(messages);

      Promise.resolve()
        .then(function() {
          if (isGerarTreino) return null;
          return scienceInsight.buildScienceContextFromText(lastContent);
        })
        .then(function(scienceContext) {
          if (scienceContext) {
            coachContext = Object.assign({}, coachContext, { science_context: scienceContext });
          }

          runPaidAiCall(function(nextCall) {
            if (isGerarTreino) {
              gerarTreino(lastMsg, user.id, function(err, data) {
                if (err) return nextCall(err);
                nextCall(null, data);
              });
            } else {
              callChat(buildCoachSystem(b.system, coachContext), messages, 1200, 0.75, user.id, 'chat', function(err, text) {
                if (err) {
                  console.error('[chat] provider_fallback:', err);
                  return nextCall(err);
                }
                nextCall(null, text);
              });
            }
          }, function(err, payload) {
            if (err) {
              return responseUtil.sendJson(res, 503, { success: false, type: 'error', message: 'Não consegui processar agora.', error: 'PROVIDER_UNAVAILABLE', meta: { fallback: true } });
            }
            if (isGerarTreino) {
              return responseUtil.sendJson(res, 200, { success: true, type: 'workout_json', message: 'Treino gerado com sucesso.', data: { content: [{ type: 'workout_json', data: payload }] }, meta: {} });
            }
            responseUtil.sendJson(res, 200, { success: true, type: 'text', message: payload, data: { content: [{ type: 'text', text: payload }] }, meta: {} });
          });
        })
        .catch(function() {
          runPaidAiCall(function(nextCall) {
            if (isGerarTreino) {
              gerarTreino(lastMsg, user.id, function(err, data) {
                if (err) return nextCall(err);
                nextCall(null, data);
              });
            } else {
              callChat(buildCoachSystem(b.system, coachContext), messages, 1200, 0.75, user.id, 'chat', function(err, text) {
                if (err) {
                  console.error('[chat] provider_fallback:', err);
                  return nextCall(err);
                }
                nextCall(null, text);
              });
            }
          }, function(err, payload) {
            if (err) {
              return responseUtil.sendJson(res, 503, { success: false, type: 'error', message: 'Não consegui processar agora.', error: 'PROVIDER_UNAVAILABLE', meta: { fallback: true } });
            }
            if (isGerarTreino) {
              return responseUtil.sendJson(res, 200, { success: true, type: 'workout_json', message: 'Treino gerado com sucesso.', data: { content: [{ type: 'workout_json', data: payload }] }, meta: {} });
            }
            responseUtil.sendJson(res, 200, { success: true, type: 'text', message: payload, data: { content: [{ type: 'text', text: payload }] }, meta: {} });
          });
        });

    }, { max: 40, windowMs: 60000 }, user.id);
  });
};
