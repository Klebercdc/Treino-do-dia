const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../../src/server/apihelpers/_dietRouteHandler');

test('handler monta payload a partir de campos diretos e payload aninhado', () => {
  const payload = handler.buildPayload({
    action: 'GENERATE_DIET',
    objective: 'emagrecimento',
    meals: 4,
    dislikes: ['brocolis'],
    bodyFatPercent: 18,
    payload: {
      sexo: 'F',
      idade: 30,
      dietaryPattern: 'vegano',
    },
    heightCm: 168,
  });

  assert.equal(payload.objective, 'emagrecimento');
  assert.equal(payload.meals, 4);
  assert.equal(payload.sexo, 'F');
  assert.equal(payload.idade, 30);
  assert.equal(payload.heightCm, 168);
  assert.deepEqual(payload.dislikes, ['brocolis']);
  assert.equal(payload.bodyFatPercent, 18);
  assert.equal(payload.dietaryPattern, 'vegano');
});

test('handler retorna diet_result em sucesso para plano permitido', async () => {
  const result = await handler.processDietRouteRequest({
    body: {
      action: 'GENERATE_DIET',
      objective: 'emagrecimento',
      profile: {
        sex: 'F',
        age: 31,
        weightKg: 68,
        heightCm: 170,
        routine: 'academia 4x por semana',
      },
      mealCount: 4,
    },
    requestId: 'req-handler-1',
    userId: 'user-handler-1',
    effectivePlan: 'PRO',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.type, 'diet_result');
  assert.equal(result.body.data.content[0].type, 'diet_result');
  assert.equal(result.body.data.service.gatedPlan, 'PRO');
  assert.equal(result.body.data.content[0].data.failSafe, false);
});

test('handler bloqueia geração de dieta para plano free', async () => {
  const result = await handler.processDietRouteRequest({
    body: {
      action: 'GENERATE_DIET',
      objective: 'emagrecimento',
    },
    requestId: 'req-handler-2',
    userId: 'user-handler-2',
    effectivePlan: 'FREE',
  });

  assert.equal(result.status, 402);
  assert.equal(result.body.success, false);
  assert.equal(result.body.error, 'LIMIT_REACHED_PLAN');
  assert.equal(result.body.state, 'limit_reached_plan');
});

test('handler rejeita ação de dieta inválida', async () => {
  const result = await handler.processDietRouteRequest({
    body: {
      action: 'DELETE_DIET',
    },
    requestId: 'req-handler-3',
    userId: 'user-handler-3',
    effectivePlan: 'PRO',
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
  assert.equal(result.body.error, 'INVALID_DIET_ACTION');
});
