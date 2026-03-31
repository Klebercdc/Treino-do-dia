async function execute(action, payload) {
  return { action, domain: 'supplement', payload };
}

module.exports = { execute };
