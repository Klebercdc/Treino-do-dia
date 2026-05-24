'use strict';

var ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
var MODEL = 'claude-sonnet-4-6';
var TIMEOUT_MS = 15000;

var MEAL_SLOT_SETS = {
  3: ['cafe_da_manha', 'almoco', 'jantar'],
  4: ['cafe_da_manha', 'almoco', 'lanche_tarde', 'jantar'],
  5: ['cafe_da_manha', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar'],
  6: ['cafe_da_manha', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia']
};

function getMealSlots(mealCount) {
  return MEAL_SLOT_SETS[Math.min(6, Math.max(3, mealCount || 5))] || MEAL_SLOT_SETS[5];
}

function buildSystemPrompt() {
  return [
    'Você é um orquestrador de nutrição esportiva. Cria blueprints estratégicos de alimentação — NUNCA escolhe alimentos finais.',
    '',
    'REGRAS ABSOLUTAS:',
    '- Responda APENAS com JSON puro, sem markdown, sem texto fora do objeto JSON.',
    '- suggestedAliases: use apenas nomes genéricos (ex: "frango", "aveia", "banana"). NUNCA marcas ou preparos específicos.',
    '- Cada foodRole deve ter 3 a 5 suggestedAliases DISTINTOS — varie para evitar padrão repetitivo.',
    '- NÃO repita o mesmo alimento em múltiplos roles da mesma refeição.',
    '- Para hipertrofia: proteínas variadas — alterne entre frango, tilapia, atum, salmão, patinho, carne moída, ovo.',
    '- Para carbos de refeição principal: alterne entre arroz integral, batata-doce, quinoa, mandioca, macarrão integral.',
    '- Para café da manhã: alterne entre ovos, iogurte grego, cottage, whey protein, tofu mexido.',
    '- Para emagrecimento: priorize proteínas magras, vegetais volumosos, carbos complexos com baixo IG.',
    '- A soma de proteinShare deve ser 1.0 (±0.05) somando todos os slots. Idem carbShare e fatShare.',
    '- mealBlueprints deve ter UMA entrada para CADA slot listado em slotsRefeicao.',
    '- Considere: objetivo, fadiga, horário de treino, restrições clínicas, alimentos rejeitados.',
    '- Gere ALTA DIVERSIDADE de aliases — não sugira sempre os mesmos alimentos para o mesmo objetivo.',
  ].join('\n');
}

function buildUserMessage(params) {
  var profile = params.profile || {};
  var trainingContext = params.trainingContext || profile.contextoTreino || {};
  var clinicalContext = params.clinicalContext || profile.clinicalData || {};
  var adherenceContext = params.adherenceContext || profile.aderencia || {};
  var adaptiveMemory = params.adaptiveMemory || {};
  var calculation = params.calculation || {};

  var mealCount = Math.min(6, Math.max(3, Number(profile.refeicoesPorDia || 5)));
  var mealSlots = getMealSlots(mealCount);

  var payload = {
    objetivo: profile.objetivo || 'manutencao',
    sexo: profile.sexo || null,
    idade: profile.idade || null,
    peso: profile.peso || null,
    nivelAtividade: profile.nivelAtividade || 'moderado',
    refeicoesPorDia: mealCount,
    slotsRefeicao: mealSlots,
    restricoes: profile.restricoesAlimentares || profile.restricoes || [],
    preferencias: profile.preferencias || [],
    alimentosEvitar: profile.alimentosEvitar || [],
    calorias: calculation.targetCalories || null,
    treino: {
      ativo: !!(trainingContext.hasTraining || (trainingContext.modalidades && trainingContext.modalidades.length)),
      modalidades: trainingContext.modalidades || [],
      horarioTreino: adherenceContext.workout_time || null,
      fadiga: trainingContext.fadiga != null ? trainingContext.fadiga : null,
    },
    clinico: {
      hasDiabetes: !!(clinicalContext.flags && clinicalContext.flags.hasDiabetes),
      hasDoencaRenal: !!(clinicalContext.flags && clinicalContext.flags.hasDoencaRenal),
      hasGastriteRefluxo: !!(clinicalContext.flags && clinicalContext.flags.hasGastriteRefluxo),
      hasDislipidemia: !!(clinicalContext.flags && clinicalContext.flags.hasDislipidemia),
    },
    memoria: {
      alimentosPreferidos: (adaptiveMemory.liked_foods || []).slice(0, 5),
      alimentosRejeitados: (adaptiveMemory.frequent_rejections || []).slice(0, 5),
    },
    formatoEsperado: {
      strategyName: 'string (ex: hipertrofia_alta_proteina_ciclagem_carbo)',
      reasoningSummary: 'string (2-3 frases explicando a estratégia)',
      mealBlueprints: [
        {
          tipo: 'string (slot exato de slotsRefeicao)',
          nome: 'string (ex: Almoço)',
          horario: 'string (ex: 12:30)',
          intention: 'string (objetivo desta refeição, ex: Proteína de recuperação pós-treino com carbo moderado)',
          macroFocus: 'string (ex: proteina_alta_carbo_moderado)',
          digestionProfile: 'leve|medio|pesado',
          satietyLevel: 'baixo|moderado|alto',
          foodRoles: [
            {
              role: 'protein|carb|fat|fiber|fluid|optional',
              preferredCharacteristics: 'string (ex: rápida absorção, baixo custo)',
              avoidCharacteristics: 'string (ex: alto teor de gordura)',
              suggestedAliases: ['3 a 5 nomes genéricos variados para busca no catálogo']
            }
          ]
        }
      ],
      macroDistribution: {
        '[slot de slotsRefeicao]': {
          proteinShare: 'number (0.05-0.45)',
          carbShare: 'number (0.05-0.45)',
          fatShare: 'number (0.05-0.45)'
        }
      },
      validationWarnings: ['string']
    }
  };

  return JSON.stringify(payload);
}

function validateBlueprint(blueprint, mealSlots) {
  if (!blueprint || typeof blueprint !== 'object') return false;
  if (!blueprint.strategyName || typeof blueprint.strategyName !== 'string') return false;
  if (!Array.isArray(blueprint.mealBlueprints) || !blueprint.mealBlueprints.length) return false;
  if (!blueprint.macroDistribution || typeof blueprint.macroDistribution !== 'object') return false;

  var bpTypes = blueprint.mealBlueprints.map(function(b) { return b && b.tipo; });
  for (var i = 0; i < mealSlots.length; i++) {
    if (bpTypes.indexOf(mealSlots[i]) === -1) return false;
  }

  for (var j = 0; j < blueprint.mealBlueprints.length; j++) {
    var bp = blueprint.mealBlueprints[j];
    if (!bp || !bp.tipo) return false;
    if (!Array.isArray(bp.foodRoles) || !bp.foodRoles.length) return false;
    for (var k = 0; k < bp.foodRoles.length; k++) {
      var role = bp.foodRoles[k];
      if (!role || !role.role) return false;
      if (!Array.isArray(role.suggestedAliases) || !role.suggestedAliases.length) return false;
    }
  }

  return true;
}

function normalizeMacroDistribution(macroDistribution) {
  var slots = Object.keys(macroDistribution || {});
  if (!slots.length) return {};

  var pSum = 0, cSum = 0, fSum = 0;
  slots.forEach(function(slot) {
    var d = macroDistribution[slot] || {};
    pSum += Math.max(0, Number(d.proteinShare) || 0);
    cSum += Math.max(0, Number(d.carbShare) || 0);
    fSum += Math.max(0, Number(d.fatShare) || 0);
  });

  var pDiv = pSum > 0 ? pSum : 1;
  var cDiv = cSum > 0 ? cSum : 1;
  var fDiv = fSum > 0 ? fSum : 1;

  var result = {};
  slots.forEach(function(slot) {
    var d = macroDistribution[slot] || {};
    result[slot] = {
      proteinShare: Math.round((Math.max(0, Number(d.proteinShare) || 0) / pDiv) * 100) / 100,
      carbShare: Math.round((Math.max(0, Number(d.carbShare) || 0) / cDiv) * 100) / 100,
      fatShare: Math.round((Math.max(0, Number(d.fatShare) || 0) / fDiv) * 100) / 100,
    };
  });
  return result;
}

function sanitizeBlueprint(blueprint, mealSlots) {
  var sanitizedMeals = (blueprint.mealBlueprints || []).map(function(bp) {
    return {
      tipo: String(bp.tipo || ''),
      nome: String(bp.nome || ''),
      horario: String(bp.horario || ''),
      intention: String(bp.intention || ''),
      macroFocus: String(bp.macroFocus || ''),
      digestionProfile: String(bp.digestionProfile || 'medio'),
      satietyLevel: String(bp.satietyLevel || 'moderado'),
      foodRoles: (bp.foodRoles || [])
        .filter(function(r) { return r && r.role && Array.isArray(r.suggestedAliases) && r.suggestedAliases.length; })
        .map(function(r) {
          return {
            role: String(r.role),
            preferredCharacteristics: String(r.preferredCharacteristics || ''),
            avoidCharacteristics: String(r.avoidCharacteristics || ''),
            suggestedAliases: r.suggestedAliases
              .filter(function(a) { return a && typeof a === 'string' && a.trim(); })
              .slice(0, 6)
          };
        })
    };
  });

  return {
    aiGenerated: true,
    strategyName: String(blueprint.strategyName || 'estrategia_ai'),
    reasoningSummary: String(blueprint.reasoningSummary || ''),
    mealBlueprints: sanitizedMeals,
    macroDistribution: normalizeMacroDistribution(blueprint.macroDistribution),
    validationWarnings: Array.isArray(blueprint.validationWarnings) ? blueprint.validationWarnings : [],
    _mealSlots: mealSlots,
    fallbackEngine: false,
  };
}

function parseAIResponse(text) {
  var cleaned = String(text || '').trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  var firstBrace = cleaned.indexOf('{');
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
  return JSON.parse(cleaned);
}

async function callAnthropicAPI(systemPrompt, userMessage) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timeoutId = controller ? setTimeout(function() { controller.abort(); }, TIMEOUT_MS) : null;

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
        max_tokens: 2048,
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

async function generateAINutritionBlueprint(params) {
  var profile = params && params.profile ? params.profile : (params || {});
  var mealCount = Math.min(6, Math.max(3, Number(profile.refeicoesPorDia || 5)));
  var mealSlots = getMealSlots(mealCount);

  if (process.env.NODE_ENV === 'development') {
    console.log('[AI_NUTRITION_ORCHESTRATOR] Generating blueprint for:', profile.objetivo, '| meals:', mealCount);
  }

  try {
    var systemPrompt = buildSystemPrompt();
    var userMessage = buildUserMessage(params);
    var responseText = await callAnthropicAPI(systemPrompt, userMessage);
    var parsed = parseAIResponse(responseText);

    if (!validateBlueprint(parsed, mealSlots)) {
      console.warn('[DIET_FALLBACK_ENGINE] Blueprint validation failed — missing required fields.');
      return null;
    }

    var blueprint = sanitizeBlueprint(parsed, mealSlots);

    if (process.env.NODE_ENV === 'development') {
      console.log('[AI_BLUEPRINT_VALID] Strategy:', blueprint.strategyName, '| meals:', blueprint.mealBlueprints.length);
    }

    return blueprint;
  } catch (err) {
    console.warn('[DIET_FALLBACK_ENGINE] Blueprint generation failed:', String(err && err.message || err));
    return null;
  }
}

module.exports = {
  generateAINutritionBlueprint: generateAINutritionBlueprint,
  validateBlueprint: validateBlueprint,
  normalizeMacroDistribution: normalizeMacroDistribution,
  sanitizeBlueprint: sanitizeBlueprint,
  parseAIResponse: parseAIResponse,
  getMealSlots: getMealSlots,
  buildSystemPrompt: buildSystemPrompt,
  buildUserMessage: buildUserMessage,
};
