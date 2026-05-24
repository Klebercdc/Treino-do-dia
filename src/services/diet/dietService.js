const dietCompat = require('../../server/apihelpers/_diet');
const { buildMasterContext } = require('../../core/nutrition/diet_context_master');
const { buildTrainingContext, buildAdherenceContext } = require('../../core/nutrition/diet_context_training');
const { buildClinicalContext } = require('../../core/nutrition/diet_context_clinical');
const adaptiveNutrition = require('../../lib/nutrition/adaptiveNutrition');

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
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
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
      labContext: normalized.labContext ? { mode: normalized.labContext.mode, clinicalFlags: normalized.labContext.clinicalFlags } : null,
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

function decoratePlanWithAdaptiveLayer(plan, normalizedInput) {
  const safePlan = plan && typeof plan === 'object' ? plan : {};
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
