const dietCompat = require('../../server/apihelpers/_diet');

function pickNumber() {
  for (let index = 0; index < arguments.length; index += 1) {
    const value = arguments[index];
    if (value === undefined || value === null || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
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

function toStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeDietPayload(payload) {
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const context = normalizeObject(safePayload.context);
  const profile = normalizeObject(safePayload.profile);
  const trainingContext = normalizeObject(
    safePayload.contextoTreino || safePayload.trainingContext || safePayload.trainingSnapshot || context.contextoTreino || context.trainingContext || context.trainingSnapshot,
  );
  const healthContext = normalizeObject(
    safePayload.saude || safePayload.healthContext || context.saude || context.healthContext,
  );
  const adherenceContext = normalizeObject(
    safePayload.aderencia || safePayload.adherenceContext || context.aderencia || context.adherenceContext,
  );
  const intakeSnapshot = normalizeObject(
    safePayload.intakeSnapshot || context.intakeSnapshot,
  );
  const intakeTraining = normalizeObject(intakeSnapshot.treino);
  const nutritionFlowSelections = normalizeObject(
    safePayload.nutritionFlowSelections || context.nutritionFlowSelections,
  );
  const nutritionGoals = normalizeObject(
    safePayload.nutritionGoals || safePayload.goals || profile.nutritionGoals || context.nutritionGoals,
  );
  const labContext = normalizeObject(
    safePayload.labContext || safePayload.labs || profile.labContext || context.labContext || healthContext.labContext,
  );
  const supabaseSnapshot = normalizeObject(
    safePayload.supabaseSnapshot || profile.supabaseSnapshot || context.supabaseSnapshot,
  );
  const latestLabReport = normalizeObject(supabaseSnapshot.latestLabReport);
  const effectiveLabContext = Object.keys(labContext).length ? labContext : latestLabReport;

  return {
    objetivo: pickString(safePayload.objetivo, safePayload.objective, profile.objetivo, profile.objective, context.objetivo, context.objective),
    sexo: pickString(safePayload.sexo, safePayload.sex, profile.sexo, profile.sex, context.sexo, context.sex),
    idade: pickNumber(safePayload.idade, safePayload.age, profile.idade, profile.age, context.idade, context.age),
    peso: pickNumber(safePayload.peso, safePayload.pesoKg, safePayload.weight, safePayload.weightKg, profile.peso, profile.pesoKg, profile.weight, profile.weightKg, context.peso, context.pesoKg, context.weight, context.weightKg),
    altura: pickNumber(safePayload.altura, safePayload.alturaCm, safePayload.height, safePayload.heightCm, profile.altura, profile.alturaCm, profile.height, profile.heightCm, context.altura, context.alturaCm, context.height, context.heightCm),
    rotina: pickString(safePayload.rotina, safePayload.routine, profile.rotina, profile.routine, context.rotina, context.routine),
    nivelAtividade: pickString(safePayload.nivelAtividade, safePayload.activityLevel, profile.nivelAtividade, profile.activityLevel, context.nivelAtividade, context.activityLevel),
    refeicoesPorDia: pickNumber(safePayload.refeicoesPorDia, safePayload.meals, safePayload.mealCount, profile.refeicoesPorDia, profile.meals, context.refeicoesPorDia, context.meals),
    restricoes: toStringArray(safePayload.restricoes || safePayload.restrictions || profile.restricoes || context.restricoes),
    preferencias: toStringArray(safePayload.preferencias || safePayload.preferences || profile.preferencias || context.preferencias),
    alimentosEvitar: toStringArray(safePayload.alimentosEvitar || safePayload.dislikes || profile.alimentosEvitar || profile.dislikes || context.alimentosEvitar),
    suplementos: toStringArray(safePayload.suplementos || safePayload.supplements || profile.suplementos || context.suplementos),
    observacoes: pickString(safePayload.observacoes, safePayload.notes, profile.observacoes, context.observacoes),
    gorduraCorporal: pickNumber(safePayload.gorduraCorporal, safePayload.bodyFatPercent, profile.gorduraCorporal, profile.bodyFatPercent, context.gorduraCorporal),
    biotipo: pickString(safePayload.biotipo, safePayload.somatotype, profile.biotipo, profile.somatotype, context.biotipo),
    padraoAlimentar: pickString(safePayload.padraoAlimentar, safePayload.dietaryPattern, profile.padraoAlimentar, profile.dietaryPattern, context.padraoAlimentar),
    contextoTreino: {
      frequencia: pickString(trainingContext.frequencia, trainingContext.frequency, intakeTraining.frequencia),
      duracao: pickString(trainingContext.duracao, trainingContext.duration),
      tipo: pickString(trainingContext.tipo, trainingContext.type),
      fadiga: pickNumber(trainingContext.fadiga, trainingContext.fatigue, adherenceContext.fadiga, intakeTraining.fadiga),
      tendenciaForca: pickString(trainingContext.tendenciaForca, trainingContext.strengthTrend, adherenceContext.tendenciaForca, intakeTraining.tendenciaForca),
      prioridadeMetabolica: pickString(trainingContext.prioridadeMetabolica, trainingContext.priority, adherenceContext.prioridadeMetabolica, intakeTraining.prioridadeMetabolica),
    },
    saude: {
      patologia: pickString(healthContext.patologia, healthContext.pathology),
      medicamentos: pickString(healthContext.medicamentos, healthContext.medications),
      sono: pickString(healthContext.sono, healthContext.sleep),
      estresse: pickString(healthContext.estresse, healthContext.stress),
    },
    aderencia: {
      modoAjuste: pickString(adherenceContext.modoAjuste, adherenceContext.adjustmentMode),
      praticidade: pickString(adherenceContext.praticidade, adherenceContext.practicality),
      neat: pickString(adherenceContext.neat),
      fadiga: pickNumber(adherenceContext.fadiga, trainingContext.fadiga, trainingContext.fatigue, intakeTraining.fadiga),
      tendenciaForca: pickString(adherenceContext.tendenciaForca, trainingContext.tendenciaForca, trainingContext.strengthTrend, intakeTraining.tendenciaForca),
      prioridadeMetabolica: pickString(adherenceContext.prioridadeMetabolica, trainingContext.prioridadeMetabolica, trainingContext.priority, intakeTraining.prioridadeMetabolica),
      horarioTreino: pickString(adherenceContext.horarioTreino, intakeTraining.periodo),
    },
    nutritionGoals: {
      calories_target: pickNumber(nutritionGoals.calories_target, nutritionGoals.caloriesTarget),
      protein_g: pickNumber(nutritionGoals.protein_g, nutritionGoals.proteinTarget),
      carbs_g: pickNumber(nutritionGoals.carbs_g, nutritionGoals.carbsTarget),
      fat_g: pickNumber(nutritionGoals.fat_g, nutritionGoals.fatTarget),
    },
    labContext: Object.keys(effectiveLabContext).length ? effectiveLabContext : null,
    intakeSnapshot: Object.keys(intakeSnapshot).length ? intakeSnapshot : null,
    nutritionFlowSelections: Object.keys(nutritionFlowSelections).length ? nutritionFlowSelections : null,
    supabaseSnapshot,
  };
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

function buildDietResponse(action, normalizedInput) {
  const generation = buildDietPlanWithFallback(normalizedInput);
  const plan = generation.plan;
  const missingFields = generation.missingFields;
  const isFallbackPlan = !!generation.generatedFromFallback;
  const message = isFallbackPlan
    ? `Plano inicial gerado com fallback seguro. Complete os dados ausentes para uma dieta mais precisa.`
    : plan.clinicalContext && plan.clinicalContext.mode === 'clinical'
      ? 'Plano alimentar gerado com ajustes clínicos conservadores baseados no exame mais recente.'
      : `Plano alimentar gerado com ${plan.refeicoes.length} refeicoes.`;

  return {
    action,
    domain: 'diet',
    success: !isFallbackPlan,
    message,
    errorCode: isFallbackPlan ? 'DIET_INPUT_INVALID' : null,
    payload: {
      profile: normalizedInput,
      plan,
      validation: {
        missingFields,
        generatedFromFallback: isFallbackPlan,
      },
    },
  };
}

function buildDietFallbackResponse(action, normalizedInput, err) {
  const generation = buildDietPlanWithFallback(normalizedInput);
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
      plan: Object.assign({}, generation.plan, {
        failSafe: true,
        flow_state: generation.plan.refeicoes && generation.plan.refeicoes.length ? 'failsafe_renderable' : 'failsafe',
        observacoes: (Array.isArray(generation.plan.observacoes) ? generation.plan.observacoes : []).concat([
          'Revise os dados do perfil e tente novamente.',
        ]),
      }),
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

async function execute(action, payload) {
  const normalizedInput = normalizeDietPayload(payload);

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
            summary: {
              hasObjective: Boolean(normalizedInput.objetivo),
              hasRestrictions: normalizedInput.restricoes.length > 0,
              hasAnthropometrics: Boolean(normalizedInput.peso && normalizedInput.altura && normalizedInput.idade),
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
