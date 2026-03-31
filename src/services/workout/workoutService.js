async function execute(action, payload) {
  return { action, domain: 'workout', payload };
}

module.exports = { execute };
