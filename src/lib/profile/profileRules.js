const {
  SEX,
  AGE_GROUP,
  PHYSIOLOGICAL_PROFILE,
  KNOWLEDGE_LEVEL,
  TRAINING_LEVEL,
  EXPERIENCE_MODE,
  isEnumValue
} = require('../../types/domain');

function classifyAgeGroup(age) {
  const numericAge = Number(age);
  if (!Number.isFinite(numericAge) || numericAge < 0) return AGE_GROUP.ADULT;
  if (numericAge < 18) return AGE_GROUP.TEEN;
  if (numericAge <= 39) return AGE_GROUP.ADULT;
  if (numericAge <= 59) return AGE_GROUP.MATURE;
  return AGE_GROUP.SENIOR;
}

function resolvePhysiologicalProfile(sexInformed) {
  if (sexInformed === SEX.MALE) return PHYSIOLOGICAL_PROFILE.MALE_TYPICAL;
  if (sexInformed === SEX.FEMALE) return PHYSIOLOGICAL_PROFILE.FEMALE_TYPICAL;
  return PHYSIOLOGICAL_PROFILE.NEUTRAL_ADAPTIVE;
}

function shouldUseSimpleLanguage({ knowledgeLevel, trainingLevel, understandsTechnicalTerms }) {
  if (understandsTechnicalTerms === false) return true;
  if (knowledgeLevel === KNOWLEDGE_LEVEL.BEGINNER) return true;
  return trainingLevel === TRAINING_LEVEL.BEGINNER;
}

function resolveExperienceMode({ preferredMode, knowledgeLevel, trainingLevel, understandsTechnicalTerms }) {
  if (preferredMode === EXPERIENCE_MODE.ADVANCED) return EXPERIENCE_MODE.ADVANCED;
  return shouldUseSimpleLanguage({ knowledgeLevel, trainingLevel, understandsTechnicalTerms })
    ? EXPERIENCE_MODE.SIMPLE
    : EXPERIENCE_MODE.ADVANCED;
}

function normalizeProfileInput(input = {}) {
  return {
    age: Number(input.age),
    sexInformed: isEnumValue(SEX, input.sexInformed) ? input.sexInformed : SEX.PREFER_NOT_TO_SAY,
    knowledgeLevel: isEnumValue(KNOWLEDGE_LEVEL, input.knowledgeLevel) ? input.knowledgeLevel : KNOWLEDGE_LEVEL.BEGINNER,
    trainingLevel: isEnumValue(TRAINING_LEVEL, input.trainingLevel) ? input.trainingLevel : TRAINING_LEVEL.BEGINNER,
    understandsTechnicalTerms: input.understandsTechnicalTerms === true,
    preferredMode: isEnumValue(EXPERIENCE_MODE, input.preferredMode) ? input.preferredMode : EXPERIENCE_MODE.SIMPLE,
    goal: input.goal,
    physiologicalProfile: isEnumValue(PHYSIOLOGICAL_PROFILE, input.physiologicalProfile)
      ? input.physiologicalProfile
      : null
  };
}

module.exports = {
  classifyAgeGroup,
  resolvePhysiologicalProfile,
  shouldUseSimpleLanguage,
  resolveExperienceMode,
  normalizeProfileInput
};
