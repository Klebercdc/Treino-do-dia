/**
 * Compat layer de dieta para KRONOS.
 * Encaminha cálculo e plano para o nutritionService mantendo formato legado.
 */

var nutritionService = require('../../lib/nutrition/nutritionService');

function round(v, decimals) {
  return nutritionService.round(v, decimals);
}

function calculateCalories(profile) {
  var result = nutritionService.calculateNutrition(profile || {});
  if (result.failSafe) return null;
  return result.result.targetCalories;
}

function calculateMacros(calorias, peso, objetivo) {
  var syntheticProfile = {
    sexo: 'masculino',
    idade: 30,
    peso: peso,
    altura: 170,
    objetivo: objetivo,
    nivelAtividade: 'moderado'
  };
  var base = nutritionService.calculateNutrition(syntheticProfile);
  if (base.failSafe) return { proteina: 0, carbo: 0, gordura: 0 };

  var macros = base.result.macros;
  if (typeof calorias === 'number' && calorias > 0 && calorias !== base.result.targetCalories) {
    var protein = macros.protein;
    var fat = macros.fat;
    var carbs = round((calorias - (protein * 4) - (fat * 9)) / 4, 1);
    return { proteina: protein, carbo: carbs, gordura: fat };
  }

  return { proteina: macros.protein, carbo: macros.carbs, gordura: macros.fat };
}

function toLegacyMeals(planMeals) {
  return (planMeals || []).map(function(meal) {
    var alimentos = Array.isArray(meal.itens) ? meal.itens.map(function(item) {
      return {
        nome: item.nome,
        qtde: item.porcao,
        kcal: item.calorias,
        prot: item.proteinas,
        carb: item.carboidratos,
        gord: item.gorduras
      };
    }) : [];
    var proteinas = alimentos.filter(function(item) { return Number(item.prot || 0) >= 8; }).map(function(item) {
      return item.nome + ' (' + item.qtde + ')';
    });
    var carbos = alimentos.filter(function(item) { return Number(item.carb || 0) >= 8; }).map(function(item) {
      return item.nome + ' (' + item.qtde + ')';
    });
    var extras = alimentos.filter(function(item) {
      return Number(item.gord || 0) >= 7 || (Number(item.prot || 0) < 8 && Number(item.carb || 0) < 8);
    }).map(function(item) {
      return item.nome + ' (' + item.qtde + ')';
    });
    return {
      nome: meal.nome,
      tipo: meal.tipo || null,
      horario: meal.horario || (String(6 + meal.ordem * 3).padStart(2, '0') + ':00'),
      foco: 'META: ' + meal.meta.calories + ' kcal',
      proteinas: proteinas,
      carbos: carbos,
      extras: extras,
      alimentos: alimentos,
      subtotal: {
        kcal: meal.subtotal && meal.subtotal.calorias != null ? meal.subtotal.calorias : null,
        prot: meal.subtotal && meal.subtotal.proteinas != null ? meal.subtotal.proteinas : null,
        carb: meal.subtotal && meal.subtotal.carboidratos != null ? meal.subtotal.carboidratos : null,
        gord: meal.subtotal && meal.subtotal.gorduras != null ? meal.subtotal.gorduras : null
      },
      substituicoes: (meal.itens || []).map(function(item) {
        return {
          item: item.nome,
          opcoes: item.substituicoes
        };
      })
    };
  });
}

function applyRestrictions(meals, restricoes) {
  if (!restricoes) return meals;
  return meals;
}

function buildDietAIMessage(profile, meta, meals) {
  var objetivo = profile.objetivo || 'manutenção';
  var restricoes = profile.restricoes || profile.restricoesAlimentares || 'nenhuma';

  return 'Analise este plano alimentar e dê ajustes práticos, sem conduta clínica:\n\n'
    + 'Objetivo: ' + objetivo + '\n'
    + 'Kcal: ' + meta.calorias + '\n'
    + 'Proteína: ' + meta.proteina + 'g\n'
    + 'Carboidrato: ' + meta.carbo + 'g\n'
    + 'Gordura: ' + meta.gordura + 'g\n'
    + 'Restrições: ' + restricoes + '\n\n'
    + 'Refeições base (resumo):\n'
    + (meals || []).map(function(r) { return '- ' + r.nome + ': ' + (r.proteinas[0] || 'n/a') + ' + ' + (r.carbos[0] || 'n/a'); }).join('\n');
}

function buildDietPlan(profile) {
  var nutrition = nutritionService.generateNutritionPlan(profile || {});
  if (nutrition.failSafe) {
    return {
      failSafe: true,
      meta: { calorias: null, proteina: null, carbo: null, gordura: null },
      refeicoes: [],
      hidratacao: { litros: null },
      observacoes: [nutrition.limitedOrientation.orientacao],
      limitedOrientation: nutrition.limitedOrientation
    };
  }

  var legacyMeals = toLegacyMeals(nutrition.plan.refeicoes);
  var p = nutrition.profile;

  return {
    failSafe: false,
    formulas: nutrition.formulas,
    profile: p,
    meta: {
      calorias: nutrition.calculation.targetCalories,
      proteina: nutrition.calculation.macros.protein,
      carbo: nutrition.calculation.macros.carbs,
      gordura: nutrition.calculation.macros.fat,
      tmb: nutrition.calculation.tmb,
      get: nutrition.calculation.get,
      fatorAtividade: nutrition.calculation.activityFactor
    },
    refeicoes: legacyMeals,
    planoEstruturado: nutrition.plan,
    catalogStats: nutrition.catalogStats || null,
    recipeSuggestions: nutrition.recipeSuggestions || [],
    clinicalContext: nutrition.clinicalContext || null,
    hidratacao: { litros: round((Number(p.peso) || 75) * 0.035, 1) },
    observacoes: []
      .concat(nutrition.clinicalNotes || [])
      .concat([
        'Plano inicial automatizado para fins educativos e operacionais.',
        'Sem conduta clínica, diagnóstico ou dieta terapêutica.',
        nutrition.clinicalSafety
      ])
  };
}

module.exports = {
  buildDietPlan: buildDietPlan,
  buildDietAIMessage: buildDietAIMessage,
  calculateCalories: calculateCalories,
  calculateMacros: calculateMacros,
  applyRestrictions: applyRestrictions,
  round: round
};
