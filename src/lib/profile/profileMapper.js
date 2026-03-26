const {
  SEX,
  KNOWLEDGE_LEVEL,
  TRAINING_LEVEL,
  GOAL,
  EXPERIENCE_MODE,
  PHYSIOLOGICAL_PROFILE
} = require('../../types/domain');

const PT_BR_ALIAS = Object.freeze({
  sex: {
    masculino: SEX.MALE,
    homem: SEX.MALE,
    female: SEX.FEMALE,
    feminino: SEX.FEMALE,
    mulher: SEX.FEMALE,
    prefiro_nao_informar: SEX.PREFER_NOT_TO_SAY,
    prefer_not_to_say: SEX.PREFER_NOT_TO_SAY
  },
  knowledgeLevel: {
    iniciante: KNOWLEDGE_LEVEL.BEGINNER,
    intermediate: KNOWLEDGE_LEVEL.INTERMEDIATE,
    intermediario: KNOWLEDGE_LEVEL.INTERMEDIATE,
    avançado: KNOWLEDGE_LEVEL.ADVANCED,
    avancado: KNOWLEDGE_LEVEL.ADVANCED,
    tecnico: KNOWLEDGE_LEVEL.TECHNICAL,
    técnico: KNOWLEDGE_LEVEL.TECHNICAL
  },
  trainingLevel: {
    iniciante: TRAINING_LEVEL.BEGINNER,
    intermediario: TRAINING_LEVEL.INTERMEDIATE,
    intermediário: TRAINING_LEVEL.INTERMEDIATE,
    avancado: TRAINING_LEVEL.ADVANCED,
    avançado: TRAINING_LEVEL.ADVANCED,
    atleta: TRAINING_LEVEL.ATHLETE
  },
  goal: {
    hipertrofia: GOAL.HYPERTROPHY,
    emagrecimento: GOAL.FAT_LOSS,
    perda_de_gordura: GOAL.FAT_LOSS,
    forca: GOAL.STRENGTH,
    força: GOAL.STRENGTH,
    resistencia: GOAL.ENDURANCE,
    resistência: GOAL.ENDURANCE,
    saude: GOAL.HEALTH,
    saúde: GOAL.HEALTH
  },
  experienceMode: {
    simples: EXPERIENCE_MODE.SIMPLE,
    simple: EXPERIENCE_MODE.SIMPLE,
    avancado: EXPERIENCE_MODE.ADVANCED,
    avançado: EXPERIENCE_MODE.ADVANCED,
    advanced: EXPERIENCE_MODE.ADVANCED
  },
  physiologicalProfile: {
    male_typical: PHYSIOLOGICAL_PROFILE.MALE_TYPICAL,
    female_typical: PHYSIOLOGICAL_PROFILE.FEMALE_TYPICAL,
    neutral_adaptive: PHYSIOLOGICAL_PROFILE.NEUTRAL_ADAPTIVE
  }
});

function normalizeAlias(map, value, fallback) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return map[raw.toLowerCase()] || raw.toUpperCase();
}

function normalizeProfileInput(input = {}) {
  return {
    ...input,
    sex: normalizeAlias(PT_BR_ALIAS.sex, input.sex, SEX.PREFER_NOT_TO_SAY),
    knowledgeLevel: normalizeAlias(PT_BR_ALIAS.knowledgeLevel, input.knowledgeLevel, KNOWLEDGE_LEVEL.BEGINNER),
    trainingLevel: normalizeAlias(PT_BR_ALIAS.trainingLevel, input.trainingLevel, TRAINING_LEVEL.BEGINNER),
    goal: normalizeAlias(PT_BR_ALIAS.goal, input.goal, GOAL.HEALTH),
    experienceMode: normalizeAlias(PT_BR_ALIAS.experienceMode, input.experienceMode, EXPERIENCE_MODE.SIMPLE),
    physiologicalProfile: normalizeAlias(PT_BR_ALIAS.physiologicalProfile, input.physiologicalProfile, null)
  };
}

module.exports = { normalizeProfileInput };
