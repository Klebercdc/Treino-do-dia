'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');
const fs = require('node:fs');

function loadHubWithRows(resolveRows) {
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    let resolved;
    try { resolved = Module._resolveFilename(request, parent); } catch (_) { resolved = request; }
    if (resolved.endsWith('_plans.js') || request === './_plans') {
      return {
        supabaseRequest: function(method, requestPath, body, callback) {
          setImmediate(function() {
            callback(null, resolveRows(requestPath) || []);
          });
        }
      };
    }
    if (resolved.endsWith('_userMemory.js') || request === './_userMemory') {
      return {
        getCoachingSummary: async function() {
          return {
            status: 'improving',
            text: 'Usuário vem mantendo aderência de treino.',
            blocks: {
              adherence_state: { status: 'consistent', sourceSignals: { weeklyFrequencyEstimate: 4 } },
              performance_trend: { status: 'improving' }
            }
          };
        }
      };
    }
    return originalLoad.apply(this, arguments);
  };

  const hubPath = path.resolve(__dirname, '../../src/server/apihelpers/_kronosContextHub.js');
  delete require.cache[hubPath];
  try {
    return require(hubPath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[hubPath];
  }
}

test('buildKronosContext consolida dieta, treino e exames reais em contrato global', async function() {
  const hub = loadHubWithRows(function(requestPath) {
    if (requestPath.startsWith('profiles?')) {
      return [{
        id: 'u1',
        full_name: 'Ana',
        birth_date: '1992-01-10',
        sex: 'female',
        current_weight_kg: 64,
        height_cm: 168,
        objective: 'hipertrofia',
        activity_level: 'moderado',
        allergies: ['amendoim'],
        intolerances: ['lactose'],
        liked_foods: ['arroz', 'frango'],
        clinical_notes: 'SOP em acompanhamento'
      }];
    }
    if (requestPath.startsWith('user_profiles?')) {
      return [{
        user_id: 'u1',
        nivel: 'intermediário',
        patologias: ['SOP'],
        medicamentos: ['metformina'],
        preferencias: ['aveia'],
        observacoes: 'prefere refeições simples'
      }];
    }
    if (requestPath.startsWith('nutrition_goals?')) {
      return [{ calories_target: 2100, protein_g: 140, carbs_g: 240, fat_g: 65, updated_at: '2026-04-20T10:00:00Z' }];
    }
    if (requestPath.startsWith('meal_plans?')) {
      return [{
        id: 'mp1',
        title: 'Dieta atual',
        active: true,
        status: 'active',
        updated_at: '2026-04-20T10:00:00Z',
        context_snapshot: {
          healthContext: {
            patologia: 'SOP',
            medicamentos: 'metformina',
            preferencias: ['aveia'],
            observacoes: ['evitar refeições muito grandes à noite']
          }
        }
      }];
    }
    if (requestPath.startsWith('meal_plan_items?')) {
      return [
        { meal_name: 'Almoço', time_hint: '12:30', food_name: 'Arroz', quantity: '120', unit: 'g', calories: 156, protein_g: 3, carbs_g: 34, fat_g: 0.4, sort_order: 1 },
        { meal_name: 'Almoço', time_hint: '12:30', food_name: 'Feijão', quantity: '100g', unit: null, calories: 76, protein_g: 5, carbs_g: 14, fat_g: 0.5, sort_order: 2 }
      ];
    }
    if (requestPath.startsWith('user_food_logs?')) return [];
    if (requestPath.startsWith('lab_reports?') && requestPath.includes('select=id&limit=3')) return [{ id: 'lr1' }];
    if (requestPath.startsWith('lab_reports?') && requestPath.includes('normalized_payload')) {
      return [{
        id: 'lr1',
        is_valid: true,
        parse_status: 'processed',
        created_at: '2026-04-18T10:00:00Z',
        ai_insights: { summary: 'Ferritina baixa pede atenção.', clinical_flags: ['ferritina baixa'] },
        normalized_payload: {
          collection_date: '2026-04-17',
          biomarkers: [
            { marker_key: 'ferritin', marker_name: 'Ferritina', value_numeric: 18, unit: 'ng/mL', reference_min: 30, reference_max: 300, flag: 'low', feedback_summary: 'estoque baixo de ferro' },
            { marker_key: 'glucose', marker_name: 'Glicose', value_numeric: 88, unit: 'mg/dL', reference_text: '70 - 99', flag: 'normal' }
          ]
        }
      }];
    }
    if (requestPath.startsWith('lab_reports?')) return [{ id: 'lr1' }];
    if (requestPath.startsWith('workouts?')) {
      return [{ id: 'w1', date: '2026-04-20', duration_minutes: 55, notes: 'Push' }];
    }
    if (requestPath.startsWith('workout_logs?')) {
      return [{ workout_id: 'w1', exercise_id: 'e1', weight_kg: 80, reps: 8, rpe: 8, created_at: '2026-04-20T09:00:00Z' }];
    }
    if (requestPath.startsWith('exercises?')) {
      return [{ id: 'e1', name: 'Supino reto', muscle_group: 'Peitoral' }];
    }
    if (requestPath.startsWith('body_metrics?')) return [];
    if (requestPath.startsWith('user_memory_state?')) return [{ user_id: 'u1' }];
    return [];
  });

  const context = await hub.buildKronosContext({ userId: 'u1', message: 'Como estão dieta e exames?' });

  assert.equal(context.user.nome, 'Ana');
  assert.equal(context.user.objetivo, 'hipertrofia');
  assert.ok(context.contextoClinico.restricoes.includes('lactose'));
  assert.ok(context.contextoClinico.restricoes.includes('amendoim'));
  assert.ok(context.contextoClinico.preferencias.includes('arroz'));
  assert.ok(context.contextoClinico.preferencias.includes('aveia'));
  assert.ok(context.contextoClinico.patologias.includes('SOP'));
  assert.ok(context.contextoClinico.medicacoes.includes('metformina'));
  assert.ok(context.contextoClinico.observacoes.includes('SOP em acompanhamento'));
  assert.ok(context.contextoClinico.observacoes.includes('evitar refeições muito grandes à noite'));
  assert.equal(context.dieta.disponivel, true);
  assert.equal(context.dieta.refeicoes[0].nome, 'Almoço');
  assert.equal(context.dieta.refeicoes[0].itens[0].nome, 'Arroz');
  assert.equal(context.dieta.refeicoes[0].itens[0].gramas, 120);
  assert.equal(context.dieta.refeicoes[0].calorias, 232);
  assert.equal(context.treino.disponivel, true);
  assert.equal(context.treino.exercicios[0].nome, 'Supino reto');
  assert.equal(context.exames.disponivel, true);
  assert.equal(context.exames.dataUltimaColeta, '2026-04-17');
  assert.equal(context.exames.biomarcadores[0].nome, 'Ferritina');
  assert.equal(context.exames.biomarcadores[0].referencia, '30 - 300');
  assert.equal(context.exames.biomarcadores[0].status, 'baixo');
  assert.ok(context.exames.biomarcadores[0].observacoes.includes('estoque baixo de ferro'));
});

test('buildKronosSystemPrompt proíbe falta de acesso quando há exames e preserva gramas da dieta', function() {
  const prompt = require('../../src/ai/kronos/buildKronosSystemPrompt');
  const system = prompt.buildKronosSystemPrompt({
    generatedAt: '2026-04-20T00:00:00Z',
    user: { nome: 'Ana' },
    treino: { disponivel: false, exercicios: [] },
    dieta: {
      disponivel: true,
      refeicoes: [{ nome: 'Almoço', itens: [{ nome: 'Arroz', gramas: 120, calorias: 156 }] }]
    },
    exames: { disponivel: true, biomarcadores: [{ nome: 'Ferritina', valor: 18, unidade: 'ng/mL', status: 'baixo' }] },
    contextoClinico: { patologias: [], restricoes: [], medicacoes: [], sinais: [], preferencias: [] }
  }, 'lab_analysis');

  assert.match(system, /Se `exames\.disponivel === true`, você NÃO pode dizer que não tem acesso aos exames/);
  assert.match(system, /"gramas":120/);
  assert.match(system, /"Ferritina"/);
});

test('askKronos usa buildKronosContext e envia appContext para o LLM central', async function() {
  const service = require('../../src/ai/kronos/askKronos');
  let llmPayload = null;
  const result = await service.askKronos({
    message: 'Quanto tem de arroz?',
    userId: 'u1',
    intent: 'nutrition_feedback',
    buildKronosContext: async function() {
      return {
        generatedAt: '2026-04-20T00:00:00Z',
        user: {},
        treino: { disponivel: false, exercicios: [] },
        dieta: { disponivel: true, refeicoes: [{ nome: 'Almoço', itens: [{ nome: 'Arroz', gramas: 120 }] }] },
        exames: { disponivel: false, biomarcadores: [] },
        contextoClinico: { patologias: [], restricoes: [], medicacoes: [], sinais: [], preferencias: [] }
      };
    },
    callLLM: async function(payload) {
      llmPayload = payload;
      return 'Arroz: 120g.';
    }
  });

  assert.equal(result.response, 'Arroz: 120g.');
  assert.equal(llmPayload.appContext.dieta.refeicoes[0].itens[0].gramas, 120);
  assert.match(llmPayload.systemPrompt, /KRONOS_APP_CONTEXT/);
});

test('fluxos legados de chat usam askKronos como entrada central', function() {
  const apiChat = fs.readFileSync(path.resolve(__dirname, '../../api/chat.js'), 'utf8');
  const chatAgent = fs.readFileSync(path.resolve(__dirname, '../../src/lib/agents/chatAgent.js'), 'utf8');
  const supplementAgent = fs.readFileSync(path.resolve(__dirname, '../../src/lib/agents/supplementAgent.js'), 'utf8');
  const supplementStackAgent = fs.readFileSync(path.resolve(__dirname, '../../src/lib/agents/supplementStackAgent.js'), 'utf8');

  assert.match(apiChat, /askKronosService\.askKronos/);
  assert.match(apiChat, /buildKronosContext\(\{ userId: userId/);
  assert.match(chatAgent, /askKronos\(/);
  assert.doesNotMatch(chatAgent, /callClaude\(prompt\)/);
  assert.match(supplementAgent, /askKronos\(/);
  assert.doesNotMatch(supplementAgent, /callClaude\(prompt\)/);
  assert.match(supplementStackAgent, /askKronos\(/);
  assert.doesNotMatch(supplementStackAgent, /callClaude\(prompt\)/);
});
