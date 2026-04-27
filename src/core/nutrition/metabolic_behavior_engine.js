'use strict';

var MACRO_BASE = {
  emagrecimento:  { protein_per_kg: 2.2, fat_per_kg: 0.8,  calorie_multiplier: 0.80 },
  manutencao:     { protein_per_kg: 1.8, fat_per_kg: 1.0,  calorie_multiplier: 1.00 },
  hipertrofia:    { protein_per_kg: 2.0, fat_per_kg: 1.0,  calorie_multiplier: 1.10 },
  recomposicao:   { protein_per_kg: 2.4, fat_per_kg: 0.9,  calorie_multiplier: 0.95 },
  forca:          { protein_per_kg: 2.0, fat_per_kg: 1.1,  calorie_multiplier: 1.05 },
  performance:    { protein_per_kg: 2.0, fat_per_kg: 1.0,  calorie_multiplier: 1.10 },
};

function normalizeMetabolicBehavior(input) {
  var src = input && typeof input === 'object' ? input : {};
  return {
    respostaPeso:    src.respostaPeso    !== undefined ? src.respostaPeso    : null,
    apetite:         src.apetite         !== undefined ? src.apetite         : null,
    historicoDieta:  src.historicoDieta  !== undefined ? src.historicoDieta  : null,
    adesao:          src.adesao          !== undefined ? src.adesao          : null,
    rotina:          src.rotina          !== undefined ? src.rotina          : null,
    sono:            src.sono            !== undefined ? src.sono            : null,
    estresse:        src.estresse        !== undefined ? src.estresse        : null,
    usoHormonios:    src.usoHormonios    !== undefined ? src.usoHormonios    : null,
    fadiga:          src.fadiga          !== undefined ? Number(src.fadiga)  : null,
    source: 'metabolic_behavior',
  };
}

function applyBehaviorAdjustments(profile, targetCalories, macros) {
  var p = profile && typeof profile === 'object' ? profile : {};
  var behavior = p.metabolicBehavior && typeof p.metabolicBehavior === 'object'
    ? normalizeMetabolicBehavior(p.metabolicBehavior)
    : normalizeMetabolicBehavior({});

  var objective = p.objective != null ? p.objective : (p.objetivo != null ? p.objetivo : 'manutencao');
  var weight_kg = p.weight_kg != null ? p.weight_kg : (p.peso != null ? p.peso : 70);

  var adj = targetCalories;
  var m = { protein: macros.protein, carbs: macros.carbs, fat: macros.fat };
  var flags = {};
  var alerts = [];

  // Sono + fadiga + estresse
  var fadiga = Number(behavior.fadiga != null ? behavior.fadiga : (p.fadiga != null ? p.fadiga : 0));
  if (behavior.sono === 'ruim' && fadiga >= 7 && behavior.estresse === 'alto') {
    adj *= 0.95;
    flags.aggressive_reduction = false;
  }

  // Adesão difícil — limitar variação a ±300 kcal do GET
  if (behavior.adesao === 'tenho_dificuldade') {
    flags.simplified_plan = true;
  }

  // Apetite alto em emagrecimento
  if (behavior.apetite === 'alto' && objective === 'emagrecimento') {
    m.protein *= 1.1;
    flags.high_fiber_protein = true;
  }

  // Dificuldade para ganhar massa
  if (behavior.respostaPeso === 'dificuldade_para_ganhar_massa') {
    adj += 100;
  }

  // Dificuldade para emagrecer — déficit máximo 300 kcal (não se aplica se já calculado externamente)
  // Marcamos a flag; quem chama decide como aplicar
  if (behavior.respostaPeso === 'dificuldade_para_emagrecer') {
    flags.max_deficit_300 = true;
  }

  // Atleta ou performance: carboidrato mínimo 4g/kg
  if (p.perfilTreino === 'atleta_competidor' || objective === 'performance') {
    var minCarbs = 4 * weight_kg;
    if (m.carbs < minCarbs) {
      m.carbs = minCarbs;
      flags.min_carbs_enforced = true;
    }
  }

  // Hormônios — não alterar macros, apenas alertar
  var hormonios = behavior.usoHormonios;
  if (hormonios != null && hormonios !== 'nao' && hormonios !== 'Não' && hormonios !== 'nao_uso' && hormonios !== '') {
    flags.hormonal_alert = true;
    alerts.push('Uso de hormônios identificado. Consulte nutricionista ou médico habilitado.');
  }

  // Recalcular carboidratos após ajustes
  var carbs_kcal = adj - (m.protein * 4) - (m.fat * 9);
  m.carbs = carbs_kcal / 4;

  if (m.carbs < 0) {
    // Reduzir proteína para liberar calorias
    var excess = Math.abs(m.carbs) * 4;
    m.protein = Math.max(0, m.protein - excess / 4);
    m.carbs = 0;
  }

  m.protein = Math.round(m.protein * 10) / 10;
  m.carbs   = Math.round(m.carbs   * 10) / 10;
  m.fat     = Math.round(m.fat     * 10) / 10;

  return {
    adjusted_calories: Math.round(adj),
    macros: m,
    flags: flags,
    alerts: alerts,
  };
}

function getMacroBaseForObjective(objective, weight_kg, get) {
  var config = MACRO_BASE[objective] || MACRO_BASE['manutencao'];
  var targetCalories = get * config.calorie_multiplier;
  var protein = weight_kg * config.protein_per_kg;
  var fat     = weight_kg * config.fat_per_kg;
  var carbs_kcal = targetCalories - (protein * 4) - (fat * 9);
  var carbs = Math.max(carbs_kcal / 4, 50);

  return {
    targetCalories: Math.round(targetCalories),
    protein: Math.round(protein * 10) / 10,
    carbs:   Math.round(carbs   * 10) / 10,
    fat:     Math.round(fat     * 10) / 10,
    objective: objective,
  };
}

module.exports = {
  MACRO_BASE: MACRO_BASE,
  normalizeMetabolicBehavior: normalizeMetabolicBehavior,
  applyBehaviorAdjustments: applyBehaviorAdjustments,
  getMacroBaseForObjective: getMacroBaseForObjective,
};
