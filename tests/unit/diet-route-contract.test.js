const test = require('node:test');
const assert = require('node:assert/strict');

const contract = require('../../src/server/apihelpers/_dietRouteContract');

test('mapPlanForGate promove trial para acesso premium no gate de dieta', () => {
  assert.equal(contract.mapPlanForGate('trial'), 'ULTRA');
  assert.equal(contract.mapPlanForGate('trial_ultra_7_days'), 'ULTRA');
  assert.equal(contract.mapPlanForGate('pro'), 'PRO');
  assert.equal(contract.mapPlanForGate('free'), 'FREE');
});

test('buildDietRouteEnvelope preserva contrato diet_result compatível com frontend', () => {
  const envelope = contract.buildDietRouteEnvelope({
    action: 'GENERATE_DIET',
    domain: 'diet',
    success: true,
    message: 'Plano alimentar gerado com 4 refeicoes.',
    errorCode: null,
    payload: {
      validation: { missingFields: [] },
      plan: {
        failSafe: false,
        meta: { calorias: 2200 },
        refeicoes: [{ nome: 'Cafe da manha' }],
        hidratacao: { litros: 2.3 },
        observacoes: [],
      },
    },
  }, {
    requestId: 'req-1',
    userId: 'user-1',
    plan: 'PRO',
  });

  assert.equal(envelope.success, true);
  assert.equal(envelope.type, 'diet_result');
  assert.equal(envelope.requestId, 'req-1');
  assert.equal(envelope.userId, 'user-1');
  assert.equal(envelope.data.content[0].type, 'diet_result');
  assert.equal(envelope.data.content[0].data.meta.calorias, 2200);
  assert.equal(envelope.meta.plan, 'PRO');
});

test('buildDietRouteErrorEnvelope produz erro padronizado', () => {
  const envelope = contract.buildDietRouteErrorEnvelope({
    state: 'limit_reached_plan',
    error: 'LIMIT_REACHED_PLAN',
    message: 'Seu plano atual não permite este recurso.',
  }, {
    requestId: 'req-2',
    userId: 'user-2',
    plan: 'FREE',
  });

  assert.equal(envelope.success, false);
  assert.equal(envelope.type, 'error');
  assert.equal(envelope.error, 'LIMIT_REACHED_PLAN');
  assert.equal(envelope.state, 'limit_reached_plan');
  assert.equal(envelope.meta.plan, 'FREE');
});
