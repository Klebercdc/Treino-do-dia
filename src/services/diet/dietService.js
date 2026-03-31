async function execute(action, payload) {
  return { action, domain: 'diet', payload };
}

module.exports = { execute };
