'use strict';

function isNaNOrUndefined(value) {
  return value === undefined || value === null || (typeof value === 'number' && isNaN(value));
}

function scoreFoodConfidence(item) {
  if (!item) return 0;
  var score = 100;
  var reasons = [];

  // Critério: source documentado (peso 20)
  if (!item.source) {
    score -= 20;
    reasons.push('source ausente');
  }

  // Critério: semanticStatus não flagged (peso 20)
  if (item.semanticStatus === 'flagged') {
    score -= 20;
    reasons.push('semanticStatus flagged');
  }

  // Critério: sem source estimativa (peso 10)
  if (item.source && /estimativa_/i.test(item.source)) {
    score -= 10;
    reasons.push('source é estimativa');
  }

  // Critério: macros coerentes, sem NaN (peso split: 25 macro coerencia + 10 NaN)
  var proteinas = item.proteinas != null ? item.proteinas : item.protein;
  var carboidratos = item.carboidratos != null ? item.carboidratos : item.carbs;
  var gorduras = item.gorduras != null ? item.gorduras : item.fat;
  var calorias = item.calorias != null ? item.calorias : item.calories;

  if (isNaNOrUndefined(proteinas) || isNaNOrUndefined(carboidratos) ||
      isNaNOrUndefined(gorduras) || isNaNOrUndefined(calorias)) {
    score -= 35; // NaN (10) + macro incoerente (25)
    reasons.push('NaN ou undefined nos macros');
  } else {
    // Verificação básica de coerência calórica: calorias ≈ prot*4 + carbs*4 + fat*9 ±25%
    var grams = Number(item.gramas || item.grams || 100);
    if (grams > 0) {
      var expectedKcal = (Number(proteinas) * 4 + Number(carboidratos) * 4 + Number(gorduras) * 9);
      var actualKcal = Number(calorias);
      if (expectedKcal > 0 && Math.abs(actualKcal - expectedKcal) / expectedKcal > 0.35) {
        score -= 15;
        reasons.push('calorias divergem dos macros (>35%)');
      }
    }
  }

  // Critério: porção com gramagem explícita (peso 15)
  var portionLabel = String(item.porcao || item.portionLabel || '');
  var hasExplicitGrams = /\d+\s*g\b/.test(portionLabel) || /\d+\s*ml\b/.test(portionLabel);
  if (!hasExplicitGrams) {
    score -= 15;
    reasons.push('porção sem gramagem explícita: "' + portionLabel + '"');
  }

  return Math.max(0, score);
}

function scoreMealConfidence(meal) {
  if (!meal) return 0;
  var items = Array.isArray(meal.itens) ? meal.itens : [];
  if (!items.length) return 0;

  var total = items.reduce(function(acc, item) {
    return acc + scoreFoodConfidence(item);
  }, 0);

  return Math.round(total / items.length);
}

function scorePlanConfidence(plan) {
  if (!plan) {
    return { score: 0, level: 'low', reasons: ['plano nulo'], riskyItems: [] };
  }

  var meals = Array.isArray(plan.refeicoes) ? plan.refeicoes : [];
  var allItems = [];
  meals.forEach(function(meal) {
    if (meal && Array.isArray(meal.itens)) {
      meal.itens.forEach(function(item) { if (item) allItems.push(item); });
    }
  });

  if (!allItems.length) {
    return { score: 0, level: 'low', reasons: ['plano sem alimentos'], riskyItems: [] };
  }

  var reasons = [];
  var riskyItems = [];
  var penaltyMap = {
    sourceAusente: 0,
    macrosNaN: 0,
    flagged: 0,
    estimativa: 0,
    semGramagem: 0,
    caloriaDivergente: 0
  };

  // Per-item scoring
  allItems.forEach(function(item) {
    var itemScore = scoreFoodConfidence(item);
    if (itemScore < 80) {
      riskyItems.push({
        nome: item.nome || item.name || '?',
        score: itemScore,
        semanticStatus: item.semanticStatus || 'unknown'
      });
    }

    if (!item.source) penaltyMap.sourceAusente++;
    if (item.semanticStatus === 'flagged') penaltyMap.flagged++;
    if (item.source && /estimativa_/i.test(item.source)) penaltyMap.estimativa++;

    var proteinas = item.proteinas != null ? item.proteinas : item.protein;
    var carboidratos = item.carboidratos != null ? item.carboidratos : item.carbs;
    var gorduras = item.gorduras != null ? item.gorduras : item.fat;
    var calorias = item.calorias != null ? item.calorias : item.calories;

    if (isNaNOrUndefined(proteinas) || isNaNOrUndefined(carboidratos) ||
        isNaNOrUndefined(gorduras) || isNaNOrUndefined(calorias)) {
      penaltyMap.macrosNaN++;
    } else if (item.semanticStatus === 'flagged') {
      // flagged = macros semanticamente incoerentes; conta como outlier
      penaltyMap.macrosNaN++;
    }

    var portionLabel = String(item.porcao || item.portionLabel || '');
    if (!/\d+\s*g\b/.test(portionLabel) && !/\d+\s*ml\b/.test(portionLabel)) {
      penaltyMap.semGramagem++;
    }
  });

  var n = allItems.length;
  var score = 100;

  // Peso 20: todos os alimentos têm source
  var sourceFraction = (n - penaltyMap.sourceAusente) / n;
  score -= Math.round((1 - sourceFraction) * 20);
  if (penaltyMap.sourceAusente > 0) reasons.push(penaltyMap.sourceAusente + ' alimento(s) sem source (-20 parcial)');

  // Peso 25: macros coerentes (sem NaN/outlier)
  var macroFraction = (n - penaltyMap.macrosNaN) / n;
  score -= Math.round((1 - macroFraction) * 25);
  if (penaltyMap.macrosNaN > 0) reasons.push(penaltyMap.macrosNaN + ' alimento(s) com NaN nos macros (-25 parcial)');

  // Peso 15: porções com gramagem explícita
  var gramFraction = (n - penaltyMap.semGramagem) / n;
  score -= Math.round((1 - gramFraction) * 15);
  if (penaltyMap.semGramagem > 0) reasons.push(penaltyMap.semGramagem + ' alimento(s) sem gramagem explícita (-15 parcial)');

  // Peso 20: nenhum item flagged
  if (penaltyMap.flagged > 0) {
    score -= 20;
    reasons.push(penaltyMap.flagged + ' alimento(s) com semanticStatus flagged (-20)');
  }

  // Peso 10: nenhum source estimativa
  var estimFraction = (n - penaltyMap.estimativa) / n;
  score -= Math.round((1 - estimFraction) * 10);
  if (penaltyMap.estimativa > 0) reasons.push(penaltyMap.estimativa + ' alimento(s) com source estimativa (-10 parcial)');

  // Peso 10: totais do plano sem NaN
  var resumo = plan.resumoDiario || plan.macrosMeta || {};
  var totalFields = [resumo.calorias, resumo.proteinas, resumo.carboidratos, resumo.gorduras];
  var hasNaNTotals = totalFields.some(isNaNOrUndefined);
  if (hasNaNTotals) {
    score -= 10;
    reasons.push('totais do plano contêm NaN ou undefined (-10)');
  }

  score = Math.max(0, Math.min(100, score));

  var level;
  if (score >= 85) level = 'high';
  else if (score >= 70) level = 'medium';
  else level = 'low';

  return {
    score: score,
    level: level,
    reasons: reasons,
    riskyItems: riskyItems.slice(0, 5)
  };
}

module.exports = {
  scoreFoodConfidence: scoreFoodConfidence,
  scoreMealConfidence: scoreMealConfidence,
  scorePlanConfidence: scorePlanConfidence
};
