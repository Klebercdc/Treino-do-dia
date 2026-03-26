const { PLAN } = require('../../types/domain');

const DB_TO_CANONICAL_PLAN = Object.freeze({
  free: PLAN.FREE,
  pro: PLAN.PRO,
  ultra: PLAN.ULTRA,
  trial: PLAN.TRIAL_ULTRA_7_DAYS,
  trial_ultra_7_days: PLAN.TRIAL_ULTRA_7_DAYS
});

const FEATURE_MATRIX = Object.freeze({
  [PLAN.FREE]: {
    workout_manual_logging: true,
    history_basic: true,
    calculator_basic: true,
    workout_manual_insert: true,
    ai_training: false,
    ai_diet: false,
    ai_chat: false,
    transforms: false,
    pdf_premium: false,
    analysis_premium: false
  },
  [PLAN.PRO]: {
    workout_manual_logging: true,
    history_basic: true,
    calculator_basic: true,
    workout_manual_insert: true,
    ai_training: true,
    ai_diet: true,
    ai_chat: true,
    transforms: false,
    pdf_premium: false,
    analysis_premium: 'intermediate'
  },
  [PLAN.ULTRA]: {
    workout_manual_logging: true,
    history_basic: true,
    calculator_basic: true,
    workout_manual_insert: true,
    ai_training: true,
    ai_diet: true,
    ai_chat: true,
    transforms: true,
    pdf_premium: true,
    analysis_premium: 'advanced'
  }
});

function toCanonicalPlan(dbPlan) {
  return DB_TO_CANONICAL_PLAN[String(dbPlan || '').toLowerCase()] || PLAN.FREE;
}

function toDbPlan(canonicalPlan) {
  if (canonicalPlan === PLAN.TRIAL_ULTRA_7_DAYS) return 'trial_ultra_7_days';
  return String(canonicalPlan || PLAN.FREE).toLowerCase();
}

function isTrialPlan(canonicalPlan) {
  return canonicalPlan === PLAN.TRIAL_ULTRA_7_DAYS;
}

function isUnlimitedPlan(canonicalPlan) {
  return canonicalPlan === PLAN.PRO || canonicalPlan === PLAN.ULTRA;
}

function isTrialExpired(trialStartedAt, trialDays) {
  if (!trialStartedAt) return true;
  var startedAt = new Date(trialStartedAt);
  if (Number.isNaN(startedAt.getTime())) return true;
  return (Date.now() - startedAt.getTime()) > trialDays * 86400000;
}

function resolvePlanAfterTrial({ hasPro, hasUltra }) {
  if (hasUltra) return PLAN.ULTRA;
  if (hasPro) return PLAN.PRO;
  return PLAN.FREE;
}

function getQuotaLimit(canonicalPlan, limits) {
  if (isTrialPlan(canonicalPlan)) return limits.trial;
  if (isUnlimitedPlan(canonicalPlan)) return Infinity;
  return limits.free;
}

function getPlanAccess(canonicalPlan) {
  if (canonicalPlan === PLAN.TRIAL_ULTRA_7_DAYS) {
    return {
      plan: PLAN.TRIAL_ULTRA_7_DAYS,
      features: FEATURE_MATRIX[PLAN.ULTRA]
    };
  }

  return {
    plan: canonicalPlan,
    features: FEATURE_MATRIX[canonicalPlan] || FEATURE_MATRIX[PLAN.FREE]
  };
}

function canAccessFeature(canonicalPlan, featureKey) {
  var access = getPlanAccess(canonicalPlan);
  return Boolean(access.features[featureKey]);
}

module.exports = {
  FEATURE_MATRIX,
  toCanonicalPlan,
  toDbPlan,
  isTrialPlan,
  isUnlimitedPlan,
  isTrialExpired,
  resolvePlanAfterTrial,
  getQuotaLimit,
  getPlanAccess,
  canAccessFeature
};
