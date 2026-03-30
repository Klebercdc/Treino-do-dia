const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'service-key-test';

const trackerMod = require('../../api/_diagnosticTracker');
const health = require('../../api/_diagnosticHealth');
const adminGuard = require('../../api/_adminGuard');
const classifier = require('../../api/_conversationClassifier');
const decisionEngine = require('../../api/_decisionEngine');
const constants = require('../../api/_diagnosticConstants');

test('maskSensitiveData should redact keys and tokens', () => {
  const input = {
    authorization: 'Bearer abc.def.ghi',
    apiKey: 'sk-1234567890123456',
    safe: 'ok'
  };
  const out = trackerMod.maskSensitiveData(input);
  assert.equal(out.authorization, '[redacted]');
  assert.equal(out.apiKey, '[redacted]');
  assert.equal(out.safe, 'ok');
});

test('DiagnosticTracker should generate execution id and text report', () => {
  const tracker = new trackerMod.DiagnosticTracker({ userId: 'u1', rawInput: 'oi', correlationId: '11111111-1111-1111-1111-111111111111', conversationTraceId: 'conv-1' });
  const execId = tracker.startExecution();
  tracker.addStep({ stepName: 'input_received', success: true, status: 'success' });
  tracker.captureQualityFlags({ intent: 'greeting', localReplyEligible: true, llmCalled: false, responseSizeEstimate: 10, promptSizeEstimate: 2 });
  tracker.markSuccess({ responseSummary: 'ok' });
  const reportText = tracker.exportExecutionReport('text');
  assert.ok(execId && typeof execId === 'string');
  assert.ok(reportText.includes('execution_id:'));
  assert.ok(reportText.includes('steps:'));
  assert.equal(tracker.execution.conversation_trace_id, 'conv-1');
  assert.equal(tracker.execution.pipeline_version, constants.VERSION_INFO.pipelineVersion);
  assert.ok(tracker.execution.diagnostic_quality_score >= 0);
});

test('admin guard blocks non-admin and allows admin whitelist', () => {
  process.env.ADMIN_EMAILS = 'admin@kronia.com';
  const noAdmin = adminGuard.requireAdmin({ email: 'user@kronia.com' }, null);
  const yesAdmin = adminGuard.requireAdmin({ email: 'admin@kronia.com' }, null);
  assert.equal(noAdmin, null);
  assert.ok(yesAdmin && yesAdmin.isAdmin);
});

test('health rules produce degraded status and alerts', () => {
  const row = { component: 'call_llm_short', total: 20, failure_total: 5, success_total: 15, avg_duration_ms: 2100, fallback_rate: 0.4 };
  const evaluated = health.evaluateComponentHealth(row);
  assert.equal(evaluated.status, 'degraded');

  const execs = Array.from({ length: 20 }).map((_, i) => ({
    success: i % 3 !== 0,
    fallback_used: i % 2 === 0,
    duration_ms: 2000 + i
  }));
  const alerts = health.buildAlerts(execs);
  assert.ok(alerts.length > 0);
  assert.ok(alerts[0].severity);
});

test('greeting should prefer local reply and skip llm', () => {
  const normalized = classifier.normalizeConversationInput('oi');
  const intent = classifier.classifyIntent(normalized, null);
  const decision = decisionEngine.decideAction(intent, null, {});
  assert.equal(decision.action, 'local_reply');
});

test('workout request should route to workout flow', () => {
  const normalized = classifier.normalizeConversationInput('quero montar um treino de hipertrofia');
  const intent = classifier.classifyIntent(normalized, null);
  const decision = decisionEngine.decideAction(intent, null, {});
  assert.equal(decision.action, 'open_workout_flow');
});

test('diet request should route to diet flow', () => {
  const normalized = classifier.normalizeConversationInput('quero montar uma dieta para secar');
  const intent = classifier.classifyIntent(normalized, null);
  const decision = decisionEngine.decideAction(intent, null, {});
  assert.equal(decision.action, 'open_diet_flow');
});

test('vitamina D should not route to workout flow', () => {
  const normalized = classifier.normalizeConversationInput('qual dose de vitamina d devo tomar?');
  const intent = classifier.classifyIntent(normalized, null);
  const decision = decisionEngine.decideAction(intent, null, {});
  assert.notEqual(decision.action, 'open_workout_flow');
});
