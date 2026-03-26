const {
  classifyAgeGroup,
  resolvePhysiologicalProfile,
  resolveExperienceMode,
  normalizeProfileInput
} = require('./profileRules');

function buildUserProfile(input) {
  const normalized = normalizeProfileInput(input);
  const ageGroup = classifyAgeGroup(normalized.age);

  return {
    ...normalized,
    ageGroup,
    physiologicalProfile: normalized.physiologicalProfile || resolvePhysiologicalProfile(normalized.sexInformed),
    experienceMode: resolveExperienceMode(normalized)
  };
}

module.exports = { buildUserProfile };
