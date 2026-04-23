'use strict';

var DEFAULT_VISUAL_PRESCRIPTION = Object.freeze({
  version: 'v1',
  dashboard: {
    title: 'Plano alimentar KRONIA',
    subtitle: 'Resumo do dia com refeições práticas e aderentes à rotina.'
  },
  summary: {
    kcal_total: 0,
    proteina: 0,
    carbo: 0,
    gordura: 0
  },
  meals: [],
  substitutions: {
    proteinas: [],
    carboidratos: [],
    leguminosas: [],
    legumes: []
  },
  sequence: {
    emagrecimento: 'Proteína -> legumes -> salada -> arroz e feijão',
    manutencao: 'Proteína -> arroz e feijão -> legumes -> salada',
    ganho_massa: 'Arroz e feijão -> proteína -> legumes -> salada'
  },
  guidance: [],
  reasons: [],
  observation: ''
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function round(value, decimals) {
  var d = typeof decimals === 'number' ? decimals : 0;
  var factor = Math.pow(10, d);
  return Math.round(Number(value || 0) * factor) / factor;
}

function sumMacros(items) {
  return (items || []).reduce(function(acc, item) {
    acc.kcal += Number(item && (item.calorias || item.kcal) || 0);
    acc.proteina += Number(item && (item.proteinas || item.proteina || item.prot) || 0);
    acc.carbo += Number(item && (item.carboidratos || item.carbo || item.carb) || 0);
    acc.gordura += Number(item && (item.gorduras || item.gordura || item.gord) || 0);
    return acc;
  }, { kcal: 0, proteina: 0, carbo: 0, gordura: 0 });
}

function itemToVisualLine(item) {
  var safe = item && typeof item === 'object' ? item : {};
  var name = String(safe.nome || safe.name || 'Alimento').trim();
  var portion = String(safe.porcao || safe.quantity || safe.qtde || '').trim();
  return portion ? (name + ' - ' + portion) : name;
}

function collectGeneratedSubstitutions(meals) {
  var groups = {
    proteinas: [],
    carboidratos: [],
    leguminosas: [],
    legumes: []
  };

  (meals || []).forEach(function(meal) {
    (meal && meal.itens || []).forEach(function(item) {
      var itemName = String(item && item.nome || '').toLowerCase();
      var groupKey = String(item && item.groupKey || '').toLowerCase();
      var targetGroup = 'proteinas';
      if (/feij|lentilha|grao|grão|chickpea/.test(itemName)) targetGroup = 'leguminosas';
      else if (/legume|brocol|brócol|salada|abob|cenoura|abobrinha|chuchu|repolho|couve/.test(itemName)) targetGroup = 'legumes';
      else if (groupKey === 'carboidratos' || /arroz|pao|pão|banana|aveia|batata|macarra|mandioca/.test(itemName)) targetGroup = 'carboidratos';
      (item && item.substituicoes || []).forEach(function(option) {
        var label = itemToVisualLine(option);
        if (label && groups[targetGroup].indexOf(label) === -1) groups[targetGroup].push(label);
      });
    });
  });

  Object.keys(groups).forEach(function(key) {
    if (!groups[key].length) groups[key] = [];
  });

  return groups;
}

function buildReasons(objective, clinicalNotes) {
  var normalizedObjective = String(objective || '').toLowerCase();
  var reasons = [];
  if (/hipertrof|massa|ganho/.test(normalizedObjective)) {
    reasons.push('Carboidratos mais fortes no almoço e jantar para sustentar treino e recuperação.');
    reasons.push('Proteínas distribuídas ao longo do dia para melhorar síntese proteica.');
  } else if (/emagrec|defin|cut/.test(normalizedObjective)) {
    reasons.push('Proteínas e vegetais aparecem cedo para aumentar saciedade.');
    reasons.push('Carboidratos ficaram concentrados nas refeições mais estratégicas para aderência.');
  } else {
    reasons.push('Distribuição equilibrada de macros para manter energia, rotina e constância.');
  }
  if (Array.isArray(clinicalNotes) && clinicalNotes[0]) reasons.push(String(clinicalNotes[0]).trim());
  reasons.push('Medidas práticas e alimentos acessíveis reduzem atrito no dia a dia.');
  return reasons.filter(Boolean).slice(0, 3);
}

function buildVisualPrescription(input) {
  var safe = input && typeof input === 'object' ? input : {};
  var plan = safe.plan && typeof safe.plan === 'object' ? safe.plan : {};
  var calculation = safe.calculation && typeof safe.calculation === 'object' ? safe.calculation : {};
  var meals = Array.isArray(plan.refeicoes) ? plan.refeicoes : [];

  if (!meals.length) {
    return clone(DEFAULT_VISUAL_PRESCRIPTION);
  }

  var resumo = plan.resumoDiario && typeof plan.resumoDiario === 'object' ? plan.resumoDiario : {};
  var visualMeals = meals.map(function(meal) {
    var subtotal = meal && meal.subtotal && typeof meal.subtotal === 'object' ? meal.subtotal : sumMacros(meal && meal.itens);
    return {
      name: String(meal && meal.nome || 'Refeição').trim(),
      time: String(meal && meal.horario || '').trim(),
      kcal_estimada: round(subtotal.calorias || subtotal.kcal || 0),
      items: (meal && meal.itens || []).map(itemToVisualLine).filter(Boolean)
    };
  });

  return {
    version: 'v1',
    dashboard: {
      title: 'Plano alimentar KRONIA',
      subtitle: 'Resumo do dia com refeições práticas e aderentes à rotina.'
    },
    summary: {
      kcal_total: round(resumo.calorias || calculation.targetCalories || 0),
      proteina: round(resumo.proteinas || calculation.macros && calculation.macros.protein || 0, 1),
      carbo: round(resumo.carboidratos || calculation.macros && calculation.macros.carbs || 0, 1),
      gordura: round(resumo.gorduras || calculation.macros && calculation.macros.fat || 0, 1)
    },
    meals: visualMeals,
    substitutions: collectGeneratedSubstitutions(meals),
    sequence: clone(DEFAULT_VISUAL_PRESCRIPTION.sequence),
    guidance: clone(DEFAULT_VISUAL_PRESCRIPTION.guidance),
    reasons: buildReasons(plan.objetivo || calculation.objective, safe.clinicalNotes),
    observation: DEFAULT_VISUAL_PRESCRIPTION.observation
  };
}

module.exports = {
  DEFAULT_VISUAL_PRESCRIPTION: DEFAULT_VISUAL_PRESCRIPTION,
  getDefaultVisualPrescription: function getDefaultVisualPrescription() {
    return clone(DEFAULT_VISUAL_PRESCRIPTION);
  },
  buildVisualPrescription: buildVisualPrescription
};
