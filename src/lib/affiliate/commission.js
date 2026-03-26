function calculateMonthlyTier(monthlySalesCount) {
  if (monthlySalesCount >= 30) return { tier: 'TIER_3', rate: 0.5 };
  if (monthlySalesCount >= 10) return { tier: 'TIER_2', rate: 0.4 };
  return { tier: 'TIER_1', rate: 0.3 };
}

function calculateDirectCommission({ grossAmount, monthlySalesCount, saleConfirmed = true }) {
  if (!saleConfirmed) return { tier: 'TIER_0', rate: 0, amount: 0 };
  const { tier, rate } = calculateMonthlyTier(monthlySalesCount);
  return { tier, rate, amount: Number((grossAmount * rate).toFixed(2)) };
}

function calculateRecurringCommission(grossAmount, saleConfirmed = true) {
  if (!saleConfirmed) return { rate: 0, amount: 0 };
  const rate = 0.3;
  return { rate, amount: Number((grossAmount * rate).toFixed(2)) };
}

function calculateSecondLevelCommission(grossAmount, saleConfirmed = true) {
  if (!saleConfirmed) return { rate: 0, amount: 0 };
  const rate = 0.05;
  return { rate, amount: Number((grossAmount * rate).toFixed(2)) };
}

function buildAffiliateReference({ referrerUserId, referredUserId, level = 1 }) {
  if (level > 2) throw new Error('Sistema de afiliados suporta no máximo 2 níveis.');
  return {
    referrer_user_id: referrerUserId,
    referred_user_id: referredUserId,
    level,
    created_at: new Date().toISOString()
  };
}

function buildCommissionRecord({ saleId, buyerUserId, affiliateUserId, type, amount, rate, level = 1 }) {
  return {
    sale_id: saleId,
    buyer_user_id: buyerUserId,
    affiliate_user_id: affiliateUserId,
    commission_type: type,
    level,
    rate,
    amount,
    status: 'pending',
    created_at: new Date().toISOString()
  };
}

module.exports = {
  calculateMonthlyTier,
  calculateDirectCommission,
  calculateRecurringCommission,
  calculateSecondLevelCommission,
  buildAffiliateReference,
  buildCommissionRecord
};
