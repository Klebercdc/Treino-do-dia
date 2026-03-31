function estimateCost({ action, response_mode }) {
  const baseByMode = { short: 1, standard: 3, execution: 6, deep: 12 };
  const multiplier = action && action.includes('ANALYZE') ? 1.5 : 1;
  const units = Math.ceil((baseByMode[response_mode] || 2) * multiplier);

  return {
    estimated_units: units,
    estimated_cost_usd: Number((units * 0.0012).toFixed(4)),
  };
}

module.exports = { estimateCost };
