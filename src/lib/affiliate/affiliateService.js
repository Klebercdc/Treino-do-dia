const {
  calculateDirectCommission,
  calculateRecurringCommission,
  calculateSecondLevelCommission,
  buildCommissionRecord
} = require('./commission');

function getMonthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function buildCommissionBundle({
  saleId,
  buyerUserId,
  level1AffiliateId,
  level2AffiliateId,
  grossAmount,
  monthlySalesCount,
  recurring = false,
  saleConfirmed = true
}) {
  const records = [];

  if (level1AffiliateId) {
    const direct = recurring
      ? calculateRecurringCommission(grossAmount, saleConfirmed)
      : calculateDirectCommission({ grossAmount, monthlySalesCount, saleConfirmed });

    if (direct.amount > 0) {
      records.push(buildCommissionRecord({
        saleId,
        buyerUserId,
        affiliateUserId: level1AffiliateId,
        type: recurring ? 'recurring' : 'direct',
        amount: direct.amount,
        rate: direct.rate,
        level: 1
      }));
    }
  }

  if (level2AffiliateId) {
    const second = calculateSecondLevelCommission(grossAmount, saleConfirmed);
    if (second.amount > 0) {
      records.push(buildCommissionRecord({
        saleId,
        buyerUserId,
        affiliateUserId: level2AffiliateId,
        type: 'second_level',
        amount: second.amount,
        rate: second.rate,
        level: 2
      }));
    }
  }

  return records;
}

module.exports = {
  getMonthStartIso,
  buildCommissionBundle
};
