function buildAiErrorContract(input) {
  var payload = input || {};
  var code = String(payload.code || 'UNKNOWN_ERROR');
  var message = String(payload.message || 'Não foi possível processar agora.');
  var state = String(payload.state || 'provider_unavailable');
  var retryable = !!payload.retryable;
  var status = Number(payload.status) || 500;
  var suggestion = payload.suggestion ? String(payload.suggestion) : null;
  var action = payload.action || null;

  return {
    status: status,
    body: {
      ok: false,
      success: false,
      type: 'error',
      state: state,
      message: message,
      error: code,
      errorCode: code,
      retryable: retryable,
      suggestion: suggestion,
      action: action,
      data: { content: [{ type: 'text', text: message }] },
      meta: Object.assign({ retryable: retryable }, payload.meta || {})
    }
  };
}

function buildAiWarningContract(input) {
  var payload = input || {};
  var message = String(payload.message || 'Processado com fallback seguro.');
  return {
    ok: true,
    success: true,
    type: payload.type || 'warning_with_fallback',
    state: payload.state || 'warning_with_fallback',
    message: message,
    warning: {
      code: String(payload.code || 'WARNING_WITH_FALLBACK'),
      message: message
    },
    data: payload.data || { content: [{ type: 'text', text: message }] },
    meta: Object.assign({ fallback: true }, payload.meta || {})
  };
}

module.exports = {
  buildAiErrorContract: buildAiErrorContract,
  buildAiWarningContract: buildAiWarningContract
};
