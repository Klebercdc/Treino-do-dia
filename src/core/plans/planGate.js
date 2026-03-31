const { FEATURE_MATRIX } = require('./featureMatrix');

function planGate({ plan = 'FREE', action }) {
  const normalizedPlan = String(plan || 'FREE').toUpperCase();
  const planFeatures = FEATURE_MATRIX[normalizedPlan] || FEATURE_MATRIX.FREE;
  const allowed = Boolean(planFeatures[action]);

  return {
    allowed,
    reason: allowed ? null : `Feature ${action} requires a higher plan.`,
    plan: normalizedPlan,
  };
}

module.exports = { planGate };
