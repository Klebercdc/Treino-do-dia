function normalizeContent(message, type, data) {
  if (data && Array.isArray(data.content) && data.content.length) return data.content;
  return [{ type: type === 'error' ? 'text' : (type || 'text'), text: String(message || '') }];
}

function createApiEnvelope(partial) {
  var p = partial || {};
  var success = !!p.success;
  var type = String(p.type || (success ? 'general' : 'error'));
  var message = String(p.message || (success ? '' : 'Não consegui processar agora.'));
  var data = p.data && typeof p.data === 'object' ? p.data : null;
  var envelope = {
    ok: success,
    success: success,
    type: type,
    state: p.state ? String(p.state) : (success ? 'success' : 'provider_unavailable'),
    action: p.action == null ? null : String(p.action),
    message: message,
    data: data,
    error: p.error ? String(p.error) : null,
    meta: p.meta && typeof p.meta === 'object' ? p.meta : {}
  };

  if (!envelope.data) {
    envelope.data = { content: normalizeContent(message, type, null) };
  } else if (!Array.isArray(envelope.data.content)) {
    envelope.data.content = normalizeContent(message, type, envelope.data);
  }

  return envelope;
}

function sendJson(res, statusCode, payload) {
  var code = Number(statusCode) || 200;
  var body = createApiEnvelope(payload);
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = {
  createApiEnvelope: createApiEnvelope,
  sendJson: sendJson
};
