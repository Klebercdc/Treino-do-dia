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
    extract(code, /function computeDietGenerationBaseline\(input\) \{[\s\S]*?\n\}/, 'computeDietGenerationBaseline'),
    extract(code, /function buildDietRequestPayloadFromInput\(input\) \{[\s\S]*?\n\}/, 'buildDietRequestPayloadFromInput'),
    extract(code, /function normalizeDietFoodText\(value\) \{[\s\S]*?\n\}/, 'normalizeDietFoodText'),
    extract(code, /function dietTextIncludesAny\(value, candidates\) \{[\s\S]*?\n\}/, 'dietTextIncludesAny'),
    extract(code, /function splitDietList\(value\) \{[\s\S]*?\n\}/, 'splitDietList'),
    extract(code, /function mergeUniqueDietList\(\) \{[\s\S]*?\n\}/, 'mergeUniqueDietList'),
    extract(code, /function parseDietAgeFromBirthDate\(birthDate\) \{[\s\S]*?\n\}/, 'parseDietAgeFromBirthDate'),
    extract(code, /function buildMergedDietInput\(input\) \{[\s\S]*?\n\}/, 'buildMergedDietInput'),
    extract(code, /function buildLocalDietFoodCatalog\(input\) \{[\s\S]*?\n\}/, 'buildLocalDietFoodCatalog'),
    extract(code, /function buildLocalDietPlan\(input\) \{[\s\S]*?\n\}/, 'buildLocalDietPlan'),
    extract(code, /function buildLocalDietRenderText\(input, reason\) \{[\s\S]*?\n\}/, 'buildLocalDietRenderText'),
    extract(code, /function buildDietFallbackTextFromInput\(input, reason\) \{[\s\S]*?\n\}/, 'buildDietFallbackTextFromInput'),
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

test('buildDietFallbackTextFromInput returns limited orientation instead of generic error', () => {
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

  assert.match(text, /##ORIENTACAO LIMITADA/);
  assert.match(text, /Falha temporária da rota/);
  assert.match(text, /CALORIAS:/);
  assert.match(text, /Restrições: lactose/);
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

  assert.equal(plan.meta.calorias, 2300);
  assert.equal(plan.meta.proteina, 140);
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
  assert.match(rendered, /CALORIAS: 2300/);
});
