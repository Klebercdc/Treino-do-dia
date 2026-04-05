const test = require('node:test');
const assert = require('node:assert/strict');

const contract = require('../../src/server/apihelpers/_dietRouteContract');

test('mapPlanForGate promove trial para acesso premium no gate de dieta', () => {
  assert.equal(contract.mapPlanForGate('trial'), 'ULTRA');
  assert.equal(contract.mapPlanForGate('trial_ultra_7_days'), 'ULTRA');
  assert.equal(contract.mapPlanForGate('pro'), 'PRO');
  assert.equal(contract.mapPlanForGate('free'), 'FREE');
});

test('buildDietRouteEnvelope emite diet_primary para plano completo', () => {
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
  assert.equal(envelope.type, 'diet_primary');
  assert.equal(envelope.requestId, 'req-1');
  assert.equal(envelope.userId, 'user-1');
  assert.equal(envelope.data.content[0].type, 'diet_primary');
  assert.equal(envelope.data.content[0].data.meta.calorias, 2200);
  assert.equal(envelope.meta.renderMode, 'diet_primary');
  assert.equal(envelope.meta.plan, 'PRO');
});

test('buildDietRouteEnvelope emite diet_failsafe quando a dieta precisa de contingencia', () => {
  const envelope = contract.buildDietRouteEnvelope({
    action: 'GENERATE_DIET',
    domain: 'diet',
    success: false,
    message: 'Dados insuficientes para montar a dieta com segurança.',
    errorCode: 'DIET_INPUT_INVALID',
    payload: {
      validation: { missingFields: ['sexo'] },
      plan: {
        failSafe: true,
        limitedOrientation: { orientacao: 'Revise o perfil.' },
        observacoes: ['Revise o perfil.'],
        refeicoes: [],
      },
    },
  }, {
    requestId: 'req-1b',
    userId: 'user-1b',
    plan: 'PRO',
  });

  assert.equal(envelope.success, true);
  assert.equal(envelope.type, 'diet_failsafe');
  assert.equal(envelope.state, 'validation_required');
  assert.equal(envelope.data.content[0].type, 'diet_failsafe');
  assert.equal(envelope.meta.failSafe, true);
  assert.equal(envelope.meta.renderMode, 'diet_failsafe');
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
