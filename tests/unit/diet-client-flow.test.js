const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function extract(src, pattern, label) {
  const match = src.match(pattern);
  if (!match) throw new Error(`snippet not found: ${label}`);
  return match[0];
}

function loadDietHelpers() {
  const code = fs.readFileSync('app.js', 'utf8');
  const snippet = [
    extract(code, /function buildApiErrorEnvelope\(message, errorCode\) \{[\s\S]*?\n\}/, 'buildApiErrorEnvelope'),
    extract(code, /function resolveAiFriendlyError\(payload, httpStatus\) \{[\s\S]*?\n\}/, 'resolveAiFriendlyError'),
    extract(code, /function computeDietGenerationBaseline\(input\) \{[\s\S]*?\n\}/, 'computeDietGenerationBaseline'),
    extract(code, /function buildDietRequestPayloadFromInput\(input\) \{[\s\S]*?\n\}/, 'buildDietRequestPayloadFromInput'),
    extract(code, /function normalizeDietFoodText\(value\) \{[\s\S]*?\n\}/, 'normalizeDietFoodText'),
    extract(code, /function dietTextIncludesAny\(value, candidates\) \{[\s\S]*?\n\}/, 'dietTextIncludesAny'),
    extract(code, /function splitDietList\(value\) \{[\s\S]*?\n\}/, 'splitDietList'),
    extract(code, /function mergeUniqueDietList\(\) \{[\s\S]*?\n\}/, 'mergeUniqueDietList'),
    extract(code, /function parseDietAgeFromBirthDate\(birthDate\) \{[\s\S]*?\n\}/, 'parseDietAgeFromBirthDate'),
    extract(code, /var NUTRITION_FOOD_CATALOG = \[[\s\S]*?\n\];/, 'NUTRITION_FOOD_CATALOG'),
    extract(code, /function getNutritionCatalogItems\(group\) \{[\s\S]*?\n\}/, 'getNutritionCatalogItems'),
    extract(code, /function buildMergedDietInput\(input\) \{[\s\S]*?\n\}/, 'buildMergedDietInput'),
    extract(code, /function buildLocalDietFoodCatalog\(input\) \{[\s\S]*?\n\}/, 'buildLocalDietFoodCatalog'),
    extract(code, /function buildLocalDietPlan\(input\) \{[\s\S]*?\n\}/, 'buildLocalDietPlan'),
    extract(code, /function buildLocalDietOrientacoes\(input, baseline\) \{[\s\S]*?\n\}/, 'buildLocalDietOrientacoes'),
    extract(code, /function buildLocalDietRenderText\(input, reason\) \{[\s\S]*?\n\}/, 'buildLocalDietRenderText'),
    extract(code, /function buildDietFallbackTextFromInput\(input, reason\) \{[\s\S]*?\n\}/, 'buildDietFallbackTextFromInput'),
    extract(code, /function resolveDietRuntimeErrorMessage\(payload, httpStatus, input, fallbackReason\) \{[\s\S]*?\n\}/, 'resolveDietRuntimeErrorMessage'),
    extract(code, /function renderDietModelAsText\(model\) \{[\s\S]*?\n\}/, 'renderDietModelAsText'),
  ].join('\n\n');

  const context = {};
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'diet-client-flow-snippet.js' });
  return context;
}

test('buildDietRequestPayloadFromInput creates compact payload for route', () => {
  const context = loadDietHelpers();
  const payload = context.buildDietRequestPayloadFromInput({
    objetivo: 'hipertrofia',
    sexo: 'feminino',
    peso: 62,
    altura: 168,
    idade: 29,
    gorduraCorporal: 21,
    biotipo: 'mesomorfo',
    refeicoesPorDia: 4,
    nivelAtividade: 'moderadamente ativo',
    frequenciaTreino: '5x por semana',
    duracaoTreino: '60 min',
    tipoTreino: 'musculação',
    sono: '7h',
    estresse: 'moderado',
    patologia: 'nenhuma',
    medicamentos: '',
    padraoAlimentar: 'vegano',
    restricoes: 'gluten',
    preferencias: 'tofu, aveia',
    alimentosEvitar: 'brocolis',
    suplementos: ['creatina'],
    orcamento: 'moderado',
    nutritionGoals: { calories_target: 2100 },
    supabaseSnapshot: { profile: { id: 'user-1' } },
    fromChatDiet: true,
  });

  assert.equal(payload.objetivo, 'hipertrofia');
  assert.equal(payload.profile.dietaryPattern, 'vegano');
  assert.equal(payload.context.fromChatDiet, true);
  assert.equal(payload.context.trainingContext.tipo, 'musculação');
  assert.equal(payload.nutritionGoals.calories_target, 2100);
  assert.equal(payload.supabaseSnapshot.profile.id, 'user-1');
});

test('buildDietFallbackTextFromInput returns full deterministic plan instead of generic error', () => {
  const context = loadDietHelpers();
  const text = context.buildDietFallbackTextFromInput({
    objetivo: 'emagrecimento',
    sexo: 'masculino',
    peso: 80,
    altura: 175,
    idade: 30,
    refeicoesPorDia: 4,
    padraoAlimentar: 'onívoro',
    restricoes: 'lactose',
    alimentosEvitar: 'cebola',
    preferencias: 'frango',
    nivelAtividade: 'levemente ativo',
  }, 'Falha temporária da rota.');

  assert.match(text, /##META/);
  assert.match(text, /Falha temporária da rota/);
  assert.match(text, /##RESUMO/);
  assert.doesNotMatch(text, /—/);
  assert.match(text, /lactose/);
});

test('buildLocalDietPlan uses Supabase snapshot to enrich fallback diet', () => {
  const context = loadDietHelpers();
  const plan = context.buildLocalDietPlan({
    objetivo: 'hipertrofia',
    sexo: 'feminino',
    peso: 60,
    altura: 165,
    idade: 28,
    refeicoesPorDia: 4,
    padraoAlimentar: '',
    preferencias: '',
    alimentosEvitar: '',
    restricoes: '',
    suplementos: [],
    supabaseSnapshot: {
      profile: {
        dietary_pattern: 'vegano',
        liked_foods: ['tofu'],
        disliked_foods: ['brocolis'],
        allergies: ['gluten'],
      },
      bodyMetrics: {
        body_fat_percent: 24,
      },
      nutritionGoals: {
        calories_target: 2300,
        protein_g: 140,
        carbs_g: 250,
        fat_g: 65,
      },
      supplementProtocols: ['creatina'],
    },
  });

  assert.ok(plan.meta.calorias > 0);
  assert.ok(plan.meta.proteina > 0);
  assert.equal(plan.refeicoes.length, 4);
  const rendered = context.buildLocalDietRenderText({
    objetivo: 'hipertrofia',
    sexo: 'feminino',
    peso: 60,
    altura: 165,
    idade: 28,
    refeicoesPorDia: 4,
    supabaseSnapshot: {
      profile: { dietary_pattern: 'vegano', liked_foods: ['tofu'] },
      nutritionGoals: { calories_target: 2300, protein_g: 140, carbs_g: 250, fat_g: 65 },
    },
  }, 'Plano local');
  assert.match(rendered, /##RESUMO/);
  assert.doesNotMatch(rendered, /—/);
});

test('resolveDietRuntimeErrorMessage always returns a local full plan for route errors', () => {
  const context = loadDietHelpers();
  const rendered = context.resolveDietRuntimeErrorMessage({
    success: false,
    message: 'Seu plano atual não permite este recurso de dieta.',
    error: 'LIMIT_REACHED_PLAN',
  }, 402, {
    objetivo: 'hipertrofia',
    sexo: 'feminino',
    peso: 60,
    altura: 165,
    idade: 28,
    refeicoesPorDia: 4,
    supabaseSnapshot: {
      nutritionGoals: { calories_target: 2300, protein_g: 140, carbs_g: 250, fat_g: 65 },
    },
  }, 'A rota de dieta retornou erro.');

  assert.match(rendered, /##META/);
  assert.match(rendered, /##RESUMO/);
  assert.match(rendered, /Seu plano atual não permite este recurso de dieta/);
  assert.doesNotMatch(rendered, /##ORIENTACAO LIMITADA/);
});

test('renderDietModelAsText renders complete failsafe plan when meals are present', () => {
  const context = loadDietHelpers();
  const rendered = context.renderDietModelAsText({
    failSafe: true,
    text: 'Plano inicial seguro.',
    limitedOrientation: { orientacao: 'Dados incompletos.' },
    meta: { calorias: 2100, proteina: 150, carbo: 220, gordura: 60, tmb: 1600, get: 2200 },
    refeicoes: [
      {
        nome: 'Café da manhã',
        horario: '07:00',
        foco: 'META: 500 kcal',
        proteinas: ['Tofu firme (150 g)'],
        carbos: ['Aveia (40 g)'],
        extras: ['Banana (1 un)'],
      },
    ],
    hidratacao: { litros: 2.5 },
    observacoes: ['Plano local gerado em contingência.'],
  });

  assert.match(rendered, /##META/);
  assert.match(rendered, /##REFEICAO/);
  assert.match(rendered, /Tofu firme/);
  assert.doesNotMatch(rendered, /##ORIENTACAO LIMITADA/);
});

test('renderDietModelAsText exposes the official five-section diet format', () => {
  const context = loadDietHelpers();
  const rendered = context.renderDietModelAsText({
    failSafe: false,
    meta: { calorias: 2400, proteina: 160, carbo: 280, gordura: 65, tmb: 1700, get: 2600 },
    refeicoes: [
      {
        nome: 'Almoço',
        horario: '12:30',
        foco: 'META: 700 kcal',
        alimentos: [{ nome: 'Frango grelhado', qtde: '150 g', kcal: 248, prot: 46, carb: 0, gord: 6 }],
        subtotal: { kcal: 248, prot: 46, carb: 0, gord: 6 },
        substituicoes: [{ item: 'Frango grelhado', opcoes: ['Tilápia 180 g', 'Patinho 130 g'] }],
      },
    ],
    hidratacao: { litros: 3 },
    observacoes: ['Distribuir água ao longo do dia.'],
  });

  assert.match(rendered, /PRESCRIÇÃO NUTRICIONAL/);
  assert.match(rendered, /PLANO ALIMENTAR/);
  assert.match(rendered, /SUBSTITUIÇÕES/);
  assert.match(rendered, /SEQUÊNCIA DE CONSUMO/);
  assert.match(rendered, /ORIENTAÇÕES/);
  assert.match(rendered, /##META/);
  assert.match(rendered, /##REFEICAO/);
  assert.match(rendered, /##RESUMO/);
  assert.match(rendered, /##ORIENTACOES/);
});
