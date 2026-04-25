'use strict';

var dietTemplates = require('../../core/diet/dietTemplates');

var NUTRITION_MEMORY_KEY = 'kronia_nutrition_memory_v1';

var DEFAULT_NUTRITION_MEMORY = {
  personalization_score: 0,
  confidence_level: 'baixo',
  missing_fields: [],
  plan_status: 'provisório',
  preferred_meal_count: null,
  preferred_diet_style: null,
  has_food_scale: null,
  budget_level: null,
  workout_time: null,
  hunger_period: null,
  disliked_foods: [],
  liked_foods: [],
  avoided_foods: [],
  skipped_meals_count: 0,
  swapped_foods_count: 0,
  hunger_reports_count: 0,
  adherence_days: 0,
  frequent_swaps: [],
  frequent_rejections: [],
  current_template_id: null,
  previous_template_ids: [],
  reason_selected: null,
  updated_at: null
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map(String).map(function(item) { return item.trim(); }).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,;\n]+/).map(function(item) { return item.trim(); }).filter(Boolean);
  return [];
}

function normalizeMemory(memory) {
  var input = memory && typeof memory === 'object' ? memory : {};
  var next = Object.assign({}, clone(DEFAULT_NUTRITION_MEMORY), input);
  [
    'missing_fields',
    'disliked_foods',
    'liked_foods',
    'avoided_foods',
    'frequent_swaps',
    'frequent_rejections',
    'previous_template_ids'
  ].forEach(function(key) {
    next[key] = normalizeArray(next[key]);
  });
  [
    'skipped_meals_count',
    'swapped_foods_count',
    'hunger_reports_count',
    'adherence_days'
  ].forEach(function(key) {
    next[key] = Math.max(0, Number(next[key] || 0));
  });
  next.personalization_score = Math.max(0, Math.min(100, Number(next.personalization_score || 0)));
  next.confidence_level = next.personalization_score >= 70 ? 'alto' : (next.personalization_score >= 40 ? 'médio' : 'baixo');
  next.plan_status = next.personalization_score >= 70 ? 'personalizado' : 'provisório';
  return next;
}

function getLocalStorage() {
  if (typeof localStorage !== 'undefined') return localStorage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  return null;
}

function readNutritionMemory() {
  var storage = getLocalStorage();
  if (!storage) return normalizeMemory();
  try {
    return normalizeMemory(JSON.parse(storage.getItem(NUTRITION_MEMORY_KEY) || 'null'));
  } catch (_) {
    return normalizeMemory();
  }
}

function saveNutritionMemory(memory) {
  var next = normalizeMemory(Object.assign({}, memory || {}, { updated_at: (memory && memory.updated_at) || new Date().toISOString() }));
  var storage = getLocalStorage();
  if (storage) {
    try { storage.setItem(NUTRITION_MEMORY_KEY, JSON.stringify(next)); } catch (_) {}
  }
  return next;
}

function updateNutritionMemory(patch) {
  var current = readNutritionMemory();
  return saveNutritionMemory(Object.assign({}, current, patch || {}));
}

function resetNutritionMemory() {
  var storage = getLocalStorage();
  if (storage) {
    try { storage.removeItem(NUTRITION_MEMORY_KEY); } catch (_) {}
  }
  return normalizeMemory();
}

function hasBasicProfile(profile) {
  var p = profile || {};
  return Boolean(Number(p.peso || p.weight_kg) > 0 && Number(p.altura || p.height_cm) > 0 && Number(p.idade || p.age) > 0 && (p.sexo || p.sex) && (p.objetivo || p.objective));
}

function calculateNutritionPersonalizationScore(profile, memory) {
  var p = profile || {};
  var m = normalizeMemory(memory);
  var missing = [];
  var score = 0;
  if (hasBasicProfile(p)) score += 30; else missing.push('dados_basicos');
  if (Number(m.preferred_meal_count || p.refeicoesPorDia || p.refeicoes_por_dia) > 0) score += 10; else missing.push('refeicoes_por_dia');
  if (normalizeArray(m.liked_foods).length || normalizeArray(p.preferencias_alimentares || p.preferencias).length || m.preferred_diet_style) score += 10; else missing.push('preferencias_alimentares');
  if (normalizeArray(m.disliked_foods).length || normalizeArray(m.avoided_foods).length || normalizeArray(p.alimentosEvitar || p.restricoesAlimentares).length) score += 10; else missing.push('rejeicoes');
  if (p.condicoes_clinicas || p.patologias || p.restricoes || p.saude || p.healthContext) score += 10; else missing.push('restricoes_patologias');
  if (m.workout_time || p.horario_treino || p.workout_time) score += 10; else missing.push('horario_treino');
  if (m.preferred_diet_style) score += 10; else missing.push('estilo_dieta');
  if (m.adherence_days || m.skipped_meals_count || m.swapped_foods_count || m.hunger_reports_count || m.frequent_swaps.length || m.frequent_rejections.length) score += 10; else missing.push('feedback_recente');
  score = Math.max(0, Math.min(100, score));
  return {
    score: score,
    confidence_level: score >= 70 ? 'alto' : (score >= 40 ? 'médio' : 'baixo'),
    missing_fields: missing,
    plan_status: score >= 70 ? 'personalizado' : 'provisório'
  };
}

function buildTemplateReason(template, memory) {
  var id = template && template.id || '';
  var reasons = [];
  var style = normalizeText(memory && memory.preferred_diet_style);
  if (style && id.indexOf(style === 'economica' ? 'economica_brasileira' : style) !== -1) reasons.push('estilo ' + style);
  if (normalizeText(memory && memory.workout_time).indexOf('noite') !== -1 && id.indexOf('treino_noturno') !== -1) reasons.push('treino à noite');
  if (normalizeText(memory && memory.workout_time).indexOf('manha') !== -1 && id.indexOf('treino_matinal') !== -1) reasons.push('treino pela manhã');
  if (normalizeText(memory && memory.hunger_period).indexOf('noite') !== -1 && id.indexOf('alta_saciedade') !== -1) reasons.push('fome à noite');
  if (Number(memory && memory.swapped_foods_count || 0) >= 2 && id.indexOf('flexivel') !== -1) reasons.push('muitas trocas recentes');
  if (Number(memory && memory.skipped_meals_count || 0) >= 2 && id.indexOf('baixa_adesao') !== -1) reasons.push('refeições puladas');
  return reasons.length ? reasons.join(', ') : 'melhor aderência ao perfil informado';
}

function scoreAdaptiveTemplate(template, profile, calculation, memory) {
  var selectedBase = dietTemplates.selectDietTemplate(profile, calculation);
  var score = selectedBase && template.id === selectedBase.id ? 70 : 0;
  var id = String(template.id || '');
  var style = normalizeText(memory && memory.preferred_diet_style);
  var workout = normalizeText(memory && memory.workout_time);
  var hunger = normalizeText(memory && memory.hunger_period);
  var objective = normalizeText(profile && (profile.objetivo || profile.objective));
  if (style === 'economica' || style === 'econômica') {
    if (id.indexOf('economica_brasileira') !== -1) score += 95;
  }
  if (style === 'marmita' && id.indexOf('marmita') !== -1) score += 95;
  if (style === 'flexivel' && id.indexOf('flexivel') !== -1) score += 95;
  if (style === 'simples' && (id.indexOf('reeducacao_alimentar') !== -1 || id.indexOf('baixa_adesao') !== -1)) score += 35;
  if (/corrid|plantao|plant/.test(normalizeText(profile && (profile.rotina || profile.observacoes))) && (id.indexOf('rotina_corrida') !== -1 || id.indexOf('baixa_adesao') !== -1)) score += 35;
  if (workout.indexOf('manha') !== -1 && id.indexOf('treino_matinal') !== -1) score += 95;
  if (workout.indexOf('noite') !== -1 && id.indexOf('treino_noturno') !== -1) score += 95;
  if (hunger.indexOf('noite') !== -1 && /emagrec/.test(objective) && id.indexOf('alta_saciedade') !== -1) score += 95;
  if (memory && memory.has_food_scale === false && (id.indexOf('reeducacao_alimentar') !== -1 || id.indexOf('economica_brasileira') !== -1 || id.indexOf('baixa_adesao') !== -1)) score += 25;
  if (Number(memory && memory.swapped_foods_count || 0) >= 2 && id.indexOf('flexivel') !== -1) score += 50;
  if (Number(memory && memory.skipped_meals_count || 0) >= 2 && id.indexOf('baixa_adesao') !== -1) score += 50;
  return score;
}

function selectAdaptiveDietTemplate(profile, calculation, memory) {
  var m = normalizeMemory(memory);
  var selected = dietTemplates.DIET_TEMPLATES
    .map(function(template) {
      return { template: template, score: scoreAdaptiveTemplate(template, profile || {}, calculation || {}, m) };
    })
    .sort(function(a, b) { return b.score - a.score; })[0];
  var template = selected ? selected.template : dietTemplates.selectDietTemplate(profile, calculation);
  var previous = m.current_template_id && m.current_template_id !== template.id
    ? [m.current_template_id].concat(m.previous_template_ids || []).filter(function(id, index, all) { return id && all.indexOf(id) === index; }).slice(0, 8)
    : (m.previous_template_ids || []);
  var nextMemory = normalizeMemory(Object.assign({}, m, {
    current_template_id: template.id,
    previous_template_ids: previous,
    reason_selected: buildTemplateReason(template, m)
  }));
  return { template: template, memory: nextMemory, reason_selected: nextMemory.reason_selected };
}

function registerDailyNutritionFeedback(type, memory, details) {
  var m = normalizeMemory(memory);
  var patch = {};
  if (type === 'adherent') patch.adherence_days = m.adherence_days + 1;
  if (type === 'swapped') {
    patch.swapped_foods_count = m.swapped_foods_count + 1;
    patch.frequent_swaps = normalizeArray(m.frequent_swaps).concat(normalizeArray(details && details.food));
  }
  if (type === 'skipped') patch.skipped_meals_count = m.skipped_meals_count + 1;
  if (type === 'hungry') patch.hunger_reports_count = m.hunger_reports_count + 1;
  if (type === 'difficult') {
    patch.frequent_rejections = normalizeArray(m.frequent_rejections).concat(normalizeArray(details && details.food || 'dieta dificil'));
  }
  return normalizeMemory(Object.assign({}, m, patch, { updated_at: new Date().toISOString() }));
}

function suggestDietAdaptations(plan, memory, profile) {
  var m = normalizeMemory(memory);
  var objective = normalizeText(profile && (profile.objetivo || profile.objective));
  var suggestions = [];
  if ((m.hunger_reports_count >= 2 || normalizeText(m.hunger_period).indexOf('noite') !== -1) && /emagrec/.test(objective)) {
    suggestions.push({ type: 'night_satiety', message: 'Reforçar o jantar com proteína e fibra sem aumentar calorias totais.', template_hint: 'alta_saciedade' });
  }
  if (m.skipped_meals_count >= 2) suggestions.push({ type: 'low_adherence', message: 'Reduzir número de refeições ou usar template de baixa adesão.', template_hint: 'baixa_adesao' });
  if (m.swapped_foods_count >= 2 || m.frequent_swaps.length >= 2) suggestions.push({ type: 'flexible_template', message: 'Migrar para template flexível com blocos equivalentes.', template_hint: 'flexivel' });
  if (m.frequent_rejections.length >= 2) suggestions.push({ type: 'avoid_rejected_foods', message: 'Remover alimentos rejeitados das próximas gerações.', avoid: m.frequent_rejections.slice(0, 8) });
  if (m.adherence_days < 2 && (m.skipped_meals_count + m.swapped_foods_count + m.hunger_reports_count) >= 3) {
    suggestions.push({ type: 'simplify', message: 'Simplificar para dieta simples, econômica ou marmita.', template_hint: 'economica_brasileira' });
  }
  return suggestions;
}

function runWeeklyNutritionCheckin(checkin, plan, profile, memory) {
  var c = checkin || {};
  var p = profile || {};
  var objective = normalizeText(p.objetivo || p.objective);
  var adherence = Number(c.adherence_days || c.seguiu_dias || 0);
  var hunger = Number(c.hunger_avg || c.fome_media || 0);
  var energy = Number(c.training_energy || c.energia_treino || 0);
  var weightDelta = Number(c.weight_delta_kg != null ? c.weight_delta_kg : c.delta_peso_kg);
  var targetCalories = Number(plan && (plan.caloriasMeta || plan.targets && plan.targets.kcal || plan.calculation && plan.calculation.targetCalories) || 0);
  var action = { calorie_multiplier: 1, carb_timing: null, simplify: false, reason: '' };
  if (/emagrec/.test(objective) && adherence >= 5 && Math.abs(weightDelta || 0) < 0.2 && hunger < 7) {
    action.calorie_multiplier = 0.95;
    action.reason = 'Adesão boa e peso estável em emagrecimento: reduzir 5% das calorias.';
  } else if (hunger >= 7) {
    action.calorie_multiplier = 1;
    action.reason = 'Fome alta: manter calorias, aumentar volume/fibra e redistribuir refeições.';
  } else if (energy > 0 && energy <= 4) {
    action.carb_timing = 'pre_pos_treino';
    action.reason = 'Energia baixa no treino: mover carboidratos para pré/pós-treino.';
  } else if (adherence < 4) {
    action.simplify = true;
    action.reason = 'Adesão baixa: simplificar dieta sem apertar calorias.';
  } else if (/hipertrof|massa/.test(objective) && (weightDelta || 0) <= 0.1) {
    action.calorie_multiplier = 1.05;
    action.reason = 'Hipertrofia sem subida de peso: aumentar 5% das calorias.';
  } else {
    action.reason = 'Check-in estável: manter plano atual e observar nova semana.';
  }
  action.targetCalories = targetCalories ? Math.round(targetCalories * action.calorie_multiplier) : null;
  return action;
}

module.exports = {
  NUTRITION_MEMORY_KEY: NUTRITION_MEMORY_KEY,
  DEFAULT_NUTRITION_MEMORY: DEFAULT_NUTRITION_MEMORY,
  normalizeMemory: normalizeMemory,
  readNutritionMemory: readNutritionMemory,
  saveNutritionMemory: saveNutritionMemory,
  updateNutritionMemory: updateNutritionMemory,
  resetNutritionMemory: resetNutritionMemory,
  calculateNutritionPersonalizationScore: calculateNutritionPersonalizationScore,
  selectAdaptiveDietTemplate: selectAdaptiveDietTemplate,
  registerDailyNutritionFeedback: registerDailyNutritionFeedback,
  suggestDietAdaptations: suggestDietAdaptations,
  runWeeklyNutritionCheckin: runWeeklyNutritionCheckin
};
