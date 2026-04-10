/**
 * labHealthProfile.ts
 *
 * Deterministic, conservative health & performance profile interpreter.
 * Transforms normalized biomarker entries into structured product signals
 * for training, diet, recovery and safety personalization.
 *
 * Rules:
 * - NO medical diagnosis. Only product-oriented signals.
 * - All thresholds are conservative.
 * - Missing values = no flag; never invent data.
 * - Severity: ok < attention < caution < critical
 */

import type { BiomarkerEntry, HealthPerformanceProfile, SignalGroup, SignalLevel } from './labTypes'

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

function byKey(biomarkers: BiomarkerEntry[]): Map<string, BiomarkerEntry> {
  const map = new Map<string, BiomarkerEntry>()
  for (const b of biomarkers) {
    if (b.marker_key) map.set(b.marker_key, b)
  }
  return map
}

function numOf(map: Map<string, BiomarkerEntry>, key: string): number | null {
  return map.get(key)?.value_numeric ?? null
}

function flagOf(map: Map<string, BiomarkerEntry>, key: string): string | null {
  return map.get(key)?.flag ?? null
}

function hasValue(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function maxLevel(a: SignalLevel, b: SignalLevel): SignalLevel {
  const rank: Record<SignalLevel, number> = { ok: 0, attention: 1, caution: 2, critical: 3 }
  return rank[a] >= rank[b] ? a : b
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

// ---------------------------------------------------------------------------
// Empty group factory
// ---------------------------------------------------------------------------

function emptyGroup(level: SignalLevel = 'ok'): SignalGroup {
  return { level, flags: [], notes: [] }
}

function addFlag(group: SignalGroup, flag: string, level: SignalLevel, note?: string) {
  group.flags.push(flag)
  group.level = maxLevel(group.level, level)
  if (note) group.notes.push(note)
}

// ---------------------------------------------------------------------------
// GROUP BUILDERS
// ---------------------------------------------------------------------------

function buildMetabolicHealth(bm: Map<string, BiomarkerEntry>): SignalGroup {
  const g = emptyGroup()
  const glucose = numOf(bm, 'glucose')
  const hba1c = numOf(bm, 'hba1c')
  const insulin = numOf(bm, 'insulin')

  if (hasValue(glucose)) {
    if (glucose >= 126) addFlag(g, 'glucose_very_high', 'critical', 'Glicose ≥126 mg/dL: evitar exercício intenso sem avaliação médica.')
    else if (glucose >= 100) addFlag(g, 'glucose_elevated', 'caution', 'Glicose 100–125 mg/dL: atenção a carboidratos simples; preferir treino em zona aeróbica moderada.')
    else if (glucose < 70) addFlag(g, 'glucose_low', 'caution', 'Glicose <70 mg/dL: risco de hipoglicemia; garantir refeição pré-treino adequada.')
  }

  if (hasValue(hba1c)) {
    if (hba1c >= 6.5) addFlag(g, 'hba1c_diabetes_range', 'critical', 'HbA1c ≥6.5%: compatível com diabetes; dieta e treino devem considerar controle glicêmico rigoroso.')
    else if (hba1c >= 5.7) addFlag(g, 'hba1c_prediabetes', 'caution', 'HbA1c 5.7–6.4%: faixa pré-diabética; priorizar exercícios de resistência e controle de carboidratos.')
  }

  if (hasValue(insulin)) {
    if (insulin > 25) addFlag(g, 'high_insulin', 'caution', 'Insulina elevada: possível resistência insulínica; priorizar cardio e dieta com menor carga glicêmica.')
    else if (insulin > 15) addFlag(g, 'insulin_borderline', 'attention', 'Insulina levemente elevada: monitorar carga glicêmica e distribuição de carboidratos.')
  }

  return g
}

function buildLipidHealth(bm: Map<string, BiomarkerEntry>): SignalGroup {
  const g = emptyGroup()
  const ldl = numOf(bm, 'ldl_cholesterol')
  const hdl = numOf(bm, 'hdl_cholesterol')
  const trig = numOf(bm, 'triglycerides')
  const total = numOf(bm, 'total_cholesterol')
  const nonHdl = numOf(bm, 'non_hdl_cholesterol') ?? (hasValue(total) && hasValue(hdl) ? total! - hdl! : null)

  if (hasValue(ldl)) {
    if (ldl >= 190) addFlag(g, 'ldl_very_high', 'critical', 'LDL ≥190 mg/dL: risco cardiovascular alto; evitar treinos de altíssima intensidade sem avaliação.')
    else if (ldl >= 160) addFlag(g, 'ldl_high', 'caution', 'LDL 160–189 mg/dL: preferir gorduras insaturadas; monitorar intensidade cardiovascular.')
    else if (ldl >= 130) addFlag(g, 'ldl_borderline', 'attention', 'LDL 130–159 mg/dL: atenção à dieta; reduzir gordura saturada e trans.')
  }

  if (hasValue(hdl)) {
    if (hdl < 35) addFlag(g, 'hdl_very_low', 'caution', 'HDL <35 mg/dL: risco cardiovascular aumentado; cardio regular e dieta cardioprotegida são prioritários.')
    else if (hdl < 40) addFlag(g, 'hdl_low', 'attention', 'HDL <40 mg/dL: aumentar exercício aeróbico e reduzir gordura trans.')
  }

  if (hasValue(trig)) {
    if (trig >= 500) addFlag(g, 'triglycerides_very_high', 'critical', 'Triglicerídeos ≥500 mg/dL: risco de pancreatite; restringir gorduras e açúcares; não exercitar intensamente.')
    else if (trig >= 200) addFlag(g, 'triglycerides_high', 'caution', 'Triglicerídeos 200–499 mg/dL: reduzir açúcar simples, álcool e carboidratos refinados.')
    else if (trig >= 150) addFlag(g, 'triglycerides_borderline', 'attention', 'Triglicerídeos 150–199 mg/dL: atenção à distribuição de carboidratos e açúcares.')
  }

  if (hasValue(nonHdl) && nonHdl >= 160) {
    addFlag(g, 'non_hdl_elevated', 'attention', 'Colesterol não-HDL elevado: considerar dieta cardioprotegida.')
  }

  return g
}

function buildLiverHealth(bm: Map<string, BiomarkerEntry>): SignalGroup {
  const g = emptyGroup()
  const ast = numOf(bm, 'ast')
  const alt = numOf(bm, 'alt')
  const ggt = numOf(bm, 'ggt')
  const alp = numOf(bm, 'alkaline_phosphatase')

  // Standard ULN references (conservative)
  if (hasValue(ast)) {
    if (ast > 120) addFlag(g, 'ast_very_high', 'critical', 'TGO/AST muito elevado: evitar suplementos hepatotóxicos; priorizar recuperação; avaliar com médico.')
    else if (ast > 60) addFlag(g, 'ast_high', 'caution', 'TGO/AST elevado: reduzir carga de treino intensa; evitar uso de substâncias hepatotóxicas.')
    else if (ast > 40) addFlag(g, 'ast_borderline', 'attention', 'TGO/AST levemente acima do normal: monitorar hidratação e recuperação.')
  }

  if (hasValue(alt)) {
    if (alt > 120) addFlag(g, 'alt_very_high', 'critical', 'TGP/ALT muito elevado: sinal hepático significativo; avaliar suplementos e alimentação.')
    else if (alt > 60) addFlag(g, 'alt_high', 'caution', 'TGP/ALT elevado: atenção hepática; evitar suplementos com potencial hepatotóxico.')
    else if (alt > 40) addFlag(g, 'alt_borderline', 'attention', 'TGP/ALT levemente acima do normal: monitorar nas próximas semanas.')
  }

  if (hasValue(ggt)) {
    if (ggt > 100) addFlag(g, 'ggt_high', 'caution', 'GGT elevado: pode indicar dano hepático ou uso de substâncias; evitar álcool e suplementos agressivos.')
    else if (ggt > 50) addFlag(g, 'ggt_borderline', 'attention', 'GGT levemente elevado: monitorar álcool e carga suplementar.')
  }

  if (hasValue(alp) && alp > 150) {
    addFlag(g, 'alp_high', 'attention', 'Fosfatase Alcalina elevada: considerar avaliação médica.')
  }

  return g
}

function buildKidneyHydration(bm: Map<string, BiomarkerEntry>): SignalGroup {
  const g = emptyGroup()
  const creatinine = numOf(bm, 'creatinine')
  const urea = numOf(bm, 'urea')
  const egfr = numOf(bm, 'egfr')
  const potassium = numOf(bm, 'potassium')
  const sodium = numOf(bm, 'sodium')
  const uricAcid = numOf(bm, 'uric_acid')

  if (hasValue(creatinine)) {
    if (creatinine >= 2.0) addFlag(g, 'creatinine_very_high', 'critical', 'Creatinina ≥2.0 mg/dL: função renal comprometida; evitar exercício de alta intensidade e proteína em excesso sem avaliação.')
    else if (creatinine >= 1.5) addFlag(g, 'creatinine_high', 'caution', 'Creatinina 1.5–1.9 mg/dL: monitorar hidratação e ingestão proteica; evitar AINEs.')
    else if (creatinine >= 1.3) addFlag(g, 'creatinine_borderline', 'attention', 'Creatinina levemente elevada: manter hidratação adequada.')
  }

  if (hasValue(egfr)) {
    if (egfr < 30) addFlag(g, 'egfr_severely_reduced', 'critical', 'TFG <30: função renal gravemente reduzida; consulta médica obrigatória antes de dieta hiperproteica.')
    else if (egfr < 60) addFlag(g, 'egfr_reduced', 'caution', 'TFG 30–59: função renal reduzida; limitar proteína a ~1g/kg; manter hidratação.')
    else if (egfr < 90) addFlag(g, 'egfr_mildly_reduced', 'attention', 'TFG levemente reduzida: garantir hidratação adequada e monitorar ingestão proteica.')
  }

  if (hasValue(potassium)) {
    if (potassium >= 5.5) addFlag(g, 'potassium_high_critical', 'critical', 'Potássio ≥5.5 mEq/L: hipercalemia; risco cardíaco; avaliação médica urgente.')
    else if (potassium >= 5.0) addFlag(g, 'potassium_elevated', 'caution', 'Potássio 5.0–5.4 mEq/L: monitorar; limitar alimentos ricos em potássio se prescrito.')
    else if (potassium < 3.5) addFlag(g, 'potassium_low', 'caution', 'Potássio <3.5 mEq/L: hipocalemia; risco de cãibras e arritmia; priorizar fontes alimentares de potássio.')
  }

  if (hasValue(sodium)) {
    if (sodium < 135) addFlag(g, 'sodium_low', 'caution', 'Sódio <135 mEq/L: hiponatremia; atenção à hidratação excessiva em treinos longos.')
    else if (sodium > 145) addFlag(g, 'sodium_high', 'attention', 'Sódio >145 mEq/L: verificar hidratação e consumo de sódio.')
  }

  if (hasValue(uricAcid)) {
    if (uricAcid > 7.5) addFlag(g, 'uric_acid_high', 'caution', 'Ácido úrico elevado: risco de gota; limitar frutose, álcool e carnes vermelhas em excesso.')
    else if (uricAcid > 6.5) addFlag(g, 'uric_acid_borderline', 'attention', 'Ácido úrico borderline: monitorar hidratação e consumo de purinas.')
  }

  if (hasValue(urea) && urea > 60) {
    addFlag(g, 'urea_high', 'attention', 'Ureia elevada: verificar hidratação e catabolismo proteico.')
  }

  return g
}

function buildHematologicStatus(bm: Map<string, BiomarkerEntry>): SignalGroup {
  const g = emptyGroup()
  const hgb = numOf(bm, 'hemoglobin')
  const hct = numOf(bm, 'hematocrit')
  const ferritin = numOf(bm, 'ferritin')
  const b12 = numOf(bm, 'vitamin_b12')
  const folate = numOf(bm, 'folate')
  const wbc = numOf(bm, 'wbc')

  if (hasValue(hgb)) {
    if (hgb < 8) addFlag(g, 'hemoglobin_very_low', 'critical', 'Hemoglobina muito baixa: anemia severa; exercício intenso contraindicado sem avaliação.')
    else if (hgb < 11) addFlag(g, 'hemoglobin_low', 'caution', 'Hemoglobina baixa: anemia; reduzir intensidade de treino; priorizar ferro, B12 e folato.')
    else if (hgb < 12.5) addFlag(g, 'hemoglobin_borderline', 'attention', 'Hemoglobina baixo-normal: monitorar fadiga; verificar ferro e vitaminas.')
  }

  if (hasValue(hct)) {
    if (hct < 33) addFlag(g, 'hematocrit_low', 'caution', 'Hematócrito baixo: capacidade de transporte de O₂ reduzida; limitar treinos de alta intensidade.')
  }

  if (hasValue(ferritin)) {
    if (ferritin < 12) addFlag(g, 'ferritin_very_low', 'caution', 'Ferritina muito baixa: depleção de ferro; priorizar fontes de ferro heme e considerar suplementação após avaliação.')
    else if (ferritin < 30) addFlag(g, 'ferritin_low', 'attention', 'Ferritina baixa: reservas de ferro reduzidas; atenção à fadiga e recuperação.')
    else if (ferritin > 300) addFlag(g, 'ferritin_high', 'attention', 'Ferritina elevada: pode indicar inflamação ou sobrecarga de ferro; não suplementar ferro.')
  }

  if (hasValue(b12)) {
    if (b12 < 200) addFlag(g, 'b12_low', 'caution', 'Vitamina B12 baixa: risco de fadiga, neuropatia e anemia megaloblástica; suplementar após avaliação.')
    else if (b12 < 300) addFlag(g, 'b12_borderline', 'attention', 'Vitamina B12 borderline: monitorar; considerar fonte alimentar ou suplementação conservadora.')
  }

  if (hasValue(folate) && folate < 3) {
    addFlag(g, 'folate_low', 'caution', 'Folato baixo: risco de anemia; aumentar vegetais folhosos escuros e leguminosas.')
  }

  if (hasValue(wbc)) {
    if (wbc < 3000) addFlag(g, 'wbc_low', 'caution', 'Leucócitos baixos: possível imunossupressão; evitar treino extenuante em ambientes com risco de infecção.')
    else if (wbc > 11000) addFlag(g, 'wbc_high', 'attention', 'Leucócitos elevados: possível processo inflamatório/infeccioso; avaliar junto com clínica.')
  }

  return g
}

function buildThyroidStatus(bm: Map<string, BiomarkerEntry>): SignalGroup {
  const g = emptyGroup()
  const tsh = numOf(bm, 'tsh')
  const t4f = numOf(bm, 't4_free')

  if (hasValue(tsh)) {
    if (tsh > 10) addFlag(g, 'tsh_very_high', 'caution', 'TSH muito elevado: hipotireoidismo provável; metabolismo lento pode impactar composição corporal e recuperação.')
    else if (tsh > 4.5) addFlag(g, 'tsh_high', 'attention', 'TSH levemente elevado: monitorar energia, metabolismo e recuperação; consultar médico.')
    else if (tsh < 0.4) addFlag(g, 'tsh_low', 'caution', 'TSH baixo: possível hipertireoidismo; pode impactar frequência cardíaca e composição muscular.')
  }

  if (hasValue(t4f)) {
    if (t4f < 0.8) addFlag(g, 't4_free_low', 'attention', 'T4 livre baixo: suporte tireoidiano potencialmente reduzido.')
    else if (t4f > 1.8) addFlag(g, 't4_free_high', 'attention', 'T4 livre elevado: verificar hipertireoidismo com médico.')
  }

  return g
}

function buildAndrogenStatus(bm: Map<string, BiomarkerEntry>): SignalGroup {
  const g = emptyGroup()
  const testTotal = numOf(bm, 'testosterone_total')
  const testFree = numOf(bm, 'testosterone_free')
  const shbg = numOf(bm, 'shbg')
  const cortisol = numOf(bm, 'cortisol')
  const dheaS = numOf(bm, 'dhea_s')
  const estradiol = numOf(bm, 'estradiol')

  if (hasValue(testTotal)) {
    if (testTotal < 200) addFlag(g, 'testosterone_very_low', 'caution', 'Testosterona total muito baixa: recuperação e hipertrofia comprometidas; necessária avaliação médica.')
    else if (testTotal < 350) addFlag(g, 'testosterone_low', 'attention', 'Testosterona total abaixo do ideal: monitorar sono, estresse e composição corporal.')
    else if (testTotal > 1000) addFlag(g, 'testosterone_high', 'attention', 'Testosterona total acima do esperado: verificar contexto clínico.')
  }

  if (hasValue(testFree) && testFree < 3) {
    addFlag(g, 'free_testosterone_low', 'attention', 'Testosterona livre baixa: verificar SHBG e status androgênico geral.')
  }

  if (hasValue(shbg) && shbg > 80) {
    addFlag(g, 'shbg_high', 'attention', 'SHBG muito elevado: reduz biodisponibilidade de testosterona; monitorar sinalização androgênica.')
  }

  if (hasValue(cortisol)) {
    if (cortisol > 25) addFlag(g, 'cortisol_high', 'attention', 'Cortisol elevado: estado catabólico potencial; priorizar recuperação, sono e gestão de estresse.')
    else if (cortisol < 7) addFlag(g, 'cortisol_low', 'attention', 'Cortisol baixo: possível insuficiência adrenal; avaliar com médico.')
  }

  if (hasValue(dheaS) && dheaS < 80) {
    addFlag(g, 'dhea_s_low', 'attention', 'DHEA-S baixo: pode impactar vitalidade e composição corporal em adultos mais velhos.')
  }

  return g
}

function buildInflammationStatus(bm: Map<string, BiomarkerEntry>): SignalGroup {
  const g = emptyGroup()
  const crp = numOf(bm, 'crp')
  const homocysteine = numOf(bm, 'homocysteine')
  const ferritin = numOf(bm, 'ferritin')

  if (hasValue(crp)) {
    if (crp >= 10) addFlag(g, 'crp_very_high', 'critical', 'PCR ≥10 mg/L: inflamação sistêmica significativa; evitar treino intenso; avaliar causa.')
    else if (crp >= 3) addFlag(g, 'crp_elevated', 'caution', 'PCR 3–9 mg/L: risco cardiovascular aumentado e recuperação prejudicada; priorizar sono e anti-inflamatórios naturais.')
    else if (crp >= 1) addFlag(g, 'crp_borderline', 'attention', 'PCR 1–2.9 mg/L: leve elevação; verificar qualidade do sono, dieta e estresse crônico.')
  }

  if (hasValue(homocysteine)) {
    if (homocysteine > 20) addFlag(g, 'homocysteine_very_high', 'caution', 'Homocisteína muito elevada: risco cardiovascular e cognitivo aumentado; priorizar B6, B12 e folato.')
    else if (homocysteine > 12) addFlag(g, 'homocysteine_elevated', 'attention', 'Homocisteína elevada: monitorar vitaminas do complexo B e consumo de metionina.')
  }

  // Ferritin as inflammatory marker (high only, duplicated from hematologic with different meaning)
  if (hasValue(ferritin) && ferritin > 300) {
    addFlag(g, 'ferritin_inflammation_signal', 'attention', 'Ferritina elevada pode refletir inflamação; considerar junto com PCR.')
  }

  return g
}

function buildMicronutrientStatus(bm: Map<string, BiomarkerEntry>): SignalGroup {
  const g = emptyGroup()
  const vitD = numOf(bm, 'vitamin_d')
  const b12 = numOf(bm, 'vitamin_b12')
  const folate = numOf(bm, 'folate')
  const zinc = numOf(bm, 'zinc')

  if (hasValue(vitD)) {
    if (vitD < 20) addFlag(g, 'vitamin_d_deficient', 'caution', 'Vitamina D deficiente (<20 ng/mL): impacta força, imunidade e recuperação; suplementar após avaliação.')
    else if (vitD < 30) addFlag(g, 'vitamin_d_insufficient', 'attention', 'Vitamina D insuficiente (20–29 ng/mL): otimizar com exposição solar ou suplementação conservadora.')
    else if (vitD > 100) addFlag(g, 'vitamin_d_high', 'attention', 'Vitamina D >100 ng/mL: possível toxicidade; não suplementar; avaliar com médico.')
  }

  if (hasValue(b12) && b12 < 300) {
    addFlag(g, 'b12_low_micronutrient', 'attention', 'Vitamina B12 baixa: impacta energia, sistema nervoso e eritrócitos; priorizar fontes animais ou suplementação.')
  }

  if (hasValue(folate) && folate < 3) {
    addFlag(g, 'folate_low_micronutrient', 'attention', 'Folato baixo: impacta síntese de DNA e eritrócitos; aumentar vegetais folhosos.')
  }

  if (hasValue(zinc) && zinc < 65) {
    addFlag(g, 'zinc_low', 'attention', 'Zinco baixo: impacta testosterona, imunidade e síntese proteica; considerar alimentos ricos em zinco.')
  }

  return g
}

// ---------------------------------------------------------------------------
// COMPOSITE GROUPS (training readiness, recovery risk, dietary attention)
// ---------------------------------------------------------------------------

function buildTrainingReadiness(
  metabolic: ReturnType<typeof buildMetabolicHealth>,
  lipid: ReturnType<typeof buildLipidHealth>,
  liver: ReturnType<typeof buildLiverHealth>,
  kidney: ReturnType<typeof buildKidneyHydration>,
  hematologic: ReturnType<typeof buildHematologicStatus>,
  androgen: ReturnType<typeof buildAndrogenStatus>,
  inflammation: ReturnType<typeof buildInflammationStatus>,
): SignalGroup {
  const g = emptyGroup()

  const criticalGroups = [metabolic, lipid, liver, kidney, hematologic]
  const hasCritical = criticalGroups.some((grp) => grp.level === 'critical')
  const hasCaution = criticalGroups.some((grp) => grp.level === 'caution')

  if (hasCritical) {
    addFlag(g, 'training_readiness_reduced_critical', 'critical', 'Sinais críticos presentes: reduzir volume e intensidade; priorizar avaliação médica antes de progredir.')
  } else if (hasCaution) {
    addFlag(g, 'training_readiness_reduced', 'caution', 'Sinais de cautela: modular volume, evitar falha muscular excessiva, priorizar recuperação.')
  }

  if (hematologic.flags.some((f) => f.includes('hemoglobin') || f.includes('ferritin_low'))) {
    addFlag(g, 'aerobic_capacity_reduced', 'caution', 'Transporte de O₂ reduzido: limitar treinos de alta intensidade; priorizar treino de resistência moderado.')
  }

  if (androgen.flags.some((f) => f.includes('testosterone_very_low') || f.includes('cortisol_high'))) {
    addFlag(g, 'anabolic_signal_suboptimal', 'attention', 'Sinalização anabólica subótima: priorizar sono, deload periódico e volume controlado.')
  }

  if (inflammation.flags.some((f) => f.includes('crp_very_high') || f.includes('crp_elevated'))) {
    addFlag(g, 'systemic_inflammation_limits_training', 'caution', 'Inflamação sistêmica: deload ativo; focar em mobilidade e cardio leve até PCR normalizar.')
  }

  if (g.flags.length === 0) {
    g.notes.push('Sem sinais limitantes identificados. Progressão de treino pode ser normal com base no perfil clínico.')
  }

  return g
}

function buildRecoveryRisk(
  metabolic: ReturnType<typeof buildMetabolicHealth>,
  hematologic: ReturnType<typeof buildHematologicStatus>,
  androgen: ReturnType<typeof buildAndrogenStatus>,
  inflammation: ReturnType<typeof buildInflammationStatus>,
  thyroid: ReturnType<typeof buildThyroidStatus>,
): SignalGroup {
  const g = emptyGroup()

  if (inflammation.flags.some((f) => f.includes('crp_very_high'))) {
    addFlag(g, 'recovery_severely_impaired', 'critical', 'Inflamação crítica: recuperação muito comprometida; priorizar descanso total e avaliação médica.')
  } else if (inflammation.flags.some((f) => f.includes('crp_elevated'))) {
    addFlag(g, 'recovery_impaired', 'caution', 'Inflamação sistêmica: recuperação diminuída; aumentar dias de descanso; ômega-3 e sono são prioritários.')
  }

  if (androgen.flags.some((f) => f.includes('cortisol_high'))) {
    addFlag(g, 'cortisol_high_recovery_risk', 'attention', 'Cortisol elevado: catabolismo aumentado; deload, sono de qualidade e gestão de estresse são críticos.')
  }

  if (hematologic.flags.some((f) => f.includes('hemoglobin_low') || f.includes('hemoglobin_borderline') || f.includes('ferritin_very_low'))) {
    addFlag(g, 'hematologic_recovery_risk', 'caution', 'Status hematológico comprometido: fadiga aumentada; tempo de recuperação prolongado.')
  }

  if (thyroid.flags.some((f) => f.includes('tsh_high') || f.includes('tsh_very_high'))) {
    addFlag(g, 'hypothyroid_recovery_risk', 'attention', 'TSH elevado: metabolismo lento pode aumentar tempo de recuperação.')
  }

  if (metabolic.flags.some((f) => f.includes('hba1c_prediabetes') || f.includes('hba1c_diabetes_range'))) {
    addFlag(g, 'glycemic_recovery_risk', 'attention', 'Alteração glicêmica: controle de carboidratos pós-treino é importante para recuperação adequada.')
  }

  if (g.flags.length === 0) {
    g.notes.push('Sem sinais de risco de recuperação identificados.')
  }

  return g
}

function buildDietaryAttentionPoints(
  metabolic: ReturnType<typeof buildMetabolicHealth>,
  lipid: ReturnType<typeof buildLipidHealth>,
  liver: ReturnType<typeof buildLiverHealth>,
  kidney: ReturnType<typeof buildKidneyHydration>,
  micronutrient: ReturnType<typeof buildMicronutrientStatus>,
  hematologic: ReturnType<typeof buildHematologicStatus>,
): SignalGroup {
  const g = emptyGroup()

  if (metabolic.flags.some((f) => f.includes('glucose') || f.includes('hba1c') || f.includes('insulin'))) {
    addFlag(g, 'carb_distribution_attention', 'attention', 'Distribuição de carboidratos: priorizar carboidratos complexos; evitar picos glicêmicos; distribuir ao longo do dia.')
  }

  if (lipid.flags.some((f) => f.includes('ldl') || f.includes('triglycerides') || f.includes('hdl_low'))) {
    addFlag(g, 'lipid_dietary_attention', 'attention', 'Atenção ao perfil lipídico: reduzir gordura saturada e trans; priorizar ômega-3, fibras solúveis e gorduras insaturadas.')
  }

  if (liver.flags.some((f) => f.includes('ast') || f.includes('alt') || f.includes('ggt'))) {
    addFlag(g, 'liver_dietary_attention', 'attention', 'Função hepática alterada: evitar álcool; priorizar vegetais crucíferos; avaliar suplementos em uso.')
  }

  if (kidney.flags.some((f) => f.includes('creatinine') || f.includes('egfr') || f.includes('urea_high'))) {
    addFlag(g, 'protein_intake_attention', 'attention', 'Função renal: não exceder proteína além do necessário; manter hidratação adequada.')
  }

  if (micronutrient.flags.some((f) => f.includes('vitamin_d_deficient') || f.includes('vitamin_d_insufficient'))) {
    addFlag(g, 'vitamin_d_diet_priority', 'attention', 'Priorizar fontes de vitamina D (salmão, atum, ovos); considerar suplementação com acompanhamento.')
  }

  if (hematologic.flags.some((f) => f.includes('ferritin_low') || f.includes('ferritin_very_low') || f.includes('hemoglobin_low'))) {
    addFlag(g, 'iron_diet_priority', 'attention', 'Priorizar ferro heme (carnes vermelhas magras, aves); combinar com vitamina C para absorção.')
  }

  if (hematologic.flags.some((f) => f.includes('b12_low'))) {
    addFlag(g, 'b12_diet_priority', 'attention', 'Priorizar fontes de B12 (carnes, ovos, laticínios); vegetarianos/veganos devem suplementar.')
  }

  return g
}

function buildSafetyFlags(
  metabolic: ReturnType<typeof buildMetabolicHealth>,
  lipid: ReturnType<typeof buildLipidHealth>,
  liver: ReturnType<typeof buildLiverHealth>,
  kidney: ReturnType<typeof buildKidneyHydration>,
  hematologic: ReturnType<typeof buildHematologicStatus>,
  inflammation: ReturnType<typeof buildInflammationStatus>,
): SignalGroup {
  const g = emptyGroup()

  const allCriticalFlags = [
    ...metabolic.flags,
    ...lipid.flags,
    ...liver.flags,
    ...kidney.flags,
    ...hematologic.flags,
    ...inflammation.flags,
  ].filter((f) =>
    f.includes('critical') ||
    f.includes('very_high') ||
    f.includes('very_low') ||
    f.includes('diabetes_range') ||
    f.includes('pancreatite') ||
    f.includes('potassium_high_critical') ||
    f.includes('egfr_severely_reduced') ||
    f.includes('wbc_low')
  )

  for (const flag of allCriticalFlags) {
    addFlag(g, `safety_${flag}`, 'critical', 'Sinal crítico identificado. Avaliação médica recomendada antes de alterar treino ou dieta de forma agressiva.')
  }

  if (
    lipid.flags.includes('ldl_very_high') ||
    lipid.flags.includes('triglycerides_very_high') ||
    kidney.flags.includes('creatinine_very_high') ||
    kidney.flags.includes('egfr_severely_reduced')
  ) {
    addFlag(g, 'cardiovascular_metabolic_safety', 'critical', 'Risco cardiovascular/metabólico elevado: não aumentar intensidade de treino sem liberação médica.')
  }

  if (g.flags.length === 0) {
    g.notes.push('Sem sinais de segurança críticos identificados.')
  }

  return g
}

// ---------------------------------------------------------------------------
// SCORE COMPUTATION
// ---------------------------------------------------------------------------

function computeScores(
  metabolic: SignalGroup,
  lipid: SignalGroup,
  liver: SignalGroup,
  kidney: SignalGroup,
  hematologic: SignalGroup,
  androgen: SignalGroup,
  inflammation: SignalGroup,
) {
  function groupScore(group: SignalGroup): number {
    switch (group.level) {
      case 'ok': return 85
      case 'attention': return 68
      case 'caution': return 48
      case 'critical': return 25
    }
  }

  const metabolicScore = groupScore(metabolic)
  const lipidScore = groupScore(lipid)
  const liverScore = groupScore(liver)
  const kidneyScore = groupScore(kidney)
  const hematologicScore = groupScore(hematologic)
  const hormonalScore = groupScore(androgen)
  const safetyScore = clamp(
    Math.min(metabolicScore, lipidScore, liverScore, kidneyScore),
    0,
    100,
  )
  const recoveryScore = clamp(
    Math.round((hematologicScore + hormonalScore + groupScore(inflammation) + metabolicScore) / 4),
    0,
    100,
  )

  return {
    metabolic_score: metabolicScore,
    recovery_score: recoveryScore,
    hematologic_score: hematologicScore,
    hormonal_score: hormonalScore,
    safety_score: safetyScore,
    lipid_score: lipidScore,
    liver_score: liverScore,
    kidney_score: kidneyScore,
  }
}

// ---------------------------------------------------------------------------
// MAIN ENTRY POINT
// ---------------------------------------------------------------------------

/**
 * Build a structured health & performance profile from normalized biomarkers.
 *
 * @param biomarkers - Array of normalized BiomarkerEntry objects
 * @returns HealthPerformanceProfile with signal groups and scores
 */
export function buildHealthPerformanceProfile(biomarkers: BiomarkerEntry[]): HealthPerformanceProfile {
  const bm = byKey(biomarkers)

  const metabolic = buildMetabolicHealth(bm)
  const lipid = buildLipidHealth(bm)
  const liver = buildLiverHealth(bm)
  const kidney = buildKidneyHydration(bm)
  const hematologic = buildHematologicStatus(bm)
  const thyroid = buildThyroidStatus(bm)
  const androgen = buildAndrogenStatus(bm)
  const inflammation = buildInflammationStatus(bm)
  const micronutrient = buildMicronutrientStatus(bm)

  const trainingReadiness = buildTrainingReadiness(metabolic, lipid, liver, kidney, hematologic, androgen, inflammation)
  const recoveryRisk = buildRecoveryRisk(metabolic, hematologic, androgen, inflammation, thyroid)
  const dietaryAttention = buildDietaryAttentionPoints(metabolic, lipid, liver, kidney, micronutrient, hematologic)
  const safetyFlags = buildSafetyFlags(metabolic, lipid, liver, kidney, hematologic, inflammation)

  const scores = computeScores(metabolic, lipid, liver, kidney, hematologic, androgen, inflammation)

  return {
    metabolic_health: metabolic,
    lipid_health: lipid,
    liver_health: liver,
    kidney_hydration: kidney,
    hematologic_status: hematologic,
    thyroid_status: thyroid,
    androgen_status: androgen,
    inflammation_status: inflammation,
    micronutrient_status: micronutrient,
    training_readiness: trainingReadiness,
    recovery_risk: recoveryRisk,
    dietary_attention_points: dietaryAttention,
    safety_flags: safetyFlags,
    scores,
  }
}
