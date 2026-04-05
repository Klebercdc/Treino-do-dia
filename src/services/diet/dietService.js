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
    safePayload.contextoTreino || safePayload.trainingContext || context.contextoTreino || context.trainingContext,
  );
  const healthContext = normalizeObject(
    safePayload.saude || safePayload.healthContext || context.saude || context.healthContext,
  );
  const nutritionGoals = normalizeObject(
    safePayload.nutritionGoals || safePayload.goals || profile.nutritionGoals || context.nutritionGoals,
  );
  const supabaseSnapshot = normalizeObject(
    safePayload.supabaseSnapshot || profile.supabaseSnapshot || context.supabaseSnapshot,
  );

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
      frequencia: pickString(trainingContext.frequencia, trainingContext.frequency),
      duracao: pickString(trainingContext.duracao, trainingContext.duration),
      tipo: pickString(trainingContext.tipo, trainingContext.type),
    },
    saude: {
      patologia: pickString(healthContext.patologia, healthContext.pathology),
      medicamentos: pickString(healthContext.medicamentos, healthContext.medications),
      sono: pickString(healthContext.sono, healthContext.sleep),
      estresse: pickString(healthContext.estresse, healthContext.stress),
    },
    nutritionGoals: {
      calories_target: pickNumber(nutritionGoals.calories_target, nutritionGoals.caloriesTarget),
      protein_g: pickNumber(nutritionGoals.protein_g, nutritionGoals.proteinTarget),
      carbs_g: pickNumber(nutritionGoals.carbs_g, nutritionGoals.carbsTarget),
      fat_g: pickNumber(nutritionGoals.fat_g, nutritionGoals.fatTarget),
    },
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

function buildDietResponse(action, normalizedInput) {
  const plan = dietCompat.buildDietPlan(normalizedInput);
  const missingFields = getMissingCriticalFields(normalizedInput);
  const message = plan.failSafe
    ? `Dados insuficientes para montar a dieta com segurança. ${String((plan.limitedOrientation && plan.limitedOrientation.orientacao) || 'Revise sexo, idade, peso e altura.')}`
    : `Plano alimentar gerado com ${plan.refeicoes.length} refeicoes.`;

  return {
    action,
    domain: 'diet',
    success: !plan.failSafe,
    message,
    errorCode: plan.failSafe ? 'DIET_INPUT_INVALID' : null,
    payload: {
      profile: normalizedInput,
      plan,
      validation: {
        missingFields,
      },
    },
  };
}

function buildDietFallbackResponse(action, normalizedInput, err) {
  const message = 'Erro ao gerar dieta. Gerando versão básica...';
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
      plan: {
        failSafe: true,
        flow_state: 'failsafe',
        limitedOrientation: {
          orientacao: message,
        },
        observacoes: [
          'Revise os dados do perfil e tente novamente.',
        ],
        refeicoes: [],
      },
      validation: {
        missingFields: getMissingCriticalFields(normalizedInput),
      },
    },
  };
}

async function generateDiet(payload) {
  const normalizedInput = normalizeDietPayload(payload);

  try {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      const res = await fetch('/api/kronia/diet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GENERATE_DIET',
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
