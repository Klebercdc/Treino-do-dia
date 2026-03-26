var cors = require('./_cors');
var auth = require('./_auth');
var plans = require('./_plans');
var { getMonthStartIso, buildCommissionBundle } = require('../src/lib/affiliate/affiliateService');

function hasValidServiceToken(req) {
  var configured = process.env.AFFILIATE_SALE_TOKEN || '';
  if (!configured) return false;
  var received = req.headers['x-affiliate-token'] || '';
  return received === configured;
}

function handleSale(req, res) {
  var body = req.body || {};
  if (!body.saleId || !body.buyerUserId || !body.grossAmount) {
    return res.status(400).json({ error: 'saleId, buyerUserId e grossAmount são obrigatórios' });
  }

  var monthStart = getMonthStartIso();
  var hasLevel1 = Boolean(body.level1AffiliateUserId);
  var q = 'affiliate_commissions?affiliate_user_id=eq.' + encodeURIComponent(body.level1AffiliateUserId || '00000000-0000-0000-0000-000000000000')
    + '&commission_type=eq.direct&created_at=gte.' + encodeURIComponent(monthStart)
    + '&select=id';

  function processWithMonthlyCount(monthlySalesCount) {
    var commissionRows = buildCommissionBundle({
      saleId: body.saleId,
      buyerUserId: body.buyerUserId,
      level1AffiliateId: body.level1AffiliateUserId,
      level2AffiliateId: body.level2AffiliateUserId,
      grossAmount: Number(body.grossAmount),
      monthlySalesCount: monthlySalesCount,
      recurring: body.recurring === true,
      saleConfirmed: body.saleConfirmed !== false
    });

    plans.supabaseRpcRequest('process_affiliate_sale', {
      p_sale: {
        sale_id: body.saleId,
        buyer_user_id: body.buyerUserId,
        level1_affiliate_user_id: body.level1AffiliateUserId || null,
        level2_affiliate_user_id: body.level2AffiliateUserId || null,
        gross_amount: Number(body.grossAmount),
        is_recurring: body.recurring === true,
        provider: body.provider || null
      },
      p_commissions: commissionRows
    }, function(rpcErr, rpcResult) {
      if (rpcErr) return res.status(500).json({ error: String(rpcErr) });

      var payload = rpcResult || {};
      return res.status(200).json({
        ok: true,
        saleId: body.saleId,
        idempotent: payload.idempotent === true,
        commissionCount: Number(payload.commission_count || 0),
        commissions: payload.commissions || commissionRows
      });
    });
  }

  if (!hasLevel1) return processWithMonthlyCount(0);

  plans.supabaseRequest('GET', q, null, function(countErr, rows) {
    if (countErr) return res.status(500).json({ error: String(countErr) });
    return processWithMonthlyCount((rows || []).length);
  });
}

module.exports = function(req, res) {
  cors.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  if (hasValidServiceToken(req)) {
    return handleSale(req, res);
  }

  return auth.requireAuth(req, res, function() {
    return handleSale(req, res);
  });
};
