'use strict';

var DEFAULT_VISUAL_PRESCRIPTION = Object.freeze({
  version: 'v1',
  dashboard: {
    title: 'Plano alimentar KRONIA',
    subtitle: 'Prescrição base pronta para execução, com medidas práticas e refeições brasileiras.'
  },
  summary: {
    kcal_total: 2230,
    proteina: 160,
    carbo: 228,
    gordura: 74
  },
  meals: [
    {
      id: 'fallback_breakfast',
      slot: 'cafe_da_manha',
      name: 'Café da manhã',
      time: '07:00',
      kcal_estimada: 520,
      items: [
        'Ovos mexidos - 3 unidades',
        'Pão integral - 2 fatias',
        'Mamão - 1/2 unidade',
        'Café sem açúcar - 1 xícara'
      ]
    },
    {
      id: 'fallback_lunch',
      slot: 'almoco',
      name: 'Almoço',
      time: '12:30',
      kcal_estimada: 760,
      items: [
        'Frango grelhado - 180 g',
        'Arroz - 4 colheres de sopa',
        'Feijão - 1 concha média',
        'Legumes cozidos - 1 prato de sobremesa',
        'Azeite de oliva - 1 colher de chá'
      ]
    },
    {
      id: 'fallback_snack',
      slot: 'lanche_tarde',
      name: 'Café da tarde',
      time: '16:30',
      kcal_estimada: 340,
      items: [
        'Iogurte natural - 1 pote',
        'Banana - 1 unidade',
        'Aveia - 2 colheres de sopa'
      ]
    },
    {
      id: 'fallback_dinner',
      slot: 'jantar',
      name: 'Jantar',
      time: '19:30',
      kcal_estimada: 610,
      items: [
        'Patinho moído - 160 g',
        'Batata-doce cozida - 1 unidade média',
        'Salada verde - 1 prato fundo',
        'Abacate - 3 colheres de sopa'
      ]
    }
  ],
  substitutions: {
    proteinas: ['Frango grelhado - 180 g', 'Tilápia - 200 g', 'Tofu firme - 220 g'],
    carboidratos: ['Arroz - 4 colheres de sopa', 'Batata-doce - 1 unidade média', 'Macarrão - 1 prato raso'],
    leguminosas: ['Feijão - 1 concha média', 'Lentilha - 1 concha média'],
    legumes: ['Brócolis cozido - 1 prato de sobremesa', 'Abobrinha refogada - 1 prato de sobremesa']
  },
  sequence: {
    emagrecimento: 'Proteína -> legumes -> salada -> arroz e feijão',
    manutencao: 'Proteína -> arroz e feijão -> legumes -> salada',
    ganho_massa: 'Arroz e feijão -> proteína -> legumes -> salada'
  },
  guidance: [
    'Distribua a água entre manhã, treino e noite para bater pelo menos 2,5 L.',
    'Se treinar cedo, mantenha o café da manhã completo e concentre a fruta perto do treino.',
    'Use medidas domésticas simples para manter aderência mesmo fora de casa.'
  ],
  reasons: [
    'Proteínas foram distribuídas nas principais refeições para preservar recuperação e saciedade.',
    'Carboidratos aparecem em blocos práticos para sustentar energia sem depender de alimentos ultraprocessados.',
    'A prescrição usa combinações comuns no Brasil para reduzir atrito na execução.'
  ],
  observation: 'Fallback profissional ativo: revise os dados com o KRONOS para personalizar este plano base.'
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
  var aiStrategy = safe.aiStrategy && safe.aiStrategy._aiGenerated ? safe.aiStrategy : null;
  var aiBlueprint = safe.aiBlueprint && safe.aiBlueprint.aiGenerated ? safe.aiBlueprint : null;
  var aiActive = !!(aiBlueprint || aiStrategy || plan.aiGenerated);
  var isFallback = !aiActive || (plan.fallbackEngine === true);

  if (!meals.length) {
    return clone(DEFAULT_VISUAL_PRESCRIPTION);
  }

  var resumo = plan.resumoDiario && typeof plan.resumoDiario === 'object' ? plan.resumoDiario : {};
  var visualMeals = meals.map(function(meal) {
    var subtotal = meal && meal.subtotal && typeof meal.subtotal === 'object' ? meal.subtotal : sumMacros(meal && meal.itens);
    var kcal = round(subtotal.calorias || subtotal.kcal || 0);
    return {
      name: String(meal && meal.nome || 'Refeição').trim(),
      time: String(meal && meal.horario || '').trim(),
      kcal_real: kcal,
      kcal_estimada: kcal,
      items: (meal && meal.itens || []).map(itemToVisualLine).filter(Boolean)
    };
  });

  var subtitle = aiActive
    ? 'Estratégia alimentar gerada por IA e validada por catálogo nutricional.'
    : 'Resumo do dia com refeições práticas e aderentes à rotina.';

  var strategyLabel = aiBlueprint
    ? aiBlueprint.strategyName
    : (aiStrategy && aiStrategy.strategyType ? aiStrategy.strategyType : null);

  var observation;
  if (isFallback) {
    observation = 'Plano nutricional gerado pela engine Kronia (fallback). Fontes: TACO, USDA, TBCA, OpenFoodFacts e PremiumCatalog.';
  } else if (strategyLabel) {
    observation = 'IA estratégica: ativa | Catálogo: validado | Cálculo: recalculado por item | Fallback: não. Estratégia: ' + strategyLabel + '. Fontes: TACO, USDA, TBCA, OpenFoodFacts e PremiumCatalog.';
  } else {
    observation = 'IA estratégica: ativa | Catálogo: validado | Cálculo: recalculado por item | Fallback: não. Fontes: TACO, USDA, TBCA, OpenFoodFacts e PremiumCatalog.';
  }

  return {
    version: 'v1',
    dashboard: {
      title: 'Plano alimentar KRONIA',
      subtitle: subtitle
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
    observation: observation,
    aiGenerated: aiActive,
    fallbackEngine: isFallback,
    strategyName: strategyLabel || null
  };
}

module.exports = {
  DEFAULT_VISUAL_PRESCRIPTION: DEFAULT_VISUAL_PRESCRIPTION,
  getDefaultVisualPrescription: function getDefaultVisualPrescription() {
    return clone(DEFAULT_VISUAL_PRESCRIPTION);
  },
  buildVisualPrescription: buildVisualPrescription
};
