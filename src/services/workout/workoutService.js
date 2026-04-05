const workoutBuilder = require('../../server/apihelpers/_workoutBuilder');

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

function toStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeWorkoutPayload(payload) {
  const safePayload = normalizeObject(payload);
  const profile = normalizeObject(safePayload.profile);
  const context = normalizeObject(safePayload.context);

  const dias = pickNumber(
    safePayload.days_per_week,
    safePayload.dias,
    safePayload.days,
    profile.days_per_week,
    profile.dias,
    context.days_per_week,
  );

  return {
    objetivo: pickString(safePayload.objective, safePayload.objetivo, profile.objective, profile.objetivo, context.objective),
    nivel: pickString(safePayload.level, safePayload.nivel, profile.level, profile.nivel, context.level),
    dias: dias ? String(Math.max(1, Math.min(6, dias))) : undefined,
    tempo: pickString(safePayload.tempo, safePayload.sessionLength, profile.tempo, profile.sessionLength, context.tempo, context.sessionLength),
    equipamentos: pickString(safePayload.environment, safePayload.equipamentos, safePayload.equipment, profile.environment, profile.equipamentos, context.environment),
    limitacoes: pickString(
      safePayload.limitacoes,
      safePayload.notes,
      toStringArray(safePayload.restrictions).join(', '),
      toStringArray(profile.restrictions).join(', '),
      context.limitacoes,
    ) || 'nao',
  };
}

function getMissingCriticalFields(normalizedPayload) {
  const missing = [];
  if (!normalizedPayload.objetivo) missing.push('objetivo');
  if (!normalizedPayload.nivel) missing.push('nivel');
  if (!normalizedPayload.dias) missing.push('dias');
  if (!normalizedPayload.equipamentos) missing.push('equipamentos');
  return missing;
}

function buildWorkoutResult(action, normalizedPayload) {
  const plan = workoutBuilder.buildWorkoutPlan(normalizedPayload);
  return {
    action,
    domain: 'workout',
    success: true,
    message: `Treino gerado com ${plan.treinos.length} sessão(ões).`,
    errorCode: null,
    payload: {
      profile: normalizedPayload,
      plan,
      validation: {
        missingFields: getMissingCriticalFields(normalizedPayload),
      },
    },
  };
}

async function execute(action, payload) {
  const normalizedPayload = normalizeWorkoutPayload(payload);

  switch (action) {
    case 'GENERATE_WORKOUT':
    case 'ADJUST_WORKOUT':
      return buildWorkoutResult(action, normalizedPayload);
    case 'ANALYZE_WORKOUT':
      return {
        action,
        domain: 'workout',
        success: true,
        message: 'Análise de treino requer histórico consolidado do usuário.',
        errorCode: null,
        payload: {
          profile: normalizedPayload,
          summary: {
            hasObjective: Boolean(normalizedPayload.objetivo),
            hasLevel: Boolean(normalizedPayload.nivel),
            hasFrequency: Boolean(normalizedPayload.dias),
            hasLimitations: Boolean(normalizedPayload.limitacoes && normalizedPayload.limitacoes !== 'nao'),
          },
        },
      };
    default:
      return {
        action: 'ASK_SINGLE_CLARIFICATION',
        domain: 'workout',
        success: false,
        message: 'Preciso de mais contexto para continuar com o treino.',
        errorCode: 'WORKOUT_ACTION_UNSUPPORTED',
        payload: {
          missing: ['objetivo', 'nivel', 'dias', 'equipamentos'],
        },
      };
  }
}

module.exports = {
  execute,
  normalizeWorkoutPayload,
};
