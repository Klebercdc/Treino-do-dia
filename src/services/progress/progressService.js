async function execute(action, payload) {
  return { action, domain: 'progress', payload };
}

module.exports = { execute };
