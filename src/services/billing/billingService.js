async function resolve(payload) {
  return { domain: 'billing', ...payload };
}

module.exports = { resolve };
