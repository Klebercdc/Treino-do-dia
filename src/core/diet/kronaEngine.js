'use strict';

// KRONIA – Motor de Prescrição Nutricional Dinâmica
// Main orchestrator: wires nutritionService, dietBlockBuilder, substitutionEngine,
// rebalanceEngine and activeStateManager into a single public API.
//
// Public API:
//   generatePlan(profileInput)  → full plan + active state
//   getSubstitutions(state, mealOrdem, blockName) → ordered candidate list
//   swapFood(state, mealOrdem, blockName, newFoodCode) → updated state
//   removeBlock(state, mealOrdem, blockName) → updated state
//   adjustPortion(state, mealOrdem, blockName, newGrams) → updated state
//   renderForPrint(state) → printable prescription object

var nutritionService = require('../../lib/nutrition/nutritionService');
var blockBuilder     = require('./dietBlockBuilder');
var subEngine        = require('./substitutionEngine');
var rebalance        = require('./rebalanceEngine');
var stateManager     = require('./activeStateManager');

var round = function(v, d) {
  var f = Math.pow(10, typeof d === 'number' ? d : 1);
  return Math.round(Number(v || 0) * f) / f;
};

// ─── MEAL TEMPLATES (shared with nutritionService) ──────────────────────────

var MEAL_TEMPLATES = {
  3: [
    { tipo: 'cafe_da_manha',    nome: 'Café da manhã',       horario: '07:00', ordem: 1, proteinShare: 0.28, carbShare: 0.24, fatShare: 0.28 },
    { tipo: 'almoco',           nome: 'Almoço',              horario: '12:30', ordem: 2, proteinShare: 0.37, carbShare: 0.36, fatShare: 0.36 },
    { tipo: 'jantar',           nome: 'Jantar',              horario: '20:00', ordem: 3, proteinShare: 0.35, carbShare: 0.40, fatShare: 0.36 }
  ],
  4: [
    { tipo: 'cafe_da_manha',      nome: 'Café da manhã',       horario: '07:00', ordem: 1, proteinShare: 0.25, carbShare: 0.22, fatShare: 0.28 },
    { tipo: 'almoco',             nome: 'Almoço',              horario: '12:30', ordem: 2, proteinShare: 0.30, carbShare: 0.28, fatShare: 0.27 },
    { tipo: 'lanche_pre_treino',  nome: 'Pré-treino',          horario: '16:30', ordem: 3, proteinShare: 0.20, carbShare: 0.25, fatShare: 0.10 },
    { tipo: 'jantar_pos_treino',  nome: 'Pós-treino / Jantar', horario: '20:30', ordem: 4, proteinShare: 0.25, carbShare: 0.25, fatShare: 0.35 }
  ],
  5: [
    { tipo: 'cafe_da_manha',      nome: 'Café da manhã',       horario: '07:00', ordem: 1, proteinShare: 0.22, carbShare: 0.17, fatShare: 0.24 },
    { tipo: 'lanche_manha',       nome: 'Lanche da manhã',     horario: '10:00', ordem: 2, proteinShare: 0.13, carbShare: 0.12, fatShare: 0.15 },
    { tipo: 'almoco',             nome: 'Almoço',              horario: '12:30', ordem: 3, proteinShare: 0.25, carbShare: 0.22, fatShare: 0.22 },
    { tipo: 'lanche_pre_treino',  nome: 'Pré-treino',          horario: '16:30', ordem: 4, proteinShare: 0.16, carbShare: 0.24, fatShare: 0.08 },
    { tipo: 'jantar_pos_treino',  nome: 'Pós-treino / Jantar', horario: '20:30', ordem: 5, proteinShare: 0.24, carbShare: 0.25, fatShare: 0.31 }
  ],
  6: [
    { tipo: 'cafe_da_manha',      nome: 'Café da manhã',       horario: '07:00', ordem: 1, proteinShare: 0.20, carbShare: 0.15, fatShare: 0.22 },
    { tipo: 'lanche_manha',       nome: 'Lanche da manhã',     horario: '09:45', ordem: 2, proteinShare: 0.13, carbShare: 0.11, fatShare: 0.13 },
    { tipo: 'almoco',             nome: 'Almoço',              horario: '12:30', ordem: 3, proteinShare: 0.22, carbShare: 0.18, fatShare: 0.22 },
    { tipo: 'lanche_pre_treino',  nome: 'Pré-treino',          horario: '15:45', ordem: 4, proteinShare: 0.14, carbShare: 0.20, fatShare: 0.08 },
    { tipo: 'jantar_pos_treino',  nome: 'Pós-treino / Jantar', horario: '19:30', ordem: 5, proteinShare: 0.20, carbShare: 0.24, fatShare: 0.18 },
    { tipo: 'ceia',               nome: 'Ceia',                horario: '22:00', ordem: 6, proteinShare: 0.11, carbShare: 0.12, fatShare: 0.17 }
  ]
};

function getMealTemplates(profile) {
  var count = Math.min(6, Math.max(3, Number(profile.refeicoesPorDia || 5)));
  var templates = MEAL_TEMPLATES[count] || MEAL_TEMPLATES[5];

  // Remap workout-specific slots if user is sedentary
  if (profile.nivelAtividade === 'sedentario') {
    return templates.map(function(t) {
      if (t.tipo === 'lanche_pre_treino')  return Object.assign({}, t, { tipo: 'lanche_tarde', nome: 'Lanche da tarde' });
      if (t.tipo === 'jantar_pos_treino')  return Object.assign({}, t, { tipo: 'jantar', nome: 'Jantar' });
      return t;
    });
  }
  return templates;
}

// ─── PRESCRIPTION METADATA ──────────────────────────────────────────────────

function buildPrescriptionMeta(strategy) {
  var calc = strategy.result;
  if (!calc) return null;
  return {
    tmb: calc.tmb,
    get: calc.get,
    kcal_meta: calc.targetCalories,
    metas: {
      proteinas:    calc.macros.protein,
      carboidratos: calc.macros.carbs,
      gorduras:     calc.macros.fat
    },
    formula: 'Mifflin-St Jeor + ajuste por objetivo e nível de atividade',
    objetivo: calc.objective,
    fator_atividade: calc.activityFactor
  };
}

function buildOrientations(profile) {
  var orientacoes = [
    'Beba pelo menos 35 ml de água por kg de peso corporal ao longo do dia.',
    'Mastigue bem os alimentos e coma sem distrações.',
    'Respeite os horários das refeições para manter a regularidade metabólica.'
  ];

  var objetivo = String(profile.objetivo || '').toLowerCase();
  if (/emagrec/.test(objetivo)) {
    orientacoes.push('Priorize proteínas e fibras em cada refeição para maior saciedade.');
    orientacoes.push('Evite longos períodos em jejum para preservar massa muscular.');
  }
  if (/hipertrof/.test(objetivo)) {
    orientacoes.push('Consuma proteína de qualidade em todas as refeições para síntese muscular.');
    orientacoes.push('O pré e pós-treino são janelas nutricionais críticas. Não as pule.');
  }
  if (profile.patologias && profile.patologias.some(function(p) { return /diabetes/i.test(p); })) {
    orientacoes.push('Distribua os carboidratos de forma uniforme ao longo do dia.');
    orientacoes.push('Prefira fontes de baixo índice glicêmico: legumes, leguminosas e grãos integrais.');
  }
  if (profile.patologias && profile.patologias.some(function(p) { return /hipertens/i.test(p); })) {
    orientacoes.push('Reduza o consumo de sal e alimentos industrializados ricos em sódio.');
  }

  return orientacoes;
}

function buildSequencia(templates) {
  return templates.map(function(t) {
    if (/almoco|jantar/.test(t.tipo)) return t.nome + ': Salada → Legumes → Proteína + Carbo + Leguminosa → Gordura';
    if (/cafe/.test(t.tipo))          return t.nome + ': Proteína → Carbo → Gordura';
    return t.nome + ': Proteína → Carbo';
  });
}

// ─── MAIN GENERATE FUNCTION ─────────────────────────────────────────────────

/**
 * Generates a complete KRONIA diet plan and initializes the active state.
 *
 * @param {object} profileInput - raw user input (same fields as nutritionService)
 * @returns {{ activeState, plan, prescription, strategy, error? }}
 */
function generatePlan(profileInput) {
  try {
    var strategy = nutritionService.calculateNutrition(profileInput || {});

    if (strategy.failSafe) {
      return {
        error: strategy.limitedOrientation || { reason: 'Dados insuficientes' },
        failSafe: true,
        activeState: null,
        plan: null
      };
    }

    var profile = strategy.profile;
    var calc     = strategy.result;
    var templates = getMealTemplates(profile);

    // Build each meal with its block structure
    var refeicoes = templates.map(function(template) {
      var mealMacroTarget = {
        calories: round((calc.macros.protein * template.proteinShare * 4) +
                        (calc.macros.carbs   * template.carbShare   * 4) +
                        (calc.macros.fat     * template.fatShare    * 9), 0),
        protein: round(calc.macros.protein * template.proteinShare, 1),
        carbs:   round(calc.macros.carbs   * template.carbShare,   1),
        fat:     round(calc.macros.fat     * template.fatShare,    1)
      };
      return blockBuilder.buildMeal(template, mealMacroTarget);
    });

    // Normalise meta fields to Portuguese keys
    refeicoes = refeicoes.map(function(meal) {
      return Object.assign({}, meal, {
        meta: {
          calorias:     meal.meta.calorias || meal.meta.calories || 0,
          proteinas:    meal.meta.proteinas || meal.meta.protein || 0,
          carboidratos: meal.meta.carboidratos || meal.meta.carbs || 0,
          gorduras:     meal.meta.gorduras || meal.meta.fat || 0
        }
      });
    });

    // Rebalance each meal
    refeicoes = refeicoes.map(function(meal) {
      return rebalance.rebalanceMeal(meal);
    });

    var daily = refeicoes.reduce(function(acc, meal) {
      acc.calorias     += Number((meal.subtotal && meal.subtotal.calorias)     || 0);
      acc.proteinas    += Number((meal.subtotal && meal.subtotal.proteinas)    || 0);
      acc.carboidratos += Number((meal.subtotal && meal.subtotal.carboidratos) || 0);
      acc.gorduras     += Number((meal.subtotal && meal.subtotal.gorduras)     || 0);
      acc.fibras       += Number((meal.subtotal && meal.subtotal.fibras)       || 0);
      return acc;
    }, { calorias: 0, proteinas: 0, carboidratos: 0, gorduras: 0, fibras: 0 });

    var daily_rounded = {
      calorias:     round(daily.calorias, 0),
      proteinas:    round(daily.proteinas, 1),
      carboidratos: round(daily.carboidratos, 1),
      gorduras:     round(daily.gorduras, 1),
      fibras:       round(daily.fibras, 1)
    };

    // Build profile with patologias field for substitution engine
    var enrichedProfile = Object.assign({}, profile, {
      patologias: profileInput.patologias || profileInput.patologia || [],
      restricoes: profile.restricoesAlimentares || [],
      preferencias: profile.preferencias || [],
      alimentosEvitar: profile.alimentosEvitar || []
    });

    var prescription = {
      metas: buildPrescriptionMeta(strategy),
      orientacoes: buildOrientations(enrichedProfile),
      sequencia_consumo: buildSequencia(templates),
      observacoes: (strategy.strategy && strategy.strategy.adjustments) || []
    };

    var plan = {
      prescription: prescription,
      refeicoes: refeicoes,
      resumo_diario: daily_rounded
    };

    var activeState = stateManager.initActiveState(plan, enrichedProfile);

    return {
      failSafe: false,
      activeState: activeState,
      plan: plan,
      prescription: prescription,
      strategy: {
        tmb: calc.tmb,
        get: calc.get,
        targetCalories: calc.targetCalories,
        macros: calc.macros,
        objective: calc.objective
      }
    };
  } catch (err) {
    return {
      error: { reason: err.message || 'Erro interno no motor' },
      failSafe: true,
      activeState: null,
      plan: null
    };
  }
}

// ─── EDIT OPERATIONS (thin wrappers that return { state, message, warnings }) ─

function getSubstitutions(state, mealOrdem, blockName) {
  var meal = (state.refeicoes || []).find(function(m) { return m.ordem === mealOrdem; });
  if (!meal) return { options: [], error: 'Refeição não encontrada' };

  var block = meal.blocos && meal.blocos[blockName];
  if (!block) return { options: [], error: 'Bloco não encontrado' };

  var profile = state.profile || {};
  var options = subEngine.getSubstitutionOptions(
    block.grupo_equivalencia,
    profile,
    block.alvo_nutricional || {},
    block.food_code
  );

  return { options: options, error: null };
}

function swapFood(state, mealOrdem, blockName, newFoodCode) {
  return stateManager.swapFood(state, mealOrdem, blockName, newFoodCode);
}

function removeBlock(state, mealOrdem, blockName) {
  return stateManager.removeBlock(state, mealOrdem, blockName);
}

function adjustPortion(state, mealOrdem, blockName, newGrams) {
  return stateManager.adjustPortion(state, mealOrdem, blockName, newGrams);
}

function renderForPrint(state) {
  return stateManager.renderForPrint(state);
}

module.exports = {
  generatePlan: generatePlan,
  getSubstitutions: getSubstitutions,
  swapFood: swapFood,
  removeBlock: removeBlock,
  adjustPortion: adjustPortion,
  renderForPrint: renderForPrint
};
