'use strict';

var WAIST_RISK = { male: 102, female: 88 };

function normalizeBcmData(input) {
  var src = input && typeof input === 'object' ? input : {};
  return {
    body_fat_percent: src.body_fat_percent !== undefined ? src.body_fat_percent : null,
    lean_mass_kg: src.lean_mass_kg !== undefined ? src.lean_mass_kg : null,
    fat_mass_kg: src.fat_mass_kg !== undefined ? src.fat_mass_kg : null,
    water_percent: src.water_percent !== undefined ? src.water_percent : null,
    muscle_mass_kg: src.muscle_mass_kg !== undefined ? src.muscle_mass_kg : null,
    basal_metabolic_rate: src.basal_metabolic_rate !== undefined ? src.basal_metabolic_rate : null,
    exam_date: src.exam_date !== undefined ? src.exam_date : null,
    source: 'bcm',
  };
}

function normalizePcmManual(input) {
  var src = input && typeof input === 'object' ? input : {};
  if (src.waist_cm == null || src.abdomen_cm == null) {
    throw new Error('PCM manual requer cintura e abdômen');
  }
  return {
    waist_cm: src.waist_cm,
    abdomen_cm: src.abdomen_cm,
    hip_cm: src.hip_cm !== undefined ? src.hip_cm : null,
    neck_cm: src.neck_cm !== undefined ? src.neck_cm : null,
    source: 'pcm_manual',
  };
}

function estimateBodyFatFromNavy(pcm, sexo, altura_cm) {
  var waist = pcm.waist_cm;
  var neck = pcm.neck_cm != null ? pcm.neck_cm : altura_cm * 0.095;
  var estimated = pcm.neck_cm == null;

  if (sexo === 'female' || sexo === 'feminino') {
    var hip = pcm.hip_cm;
    if (hip == null) return { body_fat_percent: null, estimated: false, method: 'navy' };
    var neck_f = pcm.neck_cm != null ? pcm.neck_cm : altura_cm * 0.095;
    var sumCircum = waist + hip - neck_f;
    if (sumCircum <= 0 || altura_cm <= 0) return { body_fat_percent: null, estimated: estimated, method: 'navy' };
    var bf = 495 / (1.29579 - 0.35004 * Math.log10(sumCircum) + 0.22100 * Math.log10(altura_cm)) - 450;
    return { body_fat_percent: Math.round(bf * 10) / 10, estimated: estimated, method: 'navy' };
  }

  // male
  var diff = waist - neck;
  if (diff <= 0 || altura_cm <= 0) return { body_fat_percent: null, estimated: estimated, method: 'navy' };
  var bf_m = 495 / (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(altura_cm)) - 450;
  return { body_fat_percent: Math.round(bf_m * 10) / 10, estimated: estimated, method: 'navy' };
}

function estimateVisceralRisk(pcm, sexo) {
  var key = (sexo === 'female' || sexo === 'feminino') ? 'female' : 'male';
  var threshold = WAIST_RISK[key];
  var risk = pcm.waist_cm > threshold ? 'high' : 'normal';
  return { risk: risk, waist_cm: pcm.waist_cm, threshold: threshold };
}

function buildBodyComposition(profile) {
  var weight_kg = profile.weight_kg != null ? profile.weight_kg : profile.peso;
  var height_cm = profile.height_cm != null ? profile.height_cm : profile.altura;
  var sex = profile.sex != null ? profile.sex : profile.sexo;
  var age = profile.age != null ? profile.age : profile.idade;

  // Priority 1: BCM
  if (profile.bcmData && profile.bcmData.body_fat_percent != null) {
    var bcm = normalizeBcmData(profile.bcmData);
    var lean = weight_kg != null ? weight_kg * (1 - bcm.body_fat_percent / 100) : null;
    var fat = weight_kg != null ? weight_kg * (bcm.body_fat_percent / 100) : null;
    return Object.assign({}, bcm, {
      lean_mass_kg: bcm.lean_mass_kg != null ? bcm.lean_mass_kg : lean,
      fat_mass_kg: bcm.fat_mass_kg != null ? bcm.fat_mass_kg : fat,
      katch_mccardle_eligible: lean != null,
      weight_kg: weight_kg,
      height_cm: height_cm,
      sex: sex,
      age: age,
    });
  }

  // Priority 2: PCM manual
  if (profile.pcmManual && profile.pcmManual.waist_cm != null && profile.pcmManual.abdomen_cm != null) {
    var pcm = normalizePcmManual(profile.pcmManual);
    var navyResult = estimateBodyFatFromNavy(pcm, sex, height_cm);
    var visceralRisk = estimateVisceralRisk(pcm, sex);
    var bf_pcm = navyResult.body_fat_percent;
    var lean_pcm = (bf_pcm != null && weight_kg != null) ? weight_kg * (1 - bf_pcm / 100) : null;
    var fat_pcm = (bf_pcm != null && weight_kg != null) ? weight_kg * (bf_pcm / 100) : null;
    return {
      source: 'pcm_manual',
      body_fat_percent: bf_pcm,
      lean_mass_kg: lean_pcm,
      fat_mass_kg: fat_pcm,
      water_percent: null,
      muscle_mass_kg: null,
      basal_metabolic_rate: null,
      exam_date: null,
      navy_estimated: navyResult.estimated,
      navy_method: navyResult.method,
      visceral_risk: visceralRisk,
      waist_cm: pcm.waist_cm,
      abdomen_cm: pcm.abdomen_cm,
      hip_cm: pcm.hip_cm,
      neck_cm: pcm.neck_cm,
      katch_mccardle_eligible: lean_pcm != null,
      weight_kg: weight_kg,
      height_cm: height_cm,
      sex: sex,
      age: age,
    };
  }

  // Fallback
  return {
    source: 'weight_height_only',
    body_fat_percent: null,
    lean_mass_kg: null,
    fat_mass_kg: null,
    water_percent: null,
    muscle_mass_kg: null,
    basal_metabolic_rate: null,
    exam_date: null,
    katch_mccardle_eligible: false,
    weight_kg: weight_kg,
    height_cm: height_cm,
    sex: sex,
    age: age,
  };
}

function calculateTMB(profile, bodyComposition) {
  var weight_kg = profile.weight_kg != null ? profile.weight_kg : profile.peso;
  var height_cm = profile.height_cm != null ? profile.height_cm : profile.altura;
  var sex = profile.sex != null ? profile.sex : profile.sexo;
  var age = profile.age != null ? profile.age : profile.idade;

  if (bodyComposition && bodyComposition.katch_mccardle_eligible && bodyComposition.lean_mass_kg != null) {
    var tmb_km = 370 + (21.6 * bodyComposition.lean_mass_kg);
    return { tmb: Math.round(tmb_km), tmb_method: 'katch_mccardle' };
  }

  var isFemale = sex === 'female' || sex === 'feminino' || sex === 'f';
  var base = (10 * weight_kg) + (6.25 * height_cm) - (5 * age);
  var tmb_ms = base + (isFemale ? -161 : 5);
  return { tmb: Math.round(tmb_ms), tmb_method: 'mifflin_st_jeor' };
}

module.exports = {
  normalizeBcmData: normalizeBcmData,
  normalizePcmManual: normalizePcmManual,
  estimateBodyFatFromNavy: estimateBodyFatFromNavy,
  estimateVisceralRisk: estimateVisceralRisk,
  buildBodyComposition: buildBodyComposition,
  calculateTMB: calculateTMB,
};
