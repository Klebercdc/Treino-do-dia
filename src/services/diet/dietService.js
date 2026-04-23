const dietCompat = require('../../server/apihelpers/_diet');
const { buildMasterContext } = require('../../core/nutrition/diet_context_master');
const { buildTrainingContext, buildAdherenceContext } = require('../../core/nutrition/diet_context_training');
const { buildClinicalContext } = require('../../core/nutrition/diet_context_clinical');

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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

function normalizeDietPayload(payload) {
  const master = buildMasterContext(payload);
  const training = buildTrainingContext(payload);
  const adherence = buildAdherenceContext(payload);
  const clinical = buildClinicalContext(payload);

  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const context = normalizeObject(safePayload.context);
  const profile = normalizeObject(safePayload.profile);
  const intakeSnapshot = normalizeObject(safePayload.intakeSnapshot || context.intakeSnapshot);
  const nutritionFlowSelections = normalizeObject(safePayload.nutritionFlowSelections || context.nutritionFlowSelections);
  const supabaseSnapshot = normalizeObject(safePayload.supabaseSnapshot || profile.supabaseSnapshot || context.supabaseSnapshot);

  return {
    objetivo: master.objetivo,
    sexo: master.sexo,
    idade: master.idade,
    peso: master.peso,
    altura: master.altura,
    rotina: master.rotina,
    nivelAtividade: master.nivelAtividade,
    refeicoesPorDia: master.refeicoesPorDia,
    restricoes: master.restricoes,
    preferencias: master.preferencias,
    alimentosEvitar: master.alimentosEvitar,
    suplementos: master.suplementos,
    observacoes: master.observacoes,
    gorduraCorporal: master.gorduraCorporal,
    biotipo: master.biotipo,
    padraoAlimentar: master.padraoAlimentar,
    contextoTreino: training,
    saude: clinical.saude,
    aderencia: adherence,
    nutritionGoals: master.nutritionGoals,
    labContext: clinical.labContext,
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
