const dietCompat = require('../../server/apihelpers/_diet');
const { buildMasterContext } = require('../../core/nutrition/diet_context_master');
const { buildTrainingContext, buildAdherenceContext } = require('../../core/nutrition/diet_context_training');
const { buildClinicalContext } = require('../../core/nutrition/diet_context_clinical');
const adaptiveNutrition = require('../../lib/nutrition/adaptiveNutrition');
const tacoService = require('../../lib/nutrition/tacoService');

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function uniqueArray(values) {
  const seen = new Set();
  return normalizeArray(values).filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickString() {
  for (let index = 0; index < arguments.length; index += 1) {
    const value = arguments[index];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function pickNumber() {
  for (let index = 0; index < arguments.length; index += 1) {
    const value = arguments[index];
    if (value === undefined || value === null || value === '') continue;
    const parsed = Number(String(value).replace(',', '.').replace(/[^0-9.\-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function roundNumber(value, digits) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const p = Math.pow(10, typeof digits === 'number' ? digits : 1);
  return Math.round(n * p) / p;
}

function unwrapDietPayload(payload) {
  const safe = normalizeObject(payload);
  const nested = normalizeObject(safe.dietWizardPayload || safe.payload && safe.payload.dietWizardPayload);
  if (!Object.keys(nested).length) return safe;
  return Object.assign({}, safe, nested, {
    context: Object.assign({}, normalizeObject(safe.context), normalizeObject(nested.context)),
    profile: Object.assign({}, normalizeObject(safe.profile), normalizeObject(nested.profile)),
  });
}

function readAdaptiveMemory(payload) {
  const safe = normalizeObject(payload);
  const supplied = normalizeObject(
    safe.nutritionMemory ||
    safe.adaptiveMemory ||
    safe.context && safe.context.nutritionMemory ||
    safe.profile && safe.profile.nutritionMemory
  );
  if (Object.keys(supplied).length) return adaptiveNutrition.normalizeMemory(supplied);
  try {
    return adaptiveNutrition.readNutritionMemory();
  } catch (_) {
    return adaptiveNutrition.normalizeMemory();
  }
}

function buildBiomarkerNutritionStrategy(labContext) {
  const lab = normalizeObject(labContext);
  const biomarkers = Array.isArray(lab.biomarkers) ? lab.biomarkers : [];
  const flags = [].concat(
    Array.isArray(lab.clinicalFlags) ? lab.clinicalFlags : [],
    Array.isArray(lab.criticalFlags) ? lab.criticalFlags : []
  );
  const notes = [];
  const markerNames = biomarkers.map((b) => String(b && b.name || '').trim()).filter(Boolean).slice(0, 12);

  if (markerNames.length) {
    notes.push('Biomarcadores reais considerados: ' + markerNames.join(', ') + '.');
  }
  if (flags.indexOf('high_potassium') >= 0 || flags.indexOf('potassium_alert') >= 0) {
    notes.push('Atenção a alimentos muito ricos em potássio; priorizar distribuição e substituições conservadoras.');
  }
  if (flags.indexOf('pre_diabetes') >= 0 || flags.indexOf('glycemic_risk') >= 0 || flags.indexOf('hyperglycemia_alert') >= 0 || flags.indexOf('hba1c_alert') >= 0) {
    notes.push('Distribuir carboidratos ao longo do dia e evitar picos glicêmicos simples.');
  }
  if (flags.indexOf('high_ldl') >= 0 || flags.indexOf('ldl_alert') >= 0) {
    notes.push('Priorizar fibras, gorduras melhores e reduzir escolhas com maior gordura saturada.');
  }
  if (flags.indexOf('kidney_alert') >= 0) {
    notes.push('Aplicar cautela renal: revisar proteína, sódio, potássio e fósforo conforme contexto clínico.');
  }

  return {
    enabled: biomarkers.length > 0 || flags.length > 0,
    source: 'kronia_labs_reports',
    mode: lab.mode || 'standard',
    biomarkersCount: biomarkers.length,
    biomarkersUsed: biomarkers,
    clinicalFlags: Array.isArray(lab.clinicalFlags) ? lab.clinicalFlags : [],
    criticalFlags: Array.isArray(lab.criticalFlags) ? lab.criticalFlags : [],
    scores: lab.scores || null,
    notes,
  };
}

function normalizeDietPayload(payload) {
  const safePayload = unwrapDietPayload(payload);
  const master = buildMasterContext(safePayload);
  const training = buildTrainingContext(safePayload);
  const adherence = buildAdherenceContext(safePayload);
  const clinical = buildClinicalContext(safePayload);
  const adaptiveMemory = readAdaptiveMemory(safePayload);

  const context = normalizeObject(safePayload.context);
  const profile = normalizeObject(safePayload.profile);
  const intakeSnapshot = normalizeObject(safePayload.intakeSnapshot || context.intakeSnapshot);
  const nutritionFlowSelections = normalizeObject(safePayload.nutritionFlowSelections || context.nutritionFlowSelections);
  const supabaseSnapshot = normalizeObject(safePayload.supabaseSnapshot || profile.supabaseSnapshot || context.supabaseSnapshot);
  const biomarkerStrategy = buildBiomarkerNutritionStrategy(clinical.labContext);

  const preferredMealCount = pickNumber(adaptiveMemory.preferred_meal_count);
  const dislikedFoods = uniqueArray([].concat(
    master.alimentosEvitar || [],
    safePayload.alimentosQueEvita || [],
    adaptiveMemory.disliked_foods || [],
    adaptiveMemory.avoided_foods || [],
    adaptiveMemory.frequent_rejections || []
  ));
  const likedFoods = uniqueArray([].concat(
    master.preferencias || [],
    safePayload.preferenciasAlimentares || [],
    adaptiveMemory.liked_foods || []
  ));
  const restrictions = uniqueArray([].concat(
    master.restricoes || [],
    safePayload.restricoesAlimentares || [],
    adaptiveMemory.preferred_diet_style ? [adaptiveMemory.preferred_diet_style] : []
  ));

  const normalized = {
    objetivo: master.objetivo,
    sexo: master.sexo,
    idade: master.idade,
    peso: master.peso,
    altura: master.altura,
    rotina: master.rotina,
    nivelAtividade: master.nivelAtividade,
    refeicoesPorDia: preferredMealCount || master.refeicoesPorDia,
    restricoes: restrictions,
    preferencias: likedFoods,
    alimentosEvitar: dislikedFoods,
    suplementos: master.suplementos,
    observacoes: master.observacoes,
    gorduraCorporal: master.gorduraCorporal,
    biotipo: master.biotipo,
    padraoAlimentar: master.padraoAlimentar || adaptiveMemory.preferred_diet_style || null,
    contextoTreino: Object.assign({}, training, {
      statusTreino: safePayload.statusTreino != null ? safePayload.statusTreino : (training.statusTreino != null ? training.statusTreino : null),
      perfilTreino: safePayload.perfilTreino != null ? safePayload.perfilTreino : (training.perfilTreino != null ? training.perfilTreino : null),
      intensidadeGeral: safePayload.intensidadeGeral != null ? safePayload.intensidadeGeral : (training.intensidadeGeral != null ? training.intensidadeGeral : null),
      modalidades: Array.isArray(safePayload.modalidades) ? safePayload.modalidades : (Array.isArray(training.modalidades) ? training.modalidades : []),
      rotinaForaTreino: safePayload.rotinaForaTreino != null ? safePayload.rotinaForaTreino : (training.rotinaForaTreino != null ? training.rotinaForaTreino : null),
      fadiga: safePayload.fadiga != null ? safePayload.fadiga : (training.fadiga != null ? training.fadiga : null),
      dorMuscular: safePayload.dorMuscular != null ? safePayload.dorMuscular : (training.dorMuscular != null ? training.dorMuscular : null),
      quedaRendimento: safePayload.quedaRendimento != null ? safePayload.quedaRendimento : (training.quedaRendimento != null ? training.quedaRendimento : null),
    }),
    saude: clinical.saude,
    aderencia: adherence,
    nutritionGoals: master.nutritionGoals,
    labContext: clinical.labContext,
    labBiomarkerStrategy: biomarkerStrategy,
    clinicalData: clinical.clinicalData,
    intakeSnapshot: Object.keys(intakeSnapshot).length ? intakeSnapshot : null,
    nutritionFlowSelections: Object.keys(nutritionFlowSelections).length ? nutritionFlowSelections : null,
    supabaseSnapshot,
    bcmData: safePayload.bcmData != null ? safePayload.bcmData : null,
    pcmManual: safePayload.pcmManual != null ? safePayload.pcmManual : null,
    bodyComposition: safePayload.bodyComposition != null ? safePayload.bodyComposition : null,
    metabolismBehaviorContext: {
      respostaPeso: safePayload.respostaPeso != null ? safePayload.respostaPeso : null,
      apetite: safePayload.apetite != null ? safePayload.apetite : null,
      historicoDieta: safePayload.historicoDieta != null ? safePayload.historicoDieta : null,
      adesao: safePayload.adesao != null ? safePayload.adesao : null,
      rotina: safePayload.rotina != null ? safePayload.rotina : null,
      sono: safePayload.sono != null ? safePayload.sono : null,
      estresse: safePayload.estresse != null ? safePayload.estresse : null,
      usoHormonios: safePayload.usoHormonios != null ? safePayload.usoHormonios : null,
    },
    patologias: Array.isArray(safePayload.patologias) ? safePayload.patologias : [],
    examesDisponiveis: Array.isArray(safePayload.examesDisponiveis) ? safePayload.examesDisponiveis : [],
    adaptiveMemory,
  };

  const score = adaptiveNutrition.calculateNutritionPersonalizationScore(normalized, adaptiveMemory);
  normalized.adaptivePersonalization = Object.assign({}, score, {
    memory: adaptiveMemory,
    enabled: true,
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('[DIET_CLINICAL_DATA_PAYLOAD]', JSON.stringify({
      healthConditions: normalized.clinicalData && normalized.clinicalData.healthConditions,
      flags: normalized.clinicalData && normalized.clinicalData.flags,
      bcmManual: normalized.clinicalData && normalized.clinicalData.bcmManual ? '(present)' : null,
      exams: normalized.clinicalData && normalized.clinicalData.exams,
      labContext: normalized.labContext ? {
        mode: normalized.labContext.mode,
        biomarkers: Array.isArray(normalized.labContext.biomarkers) ? normalized.labContext.biomarkers.length : 0,
        clinicalFlags: normalized.labContext.clinicalFlags,
      } : null,
    }));
  }

  return normalized;
}

function getMissingCriticalFields(normalizedInput) {
  const missing = [];
  if (!normalizedInput.objetivo) missing.push('objetivo');
  if (!normalizedInput.sexo) missing.push('sexo');
  if (!normalizedInput.idade) missing.push('idade');
  if (!normalizedInput.peso) missing.push('peso');
  if (!normalizedInput.altura) missing.push('altura');
  return missing;
}

function buildRenderableFallbackInput(normalizedInput) {
  const safe = normalizedInput && typeof normalizedInput === 'object' ? normalizedInput : {};
  const objetivo = pickString(safe.objetivo, 'manutencao');
  const sexo = pickString(safe.sexo, 'masculino');
  const idade = pickNumber(safe.idade, 30);
  const peso = pickNumber(safe.peso, 75);
  const altura = pickNumber(safe.altura, 175);
  const refeicoesPorDia = pickNumber(safe.refeicoesPorDia, 4);
  const nivelAtividade = pickString(safe.nivelAtividade, safe.rotina, 'moderado');
  const padraoAlimentar = pickString(safe.padraoAlimentar, 'onívoro');

  return Object.assign({}, safe, {
    objetivo,
    sexo,
    idade,
    peso,
    altura,
    refeicoesPorDia,
    nivelAtividade,
    rotina: safe.rotina || nivelAtividade,
    padraoAlimentar,
    labContext: safe.labContext || null,
  });
}

function buildDietPlanWithFallback(normalizedInput) {
  const primaryPlan = dietCompat.buildDietPlan(normalizedInput);
  if (!primaryPlan.failSafe) {
    return {
      plan: primaryPlan,
      generatedFromFallback: false,
      missingFields: getMissingCriticalFields(normalizedInput),
    };
  }

  const fallbackInput = buildRenderableFallbackInput(normalizedInput);
  const fallbackPlan = dietCompat.buildDietPlan(fallbackInput);
  const missingFields = getMissingCriticalFields(normalizedInput);
  const orientation = String(
    (primaryPlan.limitedOrientation && primaryPlan.limitedOrientation.orientacao) ||
    'Dados insuficientes para o plano completo; aplicando versão inicial segura.'
  ).trim();

  if (fallbackPlan.failSafe) {
    return {
      plan: primaryPlan,
      generatedFromFallback: true,
      missingFields,
      fallbackInput,
    };
  }

  const notes = Array.isArray(fallbackPlan.observacoes) ? fallbackPlan.observacoes.slice() : [];
  notes.unshift(orientation);
  if (missingFields.length) {
    notes.push('Campos ausentes para personalização completa: ' + missingFields.join(', ') + '.');
  }

  return {
    plan: Object.assign({}, fallbackPlan, {
      failSafe: true,
      flow_state: 'failsafe_renderable',
      limitedOrientation: {
        limited: true,
        reason: 'Dados insuficientes para personalização completa.',
        inconsistencias: missingFields,
        orientacao: orientation,
        objetivoSolicitado: normalizedInput.objetivo || fallbackInput.objetivo,
      },
      observacoes: notes,
    }),
    generatedFromFallback: true,
    missingFields,
    fallbackInput,
  };
}

function parsePortionGrams(item) {
  const candidates = [item.grams, item.gramas, item.peso_g, item.weight_g, item.qtde, item.porcao, item.portionLabel, item.qty, item.quantidade];
  for (let i = 0; i < candidates.length; i += 1) {
    const value = candidates[i];
    if (value == null || value === '') continue;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    const text = String(value).toLowerCase().replace(',', '.');
    const kg = text.match(/(\d+(?:\.\d+)?)\s*kg\b/);
    if (kg) return Number(kg[1]) * 1000;
    const g = text.match(/(\d+(?:\.\d+)?)\s*g\b/);
    if (g) return Number(g[1]);
  }
  return null;
}

function itemName(item) {
  return pickString(item.nome, item.name, item.alimento, item.food, item.item) || '';
}

function buildTacoEquivalent(item) {
  const name = itemName(item);
  if (!name) return null;
  const match = tacoService.findBestTacoMatch(name);
  if (!match) return null;
  const grams = parsePortionGrams(item);
  const estimated = grams ? tacoService.estimateNutritionFromTaco(match, grams) : null;
  return {
    source: 'TACO',
    match: tacoService.mapTacoFoodToKroniaMacros(match),
    grams: grams || null,
    estimated: estimated || null,
  };
}

function decorateFoodItemWithTaco(item) {
  const safeItem = normalizeObject(item);
  const tacoEquivalent = buildTacoEquivalent(safeItem);
  if (!tacoEquivalent) return safeItem;
  const estimated = tacoEquivalent.estimated;
  const next = Object.assign({}, safeItem, {
    macroSource: 'TACO',
    taco_id: tacoEquivalent.match && tacoEquivalent.match.taco_id,
    codigo_taco: tacoEquivalent.match && tacoEquivalent.match.codigo_taco,
    tacoEquivalent,
  });
  if (estimated) {
    next.kcal = roundNumber(estimated.kcal, 0);
    next.prot = roundNumber(estimated.proteina, 1);
    next.carb = roundNumber(estimated.carbo, 1);
    next.gord = roundNumber(estimated.gordura, 1);
    next.fibra = roundNumber(estimated.fibra, 1);
  }
  return next;
}

function tacoSubtotal(items) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    if (!item || item.macroSource !== 'TACO') return acc;
    acc.kcal += Number(item.kcal || 0);
    acc.prot += Number(item.prot || 0);
    acc.carb += Number(item.carb || 0);
    acc.gord += Number(item.gord || 0);
    acc.fibra += Number(item.fibra || 0);
    acc.items += 1;
    return acc;
  }, { kcal: 0, prot: 0, carb: 0, gord: 0, fibra: 0, items: 0 });
}

function decorateStructuredItemWithTaco(item) {
  const enriched = decorateFoodItemWithTaco(Object.assign({}, item, {
    nome: item.nome || item.name,
    qtde: item.porcao || item.qtde || item.portionLabel,
  }));
  const next = Object.assign({}, item, {
    macroSource: enriched.macroSource || item.macroSource,
    taco_id: enriched.taco_id || item.taco_id,
    codigo_taco: enriched.codigo_taco || item.codigo_taco,
    tacoEquivalent: enriched.tacoEquivalent || item.tacoEquivalent,
  });
  if (enriched.macroSource === 'TACO') {
    next.calorias = enriched.kcal;
    next.proteinas = enriched.prot;
    next.carboidratos = enriched.carb;
    next.gorduras = enriched.gord;
    next.fibras = enriched.fibra;
  }
  return next;
}

function decoratePlanWithTacoMacros(plan) {
  const safePlan = plan && typeof plan === 'object' ? plan : {};
  const audit = { source: 'TACO', matchedItems: 0, unmatchedItems: [], totals: { kcal: 0, proteina: 0, carbo: 0, gordura: 0, fibra: 0 } };

  const refeicoes = Array.isArray(safePlan.refeicoes) ? safePlan.refeicoes.map((meal) => {
    const alimentos = Array.isArray(meal.alimentos) ? meal.alimentos.map((item) => {
      const enriched = decorateFoodItemWithTaco(item);
      if (enriched.macroSource === 'TACO') audit.matchedItems += 1;
      else if (itemName(item)) audit.unmatchedItems.push(itemName(item));
      return enriched;
    }) : [];
    const subtotal = tacoSubtotal(alimentos);
    audit.totals.kcal += subtotal.kcal;
    audit.totals.proteina += subtotal.prot;
    audit.totals.carbo += subtotal.carb;
    audit.totals.gordura += subtotal.gord;
    audit.totals.fibra += subtotal.fibra;
    return Object.assign({}, meal, {
      alimentos,
      macroSource: subtotal.items ? 'TACO' : meal.macroSource,
      subtotalTaco: subtotal.items ? {
        kcal: roundNumber(subtotal.kcal, 0),
        prot: roundNumber(subtotal.prot, 1),
        carb: roundNumber(subtotal.carb, 1),
        gord: roundNumber(subtotal.gord, 1),
        fibra: roundNumber(subtotal.fibra, 1),
      } : null,
    });
  }) : safePlan.refeicoes;

  let planoEstruturado = safePlan.planoEstruturado;
  if (planoEstruturado && Array.isArray(planoEstruturado.refeicoes)) {
    planoEstruturado = Object.assign({}, planoEstruturado, {
      refeicoes: planoEstruturado.refeicoes.map((meal) => Object.assign({}, meal, {
        itens: Array.isArray(meal.itens) ? meal.itens.map(decorateStructuredItemWithTaco) : meal.itens,
      })),
    });
  }

  audit.totals = {
    kcal: roundNumber(audit.totals.kcal, 0),
    proteina: roundNumber(audit.totals.proteina, 1),
    carbo: roundNumber(audit.totals.carbo, 1),
    gordura: roundNumber(audit.totals.gordura, 1),
    fibra: roundNumber(audit.totals.fibra, 1),
  };
  audit.unmatchedItems = uniqueArray(audit.unmatchedItems).slice(0, 20);

  return Object.assign({}, safePlan, {
    refeicoes,
    planoEstruturado,
    macroSource: audit.matchedItems ? 'TACO' : safePlan.macroSource,
    tacoMacroAudit: audit,
  });
}

function decoratePlanWithBiomarkers(plan, normalizedInput) {
  const safePlan = plan && typeof plan === 'object' ? plan : {};
  const strategy = normalizedInput && normalizedInput.labBiomarkerStrategy ? normalizedInput.labBiomarkerStrategy : buildBiomarkerNutritionStrategy(normalizedInput && normalizedInput.labContext);
  if (!strategy || !strategy.enabled) return safePlan;
  const observacoes = Array.isArray(safePlan.observacoes) ? safePlan.observacoes.slice() : [];
  strategy.notes.forEach((note) => {
    if (note && observacoes.indexOf(note) === -1) observacoes.push(note);
  });
  return Object.assign({}, safePlan, {
    observacoes,
    labContext: normalizedInput.labContext || safePlan.labContext || null,
    biomarkerNutritionStrategy: strategy,
    biomarkersUsed: strategy.biomarkersUsed,
    clinicalContext: Object.assign({}, normalizeObject(safePlan.clinicalContext), { labContext: normalizedInput.labContext || null }),
  });
}

function decoratePlanWithAdaptiveLayer(plan, normalizedInput) {
  const safePlan = decoratePlanWithTacoMacros(decoratePlanWithBiomarkers(plan, normalizedInput));
  const adaptive = normalizedInput && normalizedInput.adaptivePersonalization;
  const memory = adaptive && adaptive.memory ? adaptive.memory : adaptiveNutrition.normalizeMemory();
  const suggestions = adaptiveNutrition.suggestDietAdaptations(safePlan, memory, normalizedInput);
  const observacoes = Array.isArray(safePlan.observacoes) ? safePlan.observacoes.slice() : [];
  if (adaptive && adaptive.score >= 40) {
    observacoes.push('Personalização adaptativa ativa: preferências, rejeições e feedbacks recentes foram considerados.');
  }
  suggestions.slice(0, 3).forEach((suggestion) => {
    if (suggestion && suggestion.message) observacoes.push('Adaptação sugerida: ' + suggestion.message);
  });
  return Object.assign({}, safePlan, {
    observacoes,
    adaptiveNutrition: {
      enabled: true,
      score: adaptive ? adaptive.score : 0,
      confidence_level: adaptive ? adaptive.confidence_level : 'baixo',
      plan_status: adaptive ? adaptive.plan_status : 'provisório',
      missing_fields: adaptive ? adaptive.missing_fields : [],
      suggestions,
      memory_summary: {
        preferred_meal_count: memory.preferred_meal_count,
        preferred_diet_style: memory.preferred_diet_style,
        has_food_scale: memory.has_food_scale,
        budget_level: memory.budget_level,
        workout_time: memory.workout_time,
        hunger_period: memory.hunger_period,
      },
    },
  });
}

function buildDietResponse(action, normalizedInput) {
  const generation = buildDietPlanWithFallback(normalizedInput);
  const plan = decoratePlanWithAdaptiveLayer(generation.plan, normalizedInput);
  const missingFields = generation.missingFields;
  const isFallbackPlan = !!generation.generatedFromFallback;
  const message = isFallbackPlan
    ? `Plano inicial gerado com fallback seguro. Complete os dados ausentes para uma dieta mais precisa.`
    : plan.biomarkerNutritionStrategy && plan.biomarkerNutritionStrategy.enabled
      ? 'Plano alimentar gerado com biomarcadores reais e macros equivalentes TACO.'
      : plan.clinicalContext && plan.clinicalContext.mode === 'clinical'
        ? 'Plano alimentar gerado com ajustes clínicos conservadores baseados no exame mais recente.'
        : `Plano alimentar gerado com ${(plan.refeicoes || []).length} refeicoes.`;

  return {
    action,
    domain: 'diet',
    success: !isFallbackPlan,
    message,
    errorCode: isFallbackPlan ? 'DIET_INPUT_INVALID' : null,
    payload: {
      profile: normalizedInput,
      plan,
      adaptive: plan.adaptiveNutrition,
      validation: {
        missingFields,
        generatedFromFallback: isFallbackPlan,
      },
    },
  };
}

function buildDietFallbackResponse(action, normalizedInput, err) {
  const generation = buildDietPlanWithFallback(normalizedInput);
  const decoratedPlan = decoratePlanWithAdaptiveLayer(generation.plan, normalizedInput);
  const message = 'Erro ao gerar dieta principal. Aplicando versão básica segura...';
  if (err) console.error('Diet error:', err);

  return {
    action,
    domain: 'diet',
    success: false,
    fallback: true,
    message,
    errorCode: 'DIET_FALLBACK',
    payload: {
      profile: normalizedInput,
      plan: Object.assign({}, decoratedPlan, {
        failSafe: true,
        flow_state: decoratedPlan.refeicoes && decoratedPlan.refeicoes.length ? 'failsafe_renderable' : 'failsafe',
        observacoes: (Array.isArray(decoratedPlan.observacoes) ? decoratedPlan.observacoes : []).concat([
          'Revise os dados do perfil e tente novamente.',
        ]),
      }),
      adaptive: decoratedPlan.adaptiveNutrition,
      validation: {
        missingFields: generation.missingFields,
        generatedFromFallback: true,
      },
    },
  };
}

async function generateDiet(payload) {
  const normalizedInput = normalizeDietPayload(payload);

  try {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Gerar dieta pelo KRONOS central.' }],
          isDietDirect: true,
          dietProfile: normalizedInput,
          payload: normalizedInput,
        }),
      });

      if (!res.ok) {
        throw new Error('API falhou');
      }

      const data = await res.json();
      if (data && data.success === false) {
        throw new Error(data.message || 'API falhou');
      }

      return data;
    }

    return buildDietResponse('GENERATE_DIET', normalizedInput);
  } catch (err) {
    return buildDietFallbackResponse('GENERATE_DIET', normalizedInput, err);
  }
}

async function _enrichWithAIStrategy(normalizedInput) {
  const adaptiveMemory = normalizedInput.adaptivePersonalization && normalizedInput.adaptivePersonalization.memory
    ? normalizedInput.adaptivePersonalization.memory
    : {};
  const aiParams = {
    profile: normalizedInput,
    clinicalContext: normalizedInput.clinicalData,
    labContext: normalizedInput.labContext,
    biomarkerNutritionStrategy: normalizedInput.labBiomarkerStrategy,
    trainingContext: normalizedInput.contextoTreino,
    adherenceContext: normalizedInput.aderencia,
    adaptiveMemory,
    calculation: normalizedInput._calculationResult || {},
  };

  // Run both AI layers concurrently; failures in either are non-fatal
  const [aiStrategy, aiBlueprint] = await Promise.all([
    (async () => {
      try {
        const aiLayer = require('../../core/nutrition/ai_nutrition_strategy_layer');
        const result = await aiLayer.buildAIStrategy(aiParams);
        if (result) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[AI_NUTRITION_STRATEGY] Strategy applied:', result.strategyType);
          }
        } else if (process.env.NODE_ENV === 'development') {
          console.log('[DIET_FALLBACK_ENGINE] AI strategy not available — engine defaults.');
        }
        return result;
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[DIET_FALLBACK_ENGINE] AI strategy error:', err && err.message);
        }
        return null;
      }
    })(),
    (async () => {
      try {
        const orchestrator = require('../../core/nutrition/aiNutritionOrchestrator');
        const result = await orchestrator.generateAINutritionBlueprint(aiParams);
        if (result) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[AI_NUTRITION_ORCHESTRATOR] Blueprint applied:', result.strategyName);
          }
        } else if (process.env.NODE_ENV === 'development') {
          console.log('[DIET_FALLBACK_ENGINE] AI blueprint not available — engine defaults.');
        }
        return result;
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[DIET_FALLBACK_ENGINE] AI blueprint error:', err && err.message);
        }
        return null;
      }
    })(),
  ]);

  if (aiStrategy) normalizedInput.aiNutritionStrategy = aiStrategy;
  if (aiBlueprint) normalizedInput.aiNutritionBlueprint = aiBlueprint;
}

async function execute(action, payload) {
  const normalizedInput = normalizeDietPayload(payload);

  if (action === 'GENERATE_DIET' || action === 'ADJUST_DIET') {
    await _enrichWithAIStrategy(normalizedInput);
  }

  try {
    switch (action) {
      case 'GENERATE_DIET':
      case 'ADJUST_DIET':
        return buildDietResponse(action, normalizedInput);
      case 'ANALYZE_DIET':
        return {
          action,
          domain: 'diet',
          success: true,
          message: 'Analise de dieta requer dados persistidos do usuario.',
          errorCode: null,
          payload: {
            profile: normalizedInput,
            adaptive: normalizedInput.adaptivePersonalization,
            summary: {
              hasObjective: Boolean(normalizedInput.objetivo),
              hasRestrictions: normalizedInput.restricoes.length > 0,
              hasAnthropometrics: Boolean(normalizedInput.peso && normalizedInput.altura && normalizedInput.idade),
              hasRealBiomarkers: Boolean(normalizedInput.labBiomarkerStrategy && normalizedInput.labBiomarkerStrategy.biomarkersCount),
              tacoMacroSource: true,
              adaptiveScore: normalizedInput.adaptivePersonalization.score,
            },
          },
        };
      default:
        return {
          action: 'ASK_SINGLE_CLARIFICATION',
          domain: 'diet',
          success: false,
          message: 'Preciso de mais contexto para continuar com a dieta.',
          errorCode: 'DIET_ACTION_UNSUPPORTED',
          payload: {
            missing: ['objetivo', 'peso', 'altura', 'idade', 'sexo'],
          },
        };
    }
  } catch (err) {
    return buildDietFallbackResponse(action, normalizedInput, err);
  }
}

module.exports = {
  execute,
  generateDiet,
  normalizeDietPayload,
};