const ACTION_TABLE = {
  GREETING: { action: 'LOCAL_GREETING_REPLY', response_mode: 'short' },
  WORKOUT_CREATE: { action: 'GENERATE_WORKOUT', response_mode: 'execution' },
  WORKOUT_ADJUST: { action: 'ADJUST_WORKOUT', response_mode: 'execution' },
  WORKOUT_ANALYZE: { action: 'ANALYZE_WORKOUT', response_mode: 'standard' },
  DIET_CREATE: { action: 'GENERATE_DIET', response_mode: 'execution' },
  DIET_ADJUST: { action: 'ADJUST_DIET', response_mode: 'execution' },
  DIET_ANALYZE: { action: 'ANALYZE_DIET', response_mode: 'standard' },
  SUPPLEMENT_PROTOCOL: { action: 'GENERATE_SUPPLEMENT_PROTOCOL', response_mode: 'execution' },
  PROGRESS_REVIEW: { action: 'REVIEW_PROGRESS', response_mode: 'standard' },
  RECOVERY_SUPPORT: { action: 'GENERATE_RECOVERY_SUPPORT', response_mode: 'standard' },
  ROUTINE_ORGANIZATION: { action: 'ORGANIZE_ROUTINE', response_mode: 'standard' },
  PLAN_QUESTION: { action: 'RESOLVE_PLAN_QUESTION', response_mode: 'short' },
  BILLING_QUESTION: { action: 'RESOLVE_BILLING_QUESTION', response_mode: 'short' },
  OTHER: { action: 'ASK_SINGLE_CLARIFICATION', response_mode: 'short' },
};

function decideAction(classification, context = {}) {
  const decision = ACTION_TABLE[classification.intent] || ACTION_TABLE.OTHER;
  const shouldClarify = Boolean(
    classification.needs_clarification ||
      classification.confidence < 0.75 ||
      context.missingCriticalData === true,
  );

  if (shouldClarify) {
    return {
      action: 'ASK_SINGLE_CLARIFICATION',
      response_mode: 'short',
      domain: classification.domain,
      requires_plan_gate: false,
    };
  }

  return {
    action: decision.action,
    response_mode: decision.response_mode,
    domain: classification.domain,
    requires_plan_gate: !['GREETING', 'PLAN_QUESTION', 'BILLING_QUESTION'].includes(classification.intent),
  };
}

module.exports = {
  ACTION_TABLE,
  decideAction,
};
