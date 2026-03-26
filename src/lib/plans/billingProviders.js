function getCheckoutUrl(provider, plan, email) {
  var key = provider === 'kiwify'
    ? (plan === 'ULTRA' ? 'KIWIFY_CHECKOUT_ULTRA_URL' : 'KIWIFY_CHECKOUT_PRO_URL')
    : (plan === 'ULTRA' ? 'HOTMART_CHECKOUT_ULTRA_URL' : 'HOTMART_CHECKOUT_PRO_URL');

  var baseUrl = process.env[key] || '';
  if (!baseUrl) return '';
  if (!email) return baseUrl;
  var sep = baseUrl.includes('?') ? '&' : '?';
  return baseUrl + sep + 'email=' + encodeURIComponent(email);
}

function detectPlanFromPayload(provider, payload) {
  var productName = '';
  if (provider === 'hotmart') productName = (payload.data && payload.data.product && payload.data.product.name) || '';
  if (provider === 'kiwify') productName = (payload.product && payload.product.name) || '';
  return /ultra/i.test(productName) ? 'ULTRA' : 'PRO';
}

module.exports = { getCheckoutUrl, detectPlanFromPayload };
