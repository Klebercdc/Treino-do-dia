'use strict';

var OBJECTIVE_ORDER = {
  emagrecimento: ['fibra_vegetais', 'proteina', 'carboidrato', 'gordura_complementar'],
  hipertrofia: ['carboidrato', 'proteina', 'gordura_complementar', 'fibra_vegetais'],
  manutencao: ['proteina', 'fibra_vegetais', 'carboidrato', 'gordura_complementar']
};

var CLINICAL_ALERT =
  'Modelo educacional e esportivo. Condições clínicas exigem acompanhamento de nutricionista ou médico.';

var ENERGY_BANDS = [
  { id: '1400_1700', label: '1400-1700 kcal', min: 1200, max: 1750, kcal: 1550 },
  { id: '1700_2000', label: '1700-2000 kcal', min: 1700, max: 2050, kcal: 1850 },
  { id: '2000_2300', label: '2000-2300 kcal', min: 2000, max: 2350, kcal: 2150 },
  { id: '2300_2600', label: '2300-2600 kcal', min: 2300, max: 2650, kcal: 2450 },
  { id: '2600_3000', label: '2600-3000 kcal', min: 2600, max: 3050, kcal: 2800 },
  { id: '3000_3600', label: '3000-3600 kcal', min: 3000, max: 3800, kcal: 3300 }
];

var BLUEPRINTS = [
  { id: 'emagrecimento', nome: 'Emagrecimento', objetivo: 'emagrecimento', meals: 5, difficulty: 'intermediario', macros: { protein: 0.34, carbs: 0.36, fat: 0.30 }, strategy: 'Déficit conservador com proteína alta, fibras e baixa densidade calórica.', tags: ['deficit', 'saciedade'] },
  { id: 'hipertrofia', nome: 'Hipertrofia', objetivo: 'hipertrofia', meals: 5, difficulty: 'intermediario', macros: { protein: 0.26, carbs: 0.50, fat: 0.24 }, strategy: 'Superávit controlado com carboidrato distribuído perto do treino.', tags: ['superavit', 'performance'] },
  { id: 'manutencao', nome: 'Manutenção', objetivo: 'manutencao', meals: 4, difficulty: 'facil', macros: { protein: 0.30, carbs: 0.42, fat: 0.28 }, strategy: 'Energia estável, proteína suficiente e refeições previsíveis.', tags: ['estabilidade'] },
  { id: 'economica_brasileira', nome: 'Econômica brasileira', objetivo: 'manutencao', meals: 4, difficulty: 'facil', macros: { protein: 0.29, carbs: 0.46, fat: 0.25 }, strategy: 'Base arroz, feijão, ovos, frango e legumes de baixo custo.', tags: ['baixo_custo', 'brasileira'] },
  { id: 'marmita', nome: 'Marmita', objetivo: 'manutencao', meals: 5, difficulty: 'facil', macros: { protein: 0.30, carbs: 0.44, fat: 0.26 }, strategy: 'Refeições principais replicáveis e fáceis de preparar em lote.', tags: ['meal_prep'] },
  { id: 'rotina_corrida', nome: 'Rotina corrida', objetivo: 'manutencao', meals: 4, difficulty: 'facil', macros: { protein: 0.31, carbs: 0.43, fat: 0.26 }, strategy: 'Poucas refeições robustas com lanches rápidos e substituições práticas.', tags: ['praticidade'] },
  { id: 'treino_matinal', nome: 'Treino matinal', objetivo: 'hipertrofia', meals: 5, difficulty: 'intermediario', macros: { protein: 0.27, carbs: 0.51, fat: 0.22 }, strategy: 'Carboidrato no café e almoço para sustentar treino cedo.', tags: ['treino_manha'] },
  { id: 'treino_noturno', nome: 'Treino noturno', objetivo: 'hipertrofia', meals: 5, difficulty: 'intermediario', macros: { protein: 0.27, carbs: 0.50, fat: 0.23 }, strategy: 'Pré-treino à tarde e jantar pós-treino com digestão controlada.', tags: ['treino_noite'] },
  { id: 'alta_saciedade', nome: 'Alta saciedade', objetivo: 'emagrecimento', meals: 5, difficulty: 'facil', macros: { protein: 0.36, carbs: 0.34, fat: 0.30 }, strategy: 'Volume alimentar, leguminosas, vegetais e proteína por refeição.', tags: ['saciedade'] },
  { id: 'low_carb_leve', nome: 'Low carb leve', objetivo: 'emagrecimento', meals: 4, difficulty: 'intermediario', macros: { protein: 0.36, carbs: 0.28, fat: 0.36 }, strategy: 'Redução moderada de carboidratos sem excluir grupos alimentares.', tags: ['low_carb_leve'] },
  { id: 'high_carb', nome: 'High carb', objetivo: 'hipertrofia', meals: 5, difficulty: 'intermediario', macros: { protein: 0.24, carbs: 0.56, fat: 0.20 }, strategy: 'Alta disponibilidade de carboidrato para volume de treino alto.', tags: ['high_carb'] },
  { id: 'flexivel', nome: 'Flexível', objetivo: 'manutencao', meals: 4, difficulty: 'facil', macros: { protein: 0.30, carbs: 0.45, fat: 0.25 }, strategy: 'Blocos equivalentes para facilitar trocas mantendo macros.', tags: ['flexivel'] },
  { id: 'sem_lactose', nome: 'Sem lactose', objetivo: 'manutencao', meals: 5, difficulty: 'facil', macros: { protein: 0.31, carbs: 0.43, fat: 0.26 }, strategy: 'Proteínas sem lácteos e substitutos vegetais/zero lactose.', tags: ['sem_lactose'], restrictions: ['lactose'] },
  { id: 'sem_gluten', nome: 'Sem glúten', objetivo: 'manutencao', meals: 5, difficulty: 'facil', macros: { protein: 0.31, carbs: 0.43, fat: 0.26 }, strategy: 'Carboidratos de arroz, tubérculos, frutas e leguminosas.', tags: ['sem_gluten'], restrictions: ['gluten'] },
  { id: 'vegetariana', nome: 'Vegetariana', objetivo: 'manutencao', meals: 5, difficulty: 'intermediario', macros: { protein: 0.29, carbs: 0.47, fat: 0.24 }, strategy: 'Proteínas de ovos, laticínios e leguminosas com atenção a ferro e B12.', tags: ['vegetariana'], restrictions: ['vegetariano'] },
  { id: 'plant_based', nome: 'Plant based', objetivo: 'manutencao', meals: 5, difficulty: 'intermediario', macros: { protein: 0.28, carbs: 0.49, fat: 0.23 }, strategy: 'Proteínas vegetais, leguminosas e combinações completas.', tags: ['vegano', 'plant_based'], restrictions: ['vegano'] },
  { id: 'reeducacao_alimentar', nome: 'Reeducação alimentar', objetivo: 'emagrecimento', meals: 4, difficulty: 'facil', macros: { protein: 0.32, carbs: 0.42, fat: 0.26 }, strategy: 'Rotina simples, alimentos comuns e progressão de adesão.', tags: ['aderencia'] },
  { id: 'baixa_adesao', nome: 'Baixa adesão', objetivo: 'emagrecimento', meals: 3, difficulty: 'facil', macros: { protein: 0.34, carbs: 0.38, fat: 0.28 }, strategy: 'Poucas decisões, lanches opcionais e alimentos fáceis de repetir.', tags: ['baixa_adesao'] },
  { id: 'ansiedade_alimentar', nome: 'Ansiedade alimentar não clínica', objetivo: 'manutencao', meals: 5, difficulty: 'facil', macros: { protein: 0.31, carbs: 0.43, fat: 0.26 }, strategy: 'Regularidade, saciedade e previsibilidade sem abordagem clínica.', tags: ['rotina', 'saciedade'] },
  { id: 'especial_alerta_profissional', nome: 'Especial com alerta profissional', objetivo: 'manutencao', meals: 5, difficulty: 'avancado', macros: { protein: 0.28, carbs: 0.44, fat: 0.28 }, strategy: 'Plano conservador para perfis que exigem supervisão profissional.', tags: ['alerta_profissional'], professionalAlert: true }
];

function round(value, decimals) {
  var d = typeof decimals === 'number' ? decimals : 1;
  var factor = Math.pow(10, d);
  return Math.round(Number(value || 0) * factor) / factor;
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function includesAny(text, needles) {
  var haystack = normalizeText(Array.isArray(text) ? text.join(' ') : text);
  return (needles || []).some(function(needle) {
    return haystack.indexOf(normalizeText(needle)) !== -1;
  });
}

function flattenTextValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(flattenTextValue).join(' ');
  if (typeof value === 'object') {
    return Object.keys(value).map(function(key) {
      return key + ' ' + flattenTextValue(value[key]);
    }).join(' ');
  }
  return String(value);
}

function normalizeObjective(value) {
  var text = normalizeText(value);
  if (/hipertrof|massa|ganh/.test(text)) return 'hipertrofia';
  if (/emagrec|perder|cut|deficit|gordura/.test(text)) return 'emagrecimento';
  return 'manutencao';
}

function clinicalFlags(profile) {
  var text = normalizeText([
    profile && profile.saude,
    profile && profile.healthContext,
    profile && profile.observacoes,
    profile && profile.patologias,
    profile && profile.restricoes,
    profile && profile.restricoesAlimentares
  ].map(flattenTextValue).filter(Boolean).join(' '));
  var flags = [];
  [
    ['renal', /renal|rim|creatinina|dialise|di[aá]lise/],
    ['diabetes', /diabetes|glicemia|hba1c|hemoglobina glicada/],
    ['gestante', /gestante|gravidez|lactante|amament/],
    ['hepatica', /hep[aá]tic|figado|f[ií]gado|esteatose|cirrose/],
    ['adolescente', /adolescente|menor de idade/],
    ['idoso', /idoso|terceira idade/]
  ].forEach(function(entry) {
    if (entry[1].test(text)) flags.push(entry[0]);
  });
  if (Number(profile && profile.idade) > 64) flags.push('idoso');
  if (Number(profile && profile.idade) && Number(profile.idade) < 18) flags.push('adolescente');
  return flags.filter(function(flag, index, all) { return all.indexOf(flag) === index; });
}

function buildMealStructure(count, objective, tags) {
  var base = {
    3: [
      ['cafe_da_manha', 'Café da manhã', '07:00', 0.30, 0.26, 0.30],
      ['almoco', 'Almoço', '12:30', 0.38, 0.38, 0.36],
      ['jantar', 'Jantar', '20:00', 0.32, 0.36, 0.34]
    ],
    4: [
      ['cafe_da_manha', 'Café da manhã', '07:00', 0.24, 0.22, 0.24],
      ['almoco', 'Almoço', '12:30', 0.31, 0.31, 0.30],
      ['lanche_tarde', 'Café da tarde', '16:00', 0.16, 0.17, 0.12],
      ['jantar', 'Jantar', '19:30', 0.29, 0.30, 0.34]
    ],
    5: [
      ['cafe_da_manha', 'Café da manhã', '07:00', 0.21, 0.18, 0.22],
      ['lanche_manha', 'Lanche da manhã', '10:00', 0.12, 0.11, 0.11],
      ['almoco', 'Almoço', '12:30', 0.27, 0.27, 0.25],
      ['lanche_tarde', 'Café da tarde', '16:00', 0.14, 0.16, 0.10],
      ['jantar', 'Jantar', '19:30', 0.26, 0.28, 0.32]
    ],
    6: [
      ['cafe_da_manha', 'Café da manhã', '07:00', 0.19, 0.15, 0.18],
      ['lanche_manha', 'Lanche da manhã', '09:45', 0.10, 0.10, 0.10],
      ['almoco', 'Almoço', '12:30', 0.24, 0.24, 0.22],
      ['lanche_tarde', 'Café da tarde', '16:00', 0.12, 0.14, 0.09],
      ['jantar', 'Jantar', '19:30', 0.24, 0.25, 0.26],
      ['ceia', 'Ceia', '22:00', 0.11, 0.12, 0.15]
    ]
  };
  var rows = base[count] || base[5];
  return rows.map(function(row) {
    var carbShare = row[4];
    if (objective === 'hipertrofia' && includesAny(tags, ['treino_noite']) && row[0] === 'lanche_tarde') carbShare += 0.04;
    if (objective === 'hipertrofia' && includesAny(tags, ['treino_manha']) && row[0] === 'cafe_da_manha') carbShare += 0.04;
    if (includesAny(tags, ['low_carb_leve'])) carbShare = Math.max(0.08, carbShare - 0.04);
    return {
      tipo: row[0],
      nome: row[1],
      horario: row[2],
      proteinShare: round(row[3], 3),
      carbShare: round(carbShare, 3),
      fatShare: round(row[5], 3)
    };
  });
}

function buildTemplate(blueprint, band, index) {
  var mealCount = Math.min(6, Math.max(3, blueprint.meals));
  var objective = blueprint.objetivo;
  var tags = (blueprint.tags || []).slice();
  return {
    id: 'kronia_' + blueprint.id + '_' + band.id,
    nome: blueprint.nome + ' ' + band.label,
    objetivo: objective,
    faixa_calorica: { min: band.min, max: band.max, kcal_referencia: band.kcal, label: band.label },
    perfil_indicado: tags.concat(blueprint.restrictions || []),
    nivel_dificuldade: blueprint.difficulty,
    quantidade_refeicoes: mealCount,
    estrategia_nutricional: blueprint.strategy,
    distribuicao_macros: blueprint.macros,
    estrutura_refeicoes: buildMealStructure(mealCount, objective, tags),
    alimentos_base: {
      proteinas: blueprint.restrictions && includesAny(blueprint.restrictions, ['vegano']) ? ['tofu', 'tempeh', 'lentilha', 'grão-de-bico'] : ['frango', 'ovos', 'tilápia', 'patinho', 'tofu'],
      carboidratos: includesAny(tags, ['low_carb_leve']) ? ['feijão', 'frutas', 'tubérculos em porção moderada'] : ['arroz', 'feijão', 'batata-doce', 'aveia', 'frutas'],
      gorduras: ['azeite', 'castanhas', 'abacate', 'sementes'],
      vegetais: ['salada verde', 'brócolis', 'legumes cozidos', 'cenoura']
    },
    substituicoes_por_categoria: {
      proteina: ['frango', 'tilápia', 'patinho', 'ovos', 'tofu'],
      carboidrato: ['arroz', 'batata-doce', 'mandioca', 'aveia', 'feijão'],
      gordura: ['azeite', 'castanhas', 'abacate', 'pasta de amendoim'],
      vegetal_fibra: ['salada verde', 'brócolis', 'abobrinha', 'cenoura']
    },
    regras_adaptacao: [
      'Trocar alimentos apenas por categoria equivalente.',
      'Ajustar porção pelo macro dominante do item substituído.',
      'Não compensar proteína removida com carboidrato ou gordura.',
      'Manter refeições principais com proteína, carboidrato, vegetal/fibra e gordura quando aplicável.'
    ],
    ordem_consumo: OBJECTIVE_ORDER[objective] || OBJECTIVE_ORDER.manutencao,
    observacoes: ['Template vivo: porções são recalculadas pelo perfil, metas e preferências do usuário.'],
    alertas_profissionais: blueprint.professionalAlert ? [CLINICAL_ALERT] : []
  };
}

var DIET_TEMPLATES = BLUEPRINTS.reduce(function(acc, blueprint) {
  ENERGY_BANDS.forEach(function(band, index) {
    acc.push(buildTemplate(blueprint, band, index));
  });
  return acc;
}, []);

function scoreTemplate(template, profile, calculation) {
  var objective = normalizeObjective(profile && profile.objetivo);
  var targetCalories = Number(
    calculation && (calculation.targetCalories || calculation.calorias || calculation.kcal_meta)
  ) || Number(profile && profile.caloriasMeta) || template.faixa_calorica.kcal_referencia;
  var text = normalizeText([
    profile && profile.rotina,
    profile && profile.padraoAlimentar,
    profile && profile.restricoesAlimentares,
    profile && profile.restricoes,
    profile && profile.preferencias,
    profile && profile.alimentosEvitar,
    profile && profile.observacoes
  ].map(flattenTextValue).filter(Boolean).join(' '));
  var score = 0;
  if (template.objetivo === objective) score += 25;
  if (targetCalories >= template.faixa_calorica.min && targetCalories <= template.faixa_calorica.max) score += 18;
  score -= Math.abs(targetCalories - template.faixa_calorica.kcal_referencia) / 120;
  template.perfil_indicado.forEach(function(tag) {
    if (text.indexOf(normalizeText(tag)) !== -1) score += 10;
  });
  if (/corrid|sem tempo|plant[aã]o/.test(text) && template.id.indexOf('rotina_corrida') !== -1) score += 18;
  if (/marmita|meal prep|prepar/.test(text) && template.id.indexOf('marmita') !== -1) score += 18;
  if (/manha|manh[aã]/.test(text) && template.id.indexOf('treino_matinal') !== -1) score += 14;
  if (/noite|noturn/.test(text) && template.id.indexOf('treino_noturno') !== -1) score += 14;
  if (clinicalFlags(profile || {}).length && template.id.indexOf('especial_alerta_profissional') !== -1) score += 40;
  return score;
}

function selectDietTemplate(profile, calculation) {
  var safeProfile = profile && typeof profile === 'object' ? profile : {};
  var selected = DIET_TEMPLATES
    .map(function(template) {
      return { template: template, score: scoreTemplate(template, safeProfile, calculation || {}) };
    })
    .sort(function(a, b) { return b.score - a.score; })[0];
  return selected ? selected.template : DIET_TEMPLATES[0];
}

function parseGrams(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  var match = String(value || '').replace(',', '.').match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (match) return Number(match[1]);
  return Number(fallback || 100);
}

function normalizeDietItem(item) {
  var safe = item && typeof item === 'object' ? item : {};
  var grams = parseGrams(safe.gramas || safe.grams || safe.porcao || safe.quantity, 100);
  var per100 = safe.per100 && typeof safe.per100 === 'object' ? safe.per100 : null;
  if (!per100) {
    var ratio = grams / 100 || 1;
    per100 = {
      kcal: round(Number(safe.calorias || safe.kcal || 0) / ratio, 1),
      protein: round(Number(safe.proteinas || safe.protein || 0) / ratio, 1),
      carbs: round(Number(safe.carboidratos || safe.carbs || 0) / ratio, 1),
      fat: round(Number(safe.gorduras || safe.fat || 0) / ratio, 1),
      fiber: round(Number(safe.fibras || safe.fiber || 0) / ratio, 1)
    };
  }
  var r = grams / 100;
  return Object.assign({}, safe, {
    gramas: round(grams, 0),
    grams: round(grams, 0),
    porcao: round(grams, 0) + ' g',
    quantity: round(grams, 0) + ' g',
    per100: per100,
    calorias: round(Number(per100.kcal || per100.calories || 0) * r, 0),
    proteinas: round(Number(per100.protein || per100.proteinas || 0) * r, 1),
    carboidratos: round(Number(per100.carbs || per100.carboidratos || 0) * r, 1),
    gorduras: round(Number(per100.fat || per100.gorduras || 0) * r, 1),
    fibras: round(Number(per100.fiber || per100.fibras || 0) * r, 1)
  });
}

function sumItems(items) {
  return (items || []).reduce(function(acc, item) {
    var normalized = normalizeDietItem(item);
    acc.calorias += Number(normalized.calorias || 0);
    acc.proteinas += Number(normalized.proteinas || 0);
    acc.carboidratos += Number(normalized.carboidratos || 0);
    acc.gorduras += Number(normalized.gorduras || 0);
    acc.fibras += Number(normalized.fibras || 0);
    return acc;
  }, { calorias: 0, proteinas: 0, carboidratos: 0, gorduras: 0, fibras: 0 });
}

function dominantCategory(item) {
  var group = normalizeText(item && (item.groupKey || item.categoria || item.substitution_group));
  if (/prote/.test(group)) return 'proteina';
  if (/carbo|fruta|leguminosa/.test(group)) return 'carboidrato';
  if (/gord|oleo|azeite/.test(group)) return 'gordura';
  if (/veget|fibra|salada/.test(group)) return 'vegetal_fibra';
  var normalized = normalizeDietItem(item);
  if (normalized.proteinas >= normalized.carboidratos && normalized.proteinas >= normalized.gorduras) return 'proteina';
  if (normalized.carboidratos >= normalized.gorduras) return 'carboidrato';
  return 'gordura';
}

function substituteFood(plan, mealIndex, itemIndex, replacement) {
  var next = JSON.parse(JSON.stringify(plan || {}));
  var meal = next.refeicoes && next.refeicoes[mealIndex];
  if (!meal || !meal.itens || !meal.itens[itemIndex]) return { plan: next, warnings: ['Item não encontrado.'] };
  var current = normalizeDietItem(meal.itens[itemIndex]);
  var candidate = normalizeDietItem(replacement);
  if (dominantCategory(current) !== dominantCategory(candidate)) {
    return { plan: next, warnings: ['Substituição recusada: categoria nutricional diferente.'] };
  }
  meal.itens[itemIndex] = candidate;
  return { plan: rebalanceDiet(next), warnings: [] };
}

function rebalanceDiet(plan) {
  var next = JSON.parse(JSON.stringify(plan || {}));
  next.refeicoes = (next.refeicoes || []).map(function(meal) {
    var target = meal.meta || {};
    var items = (meal.itens || []).map(normalizeDietItem);
    ['proteinas', 'carboidratos', 'gorduras'].forEach(function(macro) {
      var subtotal = sumItems(items);
      var targetValue = Number(target[macro] || target[macro.replace('proteinas', 'protein').replace('carboidratos', 'carbs').replace('gorduras', 'fat')] || 0);
      var currentValue = Number(subtotal[macro] || 0);
      if (!targetValue || !currentValue || Math.abs(targetValue - currentValue) < (macro === 'carboidratos' ? 8 : 4)) return;
      var category = macro === 'proteinas' ? 'proteina' : (macro === 'carboidratos' ? 'carboidrato' : 'gordura');
      var idx = items.findIndex(function(item) { return dominantCategory(item) === category && Number(item[macro] || 0) > 0; });
      if (idx < 0) return;
      var factor = Math.max(0.55, Math.min(1.8, targetValue / currentValue));
      items[idx].gramas = round(Number(items[idx].gramas || 100) * factor, 0);
      items[idx].grams = items[idx].gramas;
      items[idx].porcao = items[idx].gramas + ' g';
      items[idx].quantity = items[idx].porcao;
      items[idx] = normalizeDietItem(items[idx]);
    });
    var finalSubtotal = sumItems(items);
    return Object.assign({}, meal, {
      itens: items,
      subtotal: {
        calorias: round(finalSubtotal.calorias, 0),
        proteinas: round(finalSubtotal.proteinas, 1),
        carboidratos: round(finalSubtotal.carboidratos, 1),
        gorduras: round(finalSubtotal.gorduras, 1),
        fibras: round(finalSubtotal.fibras, 1)
      }
    });
  });
  var daily = next.refeicoes.reduce(function(acc, meal) {
    acc.calorias += Number(meal.subtotal && meal.subtotal.calorias || 0);
    acc.proteinas += Number(meal.subtotal && meal.subtotal.proteinas || 0);
    acc.carboidratos += Number(meal.subtotal && meal.subtotal.carboidratos || 0);
    acc.gorduras += Number(meal.subtotal && meal.subtotal.gorduras || 0);
    return acc;
  }, { calorias: 0, proteinas: 0, carboidratos: 0, gorduras: 0 });
  next.resumoDiario = {
    calorias: round(daily.calorias, 0),
    proteinas: round(daily.proteinas, 1),
    carboidratos: round(daily.carboidratos, 1),
    gorduras: round(daily.gorduras, 1)
  };
  next.caloriasMeta = next.resumoDiario.calorias;
  next.macrosMeta = { protein: next.resumoDiario.proteinas, carbs: next.resumoDiario.carboidratos, fat: next.resumoDiario.gorduras };
  return next;
}

function generateDietFromTemplate(template, profile, calculation) {
  var selected = template || selectDietTemplate(profile, calculation);
  var macros = calculation && calculation.macros ? calculation.macros : null;
  var kcal = Number(calculation && calculation.targetCalories) || selected.faixa_calorica.kcal_referencia;
  if (!macros) {
    macros = {
      protein: round((kcal * selected.distribuicao_macros.protein) / 4, 1),
      carbs: round((kcal * selected.distribuicao_macros.carbs) / 4, 1),
      fat: round((kcal * selected.distribuicao_macros.fat) / 9, 1)
    };
  }
  return {
    objetivo: selected.objetivo,
    templateId: selected.id,
    templateName: selected.nome,
    refeicoesPorDia: selected.quantidade_refeicoes,
    caloriasMeta: kcal,
    macrosMeta: macros,
    ordem_consumo: selected.ordem_consumo,
    observacoes: selected.observacoes,
    alertas_profissionais: selected.alertas_profissionais.concat(clinicalFlags(profile || {}).length ? [CLINICAL_ALERT] : []),
    refeicoes: selected.estrutura_refeicoes.map(function(meal, index) {
      return {
        ordem: index + 1,
        tipo: meal.tipo,
        nome: meal.nome,
        horario: meal.horario,
        meta: {
          calories: round(macros.protein * meal.proteinShare * 4 + macros.carbs * meal.carbShare * 4 + macros.fat * meal.fatShare * 9, 0),
          protein: round(macros.protein * meal.proteinShare, 1),
          carbs: round(macros.carbs * meal.carbShare, 1),
          fat: round(macros.fat * meal.fatShare, 1)
        },
        itens: []
      };
    })
  };
}

module.exports = {
  DIET_TEMPLATES: DIET_TEMPLATES,
  selectDietTemplate: selectDietTemplate,
  generateDietFromTemplate: generateDietFromTemplate,
  substituteFood: substituteFood,
  rebalanceDiet: rebalanceDiet,
  normalizeDietItem: normalizeDietItem,
  clinicalFlags: clinicalFlags,
  OBJECTIVE_ORDER: OBJECTIVE_ORDER,
  CLINICAL_ALERT: CLINICAL_ALERT
};
