'use strict';

var ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
var MODEL = 'claude-sonnet-4-6';
var TIMEOUT_MS = 12000;

var MEAL_SLOT_SETS = {
  3: ['cafe_da_manha', 'almoco', 'jantar'],
  4: ['cafe_da_manha', 'almoco', 'lanche_tarde', 'jantar'],
  5: ['cafe_da_manha', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar'],
  6: ['cafe_da_manha', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia']
};

function getMealSlots(mealCount) {
  return MEAL_SLOT_SETS[mealCount] || MEAL_SLOT_SETS[5];
}

function buildSystemPrompt() {
  return [
    'Você é um estrategista de nutrição esportiva. Sua função é definir INTENÇÃO nutricional para cada refeição — nunca alimentos concretos nem macros finais.',
    'A engine matemática valida e calcula tudo. Você decide: qual refeição deve ser mais pesada, onde concentrar proteína, quando usar carbo rápido, quando evitar gordura.',
    '',
    'Regras obrigatórias:',
    '- Responda APENAS com JSON puro, sem markdown, sem texto fora do objeto.',
    '- A soma de proteinShare de todas as refeições deve ser exatamente 1.0 (tolerância ±0.04).',
    '- A soma de carbShare de todas as refeições deve ser exatamente 1.0 (tolerância ±0.04).',
    '- A soma de fatShare de todas as refeições deve ser exatamente 1.0 (tolerância ±0.04).',
    '- Cada share deve ser um número com 2 casas decimais entre 0.05 e 0.50.',
    '- mealIntentions deve ter uma entrada para CADA slot de refeição listado.',
    '- forbiddenFoods e preferredFoods usam apenas nomes genéricos (frango, arroz, banana) — nunca invente alimentos.',
    '- Considere sempre rotina, fadiga, horário de treino, objetivo, aderência e restrições clínicas.',
  ].join('\n');
}

function buildUserMessage(params) {
  var profile = params.profile || {};
  var trainingContext = params.trainingContext || profile.contextoTreino || {};
  var clinicalContext = params.clinicalContext || profile.clinicalData || {};
  var adherenceContext = params.adherenceContext || profile.aderencia || {};
  var adaptiveMemory = params.adaptiveMemory || {};
  var selectedTemplate = params.selectedDietTemplate || null;

  var mealCount = Math.min(6, Math.max(3, Number(profile.refeicoesPorDia || 5)));
  var mealSlots = getMealSlots(mealCount);

  var payload = {
    objetivo: profile.objetivo || 'manutencao',
    sexo: profile.sexo || null,
    idade: profile.idade || null,
    peso: profile.peso || null,
    altura: profile.altura || null,
    nivelAtividade: profile.nivelAtividade || 'moderado',
    refeicoesPorDia: mealCount,
    slotsRefeicao: mealSlots,
    restricoes: profile.restricoesAlimentares || [],
    preferencias: profile.preferencias || [],
    alimentosEvitar: profile.alimentosEvitar || [],
    treino: {
      ativo: !!(trainingContext.hasTraining || (trainingContext.modalidades && trainingContext.modalidades.length)),
      modalidades: trainingContext.modalidades || [],
      horarioTreino: adherenceContext.workout_time || null,
      fadiga: trainingContext.fadiga != null ? trainingContext.fadiga : null,
      dorMuscular: trainingContext.dorMuscular || null,
      quedaRendimento: trainingContext.quedaRendimento || null,
    },
    clinico: {
      condicoes: clinicalContext.healthConditions || [],
      hasDiabetes: !!(clinicalContext.flags && clinicalContext.flags.hasDiabetes),
      hasDoencaRenal: !!(clinicalContext.flags && clinicalContext.flags.hasDoencaRenal),
      hasGastriteRefluxo: !!(clinicalContext.flags && clinicalContext.flags.hasGastriteRefluxo),
      hasDislipidemia: !!(clinicalContext.flags && clinicalContext.flags.hasDislipidemia),
      hasPosBariatrica: !!(clinicalContext.flags && clinicalContext.flags.hasPosBariatrica),
    },
    aderencia: {
      orcamento: adherenceContext.budget_level || null,
      habilidadeCozinha: adherenceContext.cooking_skill || null,
      periodoFome: adherenceContext.hunger_period || null,
      adesao: adherenceContext.adesao || null,
      sono: profile.saude && profile.saude.sono || null,
      estresse: profile.saude && profile.saude.estresse || null,
    },
    memoria: {
      alimentosPreferidos: (adaptiveMemory.liked_foods || []).slice(0, 5),
      alimentosRejeitados: (adaptiveMemory.frequent_rejections || adaptiveMemory.disliked_foods || []).slice(0, 5),
      estiloPreferido: adaptiveMemory.preferred_diet_style || null,
      contagemRefeicoes: adaptiveMemory.preferred_meal_count || null,
    },
    estrategiaTemplate: selectedTemplate ? selectedTemplate.estrategia_nutricional : null,
    formatoEsperado: {
      strategyType: 'string (ex: hipertrofia_alta_proteina, emagrecimento_moderado, performance_carb_ciclado, manutencao_equilibrado)',
      mealTimingLogic: 'string (ex: treino_manha_cafe_leve_pre_carbo, treino_tarde_almoco_carbo_pre, sem_treino_uniforme)',
      macroDistribution: {
        '[slot]': {
          proteinShare: 'number (ex: 0.22)',
          carbShare: 'number (ex: 0.20)',
          fatShare: 'number (ex: 0.22)'
        }
      },
      foodSelectionGuidelines: ['string: diretriz de seleção de alimento'],
      mealIntentions: {
        '[slot]': {
          weight: 'leve|moderado|pesado',
          proteinFocus: 'baixo|moderado|alto',
          carbFocus: 'complexo|simples|baixo|pre_treino|pos_treino',
          avoidFat: 'boolean',
          preworkout: 'boolean',
          postworkout: 'boolean',
          description: 'string curta (1 frase)'
        }
      },
      clinicalConstraints: ['string'],
      adherenceRules: ['string'],
      forbiddenFoods: ['string (nome genérico)'],
      preferredFoods: ['string (nome genérico)'],
      explanation: 'string (2-3 frases explicando a estratégia)'
    }
  };

  return JSON.stringify(payload);
}

function validateMacroShares(macroDistribution, mealSlots) {
  if (!macroDistribution || typeof macroDistribution !== 'object') return false;
  var slots = Array.isArray(mealSlots) && mealSlots.length ? mealSlots : Object.keys(macroDistribution);
  if (!slots.length) return false;

  var proteinSum = 0;
  var carbSum = 0;
  var fatSum = 0;

  for (var i = 0; i < slots.length; i++) {
    var dist = macroDistribution[slots[i]];
    if (!dist || typeof dist !== 'object') return false;
    var ps = Number(dist.proteinShare);
    var cs = Number(dist.carbShare);
    var fs = Number(dist.fatShare);
    if (!Number.isFinite(ps) || !Number.isFinite(cs) || !Number.isFinite(fs)) return false;
    if (ps < 0 || cs < 0 || fs < 0) return false;
    proteinSum += ps;
    carbSum += cs;
    fatSum += fs;
  }

  var tolerance = 0.08;
  return (
    Math.abs(proteinSum - 1.0) <= tolerance &&
    Math.abs(carbSum - 1.0) <= tolerance &&
    Math.abs(fatSum - 1.0) <= tolerance
  );
}

function normalizeMacroShares(macroDistribution) {
  var slots = Object.keys(macroDistribution || {});
  var result = {};

  var proteinSum = 0;
  var carbSum = 0;
  var fatSum = 0;

  slots.forEach(function(slot) {
    var dist = macroDistribution[slot] || {};
    proteinSum += Math.max(0, Number(dist.proteinShare) || 0);
    carbSum += Math.max(0, Number(dist.carbShare) || 0);
    fatSum += Math.max(0, Number(dist.fatShare) || 0);
  });

  var pDivisor = proteinSum > 0 ? proteinSum : 1;
  var cDivisor = carbSum > 0 ? carbSum : 1;
  var fDivisor = fatSum > 0 ? fatSum : 1;

  slots.forEach(function(slot) {
    var dist = macroDistribution[slot] || {};
    result[slot] = {
      proteinShare: Math.round((Math.max(0, Number(dist.proteinShare) || 0) / pDivisor) * 100) / 100,
      carbShare: Math.round((Math.max(0, Number(dist.carbShare) || 0) / cDivisor) * 100) / 100,
      fatShare: Math.round((Math.max(0, Number(dist.fatShare) || 0) / fDivisor) * 100) / 100,
    };
  });

  return result;
}

function validateStrategy(strategy, mealSlots) {
  if (!strategy || typeof strategy !== 'object') return false;
  if (!strategy.strategyType || typeof strategy.strategyType !== 'string') return false;
  if (!strategy.mealIntentions || typeof strategy.mealIntentions !== 'object') return false;
  if (!strategy.macroDistribution || typeof strategy.macroDistribution !== 'object') return false;

  var slots = Array.isArray(mealSlots) ? mealSlots : [];
  for (var i = 0; i < slots.length; i++) {
    if (!strategy.mealIntentions[slots[i]]) return false;
  }

  return true;
}

function parseAIResponse(text) {
  var cleaned = String(text || '').trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  var firstBrace = cleaned.indexOf('{');
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
  return JSON.parse(cleaned);
}

function sanitizeArrayField(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(function(item) { return item && typeof item === 'string'; }).slice(0, 10);
}

function sanitizeStrategy(strategy, mealSlots) {
  return {
    strategyType: String(strategy.strategyType || 'estrategia_padrao'),
    mealTimingLogic: String(strategy.mealTimingLogic || 'uniforme'),
    macroDistribution: strategy.macroDistribution || {},
    foodSelectionGuidelines: sanitizeArrayField(strategy.foodSelectionGuidelines),
    mealIntentions: strategy.mealIntentions || {},
    clinicalConstraints: sanitizeArrayField(strategy.clinicalConstraints),
    adherenceRules: sanitizeArrayField(strategy.adherenceRules),
    forbiddenFoods: sanitizeArrayField(strategy.forbiddenFoods),
    preferredFoods: sanitizeArrayField(strategy.preferredFoods),
    explanation: String(strategy.explanation || ''),
    _aiGenerated: true,
    _mealSlots: mealSlots,
  };
}

async function callAnthropicAPI(systemPrompt, userMessage) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timeoutId = controller
    ? setTimeout(function() { controller.abort(); }, TIMEOUT_MS)
    : null;

  try {
    var response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      }),
      signal: controller ? controller.signal : undefined
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      var errorText = '';
      try { errorText = await response.text(); } catch (_) {}
      throw new Error('Anthropic API ' + response.status + ': ' + errorText.slice(0, 120));
    }

    var data = await response.json();
    var content = data && data.content && data.content[0] && data.content[0].text;
    if (!content) throw new Error('Empty AI response');
    return content;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    throw err;
  }
}

async function buildAIStrategy(params) {
  var profile = params && params.profile ? params.profile : (params || {});
  var mealCount = Math.min(6, Math.max(3, Number(profile.refeicoesPorDia || 5)));
  var mealSlots = getMealSlots(mealCount);

  if (process.env.NODE_ENV === 'development') {
    console.log('[AI_NUTRITION_STRATEGY] Building strategy for objective:', profile.objetivo, '| meals:', mealCount);
  }

  try {
    var systemPrompt = buildSystemPrompt();
    var userMessage = buildUserMessage(params);
    var responseText = await callAnthropicAPI(systemPrompt, userMessage);

    var parsed = parseAIResponse(responseText);

    if (!validateStrategy(parsed, mealSlots)) {
      console.warn('[DIET_FALLBACK_ENGINE] AI strategy validation failed — missing required fields. Using engine fallback.');
      return null;
    }

    var validShares = validateMacroShares(parsed.macroDistribution, mealSlots);
    if (!validShares) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[AI_MACRO_DISTRIBUTION] Shares not summing to 1.0 — normalizing.');
      }
      parsed.macroDistribution = normalizeMacroShares(parsed.macroDistribution);
    }

    var strategy = sanitizeStrategy(parsed, mealSlots);

    if (process.env.NODE_ENV === 'development') {
      console.log('[AI_NUTRITION_STRATEGY] Strategy type:', strategy.strategyType);
      console.log('[AI_MACRO_DISTRIBUTION] Distribution:', JSON.stringify(strategy.macroDistribution));
      console.log('[AI_FOOD_INTENT] Intentions:', JSON.stringify(strategy.mealIntentions));
    }

    return strategy;
  } catch (err) {
    console.warn('[DIET_FALLBACK_ENGINE] AI strategy failed:', String(err && err.message || err));
    return null;
  }
}

module.exports = {
  buildAIStrategy: buildAIStrategy,
  buildSystemPrompt: buildSystemPrompt,
  buildUserMessage: buildUserMessage,
  getMealSlots: getMealSlots,
  validateMacroShares: validateMacroShares,
  normalizeMacroShares: normalizeMacroShares,
  validateStrategy: validateStrategy,
  parseAIResponse: parseAIResponse,
};
