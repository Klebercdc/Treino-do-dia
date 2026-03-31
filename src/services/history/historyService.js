async function persistResult(record) {
  return { stored: true, record };
}

module.exports = { persistResult };
