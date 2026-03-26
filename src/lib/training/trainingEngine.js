const {
  AGE_GROUP,
  TRAINING_LEVEL,
  PHYSIOLOGICAL_PROFILE,
  GOAL,
  KNOWLEDGE_LEVEL
} = require('../../types/domain');

function createBaseTrainingConfig() {
  return {
    intensityStrategy: 'moderate_progressive',
    volumeStrategy: 'moderate_progressive',
    repetitionRange: '6-12',
    rest: '90-150s',
    progression: 'double_progression',
    complexity: 'medium',
    failureUse: 'isolations_only_last_set_optional',
    weeklySetTarget: '10-16 sets / muscle / week',
    aiNotes: []
  };
}

function applyAgeRules(cfg, ageGroup) {
  if (ageGroup === AGE_GROUP.TEEN) {
    cfg.intensityStrategy = 'technique_first_low_to_moderate_intensity';
    cfg.volumeStrategy = 'moderate_with_strict_technique';
    cfg.failureUse = 'avoid_failure';
    cfg.aiNotes.push('Adolescente: priorizar técnica, segurança e progressão conservadora.');
  }

  if (ageGroup === AGE_GROUP.MATURE || ageGroup === AGE_GROUP.SENIOR) {
    cfg.rest = '120-180s';
    cfg.volumeStrategy = 'fatigue_managed_moderate_volume';
    cfg.progression = 'autoregulated_progression';
    cfg.aiNotes.push('Mature/Senior: controlar fadiga e ampliar janela de recuperação.');
  }
}

function applyPhysiologyRules(cfg, physiologicalProfile) {
  if (physiologicalProfile === PHYSIOLOGICAL_PROFILE.MALE_TYPICAL) {
    cfg.intensityStrategy = 'moderate_to_high_load_focus';
    cfg.aiNotes.push('Male typical: ponto de partida com maior ênfase em carga externa.');
  } else if (physiologicalProfile === PHYSIOLOGICAL_PROFILE.FEMALE_TYPICAL) {
    cfg.volumeStrategy = 'moderate_to_high_volume';
    cfg.repetitionRange = '8-15';
    cfg.aiNotes.push('Female typical: ponto de partida com maior tolerância de volume/repetições.');
  } else {
    cfg.aiNotes.push('Neutral adaptive: ajustar com base em resposta individual do usuário.');
  }
}

function applyExperienceRules(cfg, trainingLevel, knowledgeLevel) {
  if (trainingLevel === TRAINING_LEVEL.BEGINNER) {
    cfg.complexity = 'low';
    cfg.progression = 'linear_technique_priority';
    cfg.weeklySetTarget = '8-12 sets / muscle / week';
  }

  if (trainingLevel === TRAINING_LEVEL.ADVANCED || trainingLevel === TRAINING_LEVEL.ATHLETE) {
    cfg.complexity = 'high';
    cfg.progression = 'periodized_with_autoregulation';
    cfg.weeklySetTarget = '12-20 sets / muscle / week';
    cfg.aiNotes.push('Avançado/Atleta: usar histórico e feedback para ajuste fino.');
  }

  if (knowledgeLevel === KNOWLEDGE_LEVEL.BEGINNER) {
    cfg.aiNotes.push('Comunicação sugerida: modo simples (sem jargões de treino).');
  }
}

function applyGoalRules(cfg, goal) {
  if (goal === GOAL.STRENGTH) {
    cfg.repetitionRange = '3-6';
    cfg.rest = '150-240s';
  } else if (goal === GOAL.ENDURANCE) {
    cfg.repetitionRange = '12-20';
    cfg.rest = '45-90s';
  }
}

function generateTrainingConfig(input) {
  const cfg = createBaseTrainingConfig();
  applyAgeRules(cfg, input.ageGroup);
  applyPhysiologyRules(cfg, input.physiologicalProfile);
  applyExperienceRules(cfg, input.trainingLevel, input.knowledgeLevel);
  applyGoalRules(cfg, input.goal);
  return cfg;
}

module.exports = { generateTrainingConfig };
