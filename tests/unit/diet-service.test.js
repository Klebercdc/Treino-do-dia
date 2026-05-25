const test = require('node:test');
const assert = require('node:assert/strict');

const nutritionService = require('../../src/lib/nutrition/nutritionService');
const dietService = require('../../src/services/diet/dietService');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

test('nutritionService accepts abbreviated sex values for diet generation', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'F',
    idade: 29,
    peso: 62,
    altura: 168,
    objetivo: 'hipertrofia',
    rotina: 'academia 4x por semana',
    refeicoesPorDia: 4,
  });

  assert.equal(result.failSafe, false);
  assert.equal(result.profile.sexo, 'feminino');
  assert.ok(result.plan.refeicoes.length >= 3);
});

test('nutritionService exposes premium canonical food and recipe catalogs', () => {
  assert.ok(Array.isArray(nutritionService.CANONICAL_FOODS));
  assert.ok(Array.isArray(nutritionService.RECIPE_CATALOG));
  assert.ok(Array.isArray(nutritionService.DIET_TEMPLATES));
  assert.ok(nutritionService.CANONICAL_FOODS.length >= 150);
  assert.ok(nutritionService.RECIPE_CATALOG.length >= 100);
  assert.ok(nutritionService.DIET_TEMPLATES.length >= 100);

  const groups = new Set(nutritionService.CANONICAL_FOODS.map((food) => food.group_key));
  ['proteinas', 'carboidratos', 'gorduras', 'frutas', 'vegetais', 'laticinios', 'temperos'].forEach((group) => {
    assert.ok(groups.has(group), `grupo ausente: ${group}`);
  });

  const sample = nutritionService.CANONICAL_FOODS.find((food) => food.slug === 'frango_grelhado');
  assert.equal(sample.canonical_name_pt, 'Frango grelhado');
  assert.equal(sample.default_portion_g, 120);
  assert.equal(sample.is_recipe_ingredient, true);
});

test('nutritionService premium diet templates expose required living-template contract', () => {
  const categories = new Set();

  nutritionService.DIET_TEMPLATES.forEach((template) => {
    assert.ok(template.id);
    assert.ok(template.nome);
    assert.ok(template.objetivo);
    assert.ok(template.faixa_calorica.min > 0);
    assert.ok(Array.isArray(template.perfil_indicado));
    assert.ok(template.nivel_dificuldade);
    assert.ok(template.quantidade_refeicoes >= 3);
    assert.ok(template.estrategia_nutricional);
    assert.ok(template.distribuicao_macros.protein > 0);
    assert.ok(Array.isArray(template.estrutura_refeicoes));
    assert.ok(template.alimentos_base.proteinas.length);
    assert.ok(template.substituicoes_por_categoria.proteina.length);
    assert.ok(template.regras_adaptacao.length);
    assert.ok(template.ordem_consumo.length);
    assert.ok(Array.isArray(template.observacoes));
    assert.ok(Array.isArray(template.alertas_profissionais));
    categories.add(template.id.replace(/^kronia_/, '').replace(/_\d+_\d+$/, ''));
  });

  [
    'emagrecimento',
    'hipertrofia',
    'manutencao',
    'economica_brasileira',
    'marmita',
    'rotina_corrida',
    'treino_matinal',
    'treino_noturno',
    'alta_saciedade',
    'low_carb_leve',
    'high_carb',
    'flexivel',
    'sem_lactose',
    'sem_gluten',
    'vegetariana',
    'plant_based',
    'reeducacao_alimentar',
    'baixa_adesao',
    'ansiedade_alimentar',
    'especial_alerta_profissional',
  ].forEach((category) => assert.ok(categories.has(category), `categoria ausente: ${category}`));
});

test('nutritionService selects best premium template and applies it to generated plan', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'M',
    idade: 34,
    peso: 84,
    altura: 179,
    objetivo: 'hipertrofia',
    refeicoesPorDia: 5,
    rotina: 'treino noturno musculacao 5x por semana',
  });

  assert.equal(result.failSafe, false);
  assert.ok(result.selectedDietTemplate.id.includes('treino_noturno') || result.selectedDietTemplate.objetivo === 'hipertrofia');
  assert.equal(result.catalogStats.dietTemplates >= 100, true);
  assert.equal(result.plan.templateId, result.selectedDietTemplate.id);
  assert.ok(result.plan.ordemConsumo.includes('carboidrato'));
  assert.equal(result.plan.refeicoes.length, result.selectedDietTemplate.quantidade_refeicoes);
});

test('nutritionService generates template skeleton, substitutes only equivalent category and rebalances macros', () => {
  const template = nutritionService.selectDietTemplate(
    { objetivo: 'emagrecimento', rotina: 'rotina corrida com baixa adesao' },
    { targetCalories: 1850 },
  );
  const skeleton = nutritionService.generateDietFromTemplate(template, {}, {
    targetCalories: 1850,
    macros: { protein: 150, carbs: 170, fat: 55 },
  });

  assert.equal(skeleton.templateId, template.id);
  assert.ok(skeleton.refeicoes.length >= 3);
  assert.ok(skeleton.refeicoes.every((meal) => meal.meta.protein > 0 && meal.meta.carbs > 0));

  const plan = {
    refeicoes: [{
      nome: 'Almoço',
      meta: { proteinas: 46.5, carboidratos: 56, gorduras: 8 },
      itens: [
        { nome: 'Frango grelhado', groupKey: 'proteinas', gramas: 100, per100: { kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 } },
        { nome: 'Arroz cozido', groupKey: 'carboidratos', gramas: 150, per100: { kcal: 130, protein: 2.5, carbs: 28, fat: 0.3, fiber: 0.4 } },
      ],
    }],
  };

  const refused = nutritionService.substituteFood(plan, 0, 0, {
    nome: 'Arroz cozido',
    groupKey: 'carboidratos',
    gramas: 150,
    per100: { kcal: 130, protein: 2.5, carbs: 28, fat: 0.3, fiber: 0.4 },
  });
  assert.equal(refused.warnings.length, 1);

  const swapped = nutritionService.substituteFood(plan, 0, 0, {
    nome: 'Tilápia grelhada',
    groupKey: 'proteinas',
    gramas: 120,
    per100: { kcal: 128, protein: 26, carbs: 0, fat: 2.7, fiber: 0 },
  });
  assert.deepEqual(swapped.warnings, []);
  assert.ok(swapped.plan.refeicoes[0].subtotal.proteinas >= 42);
  assert.ok(swapped.plan.refeicoes[0].subtotal.carboidratos >= 45);
});

test('nutritionService normalizeDietItem preserves persisted per100 before catalog-like current values', () => {
  const item = nutritionService.normalizeDietItem({
    nome: 'Frango grelhado',
    gramas: 150,
    calorias: 12,
    proteinas: 3,
    carboidratos: 9,
    gorduras: 1,
    per100: {
      kcal: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
      fiber: 0,
    },
  });

  assert.equal(item.gramas, 150);
  assert.equal(item.calorias, 248);
  assert.equal(item.proteinas, 46.5);
  assert.equal(item.carboidratos, 0);
  assert.equal(item.gorduras, 5.4);
});

test('dietService normalizes mixed payload shapes and generates diet plan', async () => {
  const result = await dietService.execute('GENERATE_DIET', {
    objective: 'emagrecimento',
    profile: {
      sexo: 'M',
      idade: 35,
      pesoKg: 84,
      alturaCm: 178,
      rotina: 'academia 5x por semana',
      restricoes: ['lactose'],
      dietaryPattern: 'vegano',
    },
    meals: 5,
    preferences: ['frango', 'ovo'],
    dislikes: ['iogurte'],
    trainingContext: { frequencia: '5x por semana', duracao: '60 min', tipo: 'musculacao' },
    healthContext: { sono: '7h', estresse: 'moderado' },
  });

  assert.equal(result.domain, 'diet');
  assert.equal(result.action, 'GENERATE_DIET');
  assert.equal(result.success, true);
  assert.equal(result.payload.profile.sexo, 'M');
  assert.equal(result.payload.profile.objetivo, 'emagrecimento');
  assert.equal(result.payload.profile.padraoAlimentar, 'vegano');
  assert.deepEqual(result.payload.profile.alimentosEvitar, ['iogurte']);
  assert.equal(result.payload.profile.contextoTreino.frequencia, '5x por semana');
  assert.equal(result.payload.plan.failSafe, false);
  assert.equal(result.payload.plan.profile.objetivo, 'emagrecimento');
  assert.equal(result.payload.plan.refeicoes.length, 5);
});

test('nutritionService consolida contexto, estratégia e prescrição com treino, exames e recuperação', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'M',
    idade: 36,
    peso: 82,
    altura: 178,
    objetivo: 'emagrecimento',
    refeicoesPorDia: 4,
    preferencias: ['arroz', 'frango'],
    restricoes: ['lactose'],
    contextoTreino: { frequencia: '5x por semana', tipo: 'musculacao' },
    aderencia: { fadiga: 9, tendenciaForca: 'caindo', prioridadeMetabolica: 'Recuperar' },
    labContext: {
      id: 'lab-context',
      isValid: true,
      parsed: { glucose: 101, hba1c: 5.8, potassium: 4.5, ldl: 110 },
      clinicalFlags: ['glycemic_risk'],
      criticalFlags: [],
    },
  });

  assert.equal(result.failSafe, false);
  assert.equal(result.contextoNutricional.objective, 'emagrecimento');
  assert.equal(result.contextoNutricional.training.frequencia, '5x por semana');
  assert.equal(result.contextoNutricional.recovery.fatigue, 9);
  assert.equal(result.estrategiaNutricional.recovery.fatigue, 9);
  assert.ok(result.estrategiaNutricional.adjustments.includes('recovery_deficit_softened'));
  assert.ok(Array.isArray(result.plan.refeicoes));
  assert.ok(result.plan.refeicoes.length >= 3);
});

test('nutritionService personaliza plano com padrao alimentar e alimentos evitados', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'F',
    idade: 29,
    peso: 62,
    altura: 168,
    objetivo: 'hipertrofia',
    refeicoesPorDia: 4,
    padraoAlimentar: 'vegano',
    alimentosEvitar: ['brocolis'],
  });

  assert.equal(result.failSafe, false);
  const foods = result.plan.refeicoes.flatMap((meal) => meal.itens.map((item) => item.nome.toLowerCase()));
  assert.ok(foods.includes('tofu firme'));
  assert.ok(!foods.includes('frango grelhado'));
  assert.ok(!foods.includes('brocolis cozido'));
  assert.ok(!foods.includes('mel'));
});

test('nutritionService não usa rótulos de treino para perfil sedentário', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'F',
    idade: 38,
    peso: 72,
    altura: 164,
    objetivo: 'emagrecimento',
    nivelAtividade: 'sedentario',
    refeicoesPorDia: 5,
    padraoAlimentar: 'onívoro',
  });

  assert.equal(result.failSafe, false);
  const mealTypes = result.plan.refeicoes.map((meal) => normalizeText(meal.tipo));
  const mealNames = result.plan.refeicoes.map((meal) => normalizeText(meal.nome));

  assert.ok(!mealTypes.some((type) => /treino/.test(type)));
  assert.ok(!mealNames.some((name) => /treino/.test(name)));
  assert.ok(mealNames.some((name) => /lanche da tarde/.test(name)));
});

test('nutritionService returns daily totals aligned with meal subtotals and realistic breakfast', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'M',
    idade: 31,
    peso: 82,
    altura: 178,
    objetivo: 'hipertrofia',
    refeicoesPorDia: 5,
    contextoTreino: { frequencia: '5x por semana', tipo: 'musculacao' },
  });

  assert.equal(result.failSafe, false);
  const breakfast = result.plan.refeicoes[0];
  assert.match(breakfast.nome, /caf/i);
  const breakfastFoods = breakfast.itens.map((item) => item.nome.toLowerCase());
  assert.ok(
    breakfastFoods.some((name) => /ovo|aveia|banana|p[aã]o|whey|iogurte|tofu/.test(name)),
  );

  const totals = result.plan.refeicoes.reduce((acc, meal) => {
    acc.calorias += Number(meal.subtotal.calorias || 0);
    acc.proteina += Number(meal.subtotal.proteinas || 0);
    acc.carbo += Number(meal.subtotal.carboidratos || 0);
    acc.gordura += Number(meal.subtotal.gorduras || 0);
    return acc;
  }, { calorias: 0, proteina: 0, carbo: 0, gordura: 0 });

  assert.equal(Math.round(totals.calorias), Math.round(result.calculation.targetCalories));
  assert.equal(Math.round(totals.proteina * 10) / 10, result.calculation.macros.protein);
  assert.equal(Math.round(totals.carbo * 10) / 10, result.calculation.macros.carbs);
  assert.equal(Math.round(totals.gordura * 10) / 10, result.calculation.macros.fat);
});

test('nutritionService keeps almoço brasileiro para onívoro e proteína vegetal para vegano', () => {
  const omnivore = nutritionService.generateNutritionPlan({
    sexo: 'M',
    idade: 30,
    peso: 80,
    altura: 176,
    objetivo: 'hipertrofia',
    refeicoesPorDia: 5,
    padraoAlimentar: 'onívoro',
  });
  assert.equal(omnivore.failSafe, false);
  const lunch = omnivore.plan.refeicoes.find((meal) => normalizeText(meal.nome).includes('almoco'));
  const lunchFoods = lunch.itens.map((item) => item.nome.toLowerCase());
  assert.ok(lunchFoods.some((name) => /frango|patinho|til[aá]pia/.test(name)));
  assert.ok(lunchFoods.some((name) => /arroz/.test(name)));
  assert.ok(lunchFoods.some((name) => /feij[aã]o/.test(name)));
  assert.ok(!lunchFoods.some((name) => /tofu/.test(name)));

  const vegan = nutritionService.generateNutritionPlan({
    sexo: 'F',
    idade: 28,
    peso: 62,
    altura: 167,
    objetivo: 'hipertrofia',
    refeicoesPorDia: 5,
    padraoAlimentar: 'vegano',
  });
  assert.equal(vegan.failSafe, false);
  const veganLunch = vegan.plan.refeicoes.find((meal) => normalizeText(meal.nome).includes('almoco'));
  const veganLunchFoods = veganLunch.itens.map((item) => item.nome.toLowerCase());
  assert.ok(veganLunchFoods.some((name) => /tofu/.test(name)));
  assert.ok(veganLunchFoods.some((name) => /arroz/.test(name)));
  assert.ok(veganLunchFoods.some((name) => /feij[aã]o/.test(name)));
});

test('nutritionService gera substituições por grupo alimentar equivalente', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'M',
    idade: 33,
    peso: 82,
    altura: 178,
    objetivo: 'recomposicao',
    refeicoesPorDia: 4,
    padraoAlimentar: 'onívoro',
  });

  assert.equal(result.failSafe, false);
  const allItems = result.plan.refeicoes.flatMap((meal) => meal.itens);
  const proteinItem = allItems.find((item) => item.groupKey === 'proteinas' && item.substituicoes.length);
  assert.ok(proteinItem);
  const proteinCodes = new Set(nutritionService.FOOD_LIBRARY.mealProteins.concat(nutritionService.FOOD_LIBRARY.fastProteins).map((item) => item.code));
  proteinItem.substituicoes.forEach((option) => {
    assert.ok(proteinCodes.has(option.foodCode), `substituição fora de proteína: ${option.foodCode}`);
  });
});

test('nutritionService evita café da manhã com vegetais e pré-treino com tofu para onívoro', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'M',
    idade: 30,
    peso: 80,
    altura: 176,
    objetivo: 'hipertrofia',
    refeicoesPorDia: 4,
    padraoAlimentar: 'onívoro',
  });

  assert.equal(result.failSafe, false);
  const breakfast = result.plan.refeicoes.find((meal) => normalizeText(meal.nome).includes('cafe'));
  const afternoonSnack = result.plan.refeicoes.find((meal) => normalizeText(meal.nome).includes('cafe da tarde'));

  const breakfastFoods = breakfast.itens.map((item) => normalizeText(item.nome));
  const snackFoods = afternoonSnack.itens.map((item) => normalizeText(item.nome));

  assert.ok(!breakfastFoods.some((name) => /brocolis|salada|cenoura|legumes/.test(name)));
  assert.ok(!breakfastFoods.some((name) => /azeite/.test(name)));
  assert.ok(!snackFoods.some((name) => /brocolis|salada|cenoura|legumes/.test(name)));
  assert.ok(!snackFoods.some((name) => /frango|patinho|tilapia|sardinha/.test(name)));
});

test('nutritionService redistribui dinamicamente a dieta entre 3 e 6 refeições sem criar slots estranhos', () => {
  [3, 4, 5, 6].forEach((mealCount) => {
    const result = nutritionService.generateNutritionPlan({
      sexo: 'M',
      idade: 31,
      peso: 82,
      altura: 178,
      objetivo: 'hipertrofia',
      refeicoesPorDia: mealCount,
      padraoAlimentar: 'onívoro',
    });

    assert.equal(result.failSafe, false);
    assert.equal(result.plan.refeicoes.length, mealCount);

    const names = result.plan.refeicoes.map((meal) => normalizeText(meal.nome));
    assert.ok(names[0].includes('cafe da manha'));
    assert.ok(names.some((name) => name.includes('almoco')));
    assert.ok(names.some((name) => name.includes('jantar')));
    assert.ok(!names.some((name) => /pre-treino|pos-treino/.test(name)));

    result.plan.refeicoes.forEach((meal) => {
      const proteinFoods = meal.itens.filter((item) => Number(item.proteinas || 0) >= 6);
      assert.ok(proteinFoods.length >= 1, meal.nome + ' precisa manter proteína');
    });
  });
});

test('dietService returns safe failsafe response when critical profile data is missing', async () => {
  const result = await dietService.execute('GENERATE_DIET', {
    objetivo: 'hipertrofia',
    peso: 80,
  });

  assert.equal(result.domain, 'diet');
  assert.equal(result.success, false);
  assert.equal(result.errorCode, 'DIET_INPUT_INVALID');
  assert.equal(result.payload.plan.failSafe, true);
  assert.ok(Array.isArray(result.payload.plan.refeicoes));
  assert.ok(result.payload.plan.refeicoes.length >= 3);
  assert.deepEqual(result.payload.validation.missingFields, ['sexo', 'idade', 'altura']);
  assert.equal(result.payload.validation.generatedFromFallback, true);
  assert.match(result.message, /fallback seguro|complete os dados ausentes/i);
});

test('nutritionService ativa modo clínico e remove alimentos incoerentes para potássio alto', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'F',
    idade: 34,
    peso: 70,
    altura: 168,
    objetivo: 'manutencao',
    refeicoesPorDia: 5,
    padraoAlimentar: 'onívoro',
    labContext: {
      id: 'lab-1',
      isValid: true,
      mode: 'clinical',
      parsed: {
        glucose: 94,
        hba1c: 5.4,
        creatinine: 0.9,
        potassium: 5.3,
        sodium: 139,
        cholesterol_total: 180,
        hdl: 52,
        ldl: 110,
        triglycerides: 100,
      },
      clinicalFlags: ['high_potassium'],
      criticalFlags: [],
    },
  });

  assert.equal(result.failSafe, false);
  assert.equal(result.clinicalContext.mode, 'clinical');
  const foods = result.plan.refeicoes.flatMap((meal) => meal.itens.map((item) => normalizeText(item.nome)));
  assert.ok(!foods.some((name) => /banana|abacate|batata-doce/.test(name)));
  assert.ok(result.clinicalNotes.some((note) => /exame recente/i.test(note)));
});

test('nutritionService mantém plano conservador quando há flag crítica laboratorial', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'M',
    idade: 42,
    peso: 88,
    altura: 180,
    objetivo: 'hipertrofia',
    refeicoesPorDia: 4,
    labContext: {
      id: 'lab-2',
      isValid: true,
      mode: 'clinical',
      parsed: {
        glucose: 132,
        hba1c: 6.6,
        creatinine: 1.1,
        potassium: 4.7,
        sodium: 140,
        cholesterol_total: 210,
        hdl: 45,
        ldl: 135,
        triglycerides: 150,
      },
      clinicalFlags: ['pre_diabetes', 'glycemic_risk', 'high_ldl'],
      criticalFlags: ['hyperglycemia_alert', 'hba1c_alert'],
    },
  });

  assert.equal(result.failSafe, false);
  assert.equal(result.clinicalContext.mode, 'clinical');
  assert.ok(result.calculation.targetCalories <= Math.round(result.calculation.get));
  assert.ok(result.clinicalNotes.some((note) => /modo conservador/i.test(note)));
});

test('dietService refeicoes have substituicoes.opcoes as readable strings, not raw objects', async () => {
  const result = await dietService.execute('GENERATE_DIET', {
    sexo: 'M',
    idade: 30,
    peso: 80,
    altura: 178,
    objetivo: 'hipertrofia',
    refeicoesPorDia: 4,
    padraoAlimentar: 'onívoro',
  });

  assert.equal(result.payload.plan.failSafe, false);
  const refeicoes = result.payload.plan.refeicoes;
  assert.ok(refeicoes.length > 0);

  refeicoes.forEach((ref) => {
    (ref.substituicoes || []).forEach((sub) => {
      (sub.opcoes || []).forEach((opcao) => {
        assert.equal(
          typeof opcao,
          'string',
          `substituicao opcao deve ser string legível, recebeu ${typeof opcao}: ${JSON.stringify(opcao)}`,
        );
      });
    });
  });
});

test('normalizeDietPayload returns null nutritionGoals when no goals are present in input', () => {
  const result = dietService.normalizeDietPayload({
    sexo: 'M',
    idade: 30,
    peso: 80,
    altura: 178,
    objetivo: 'hipertrofia',
  });

  assert.equal(result.nutritionGoals, null,
    'deve retornar null, não { calories_target: undefined, ... } com chaves fantasma');
});

test('normalizeDietPayload preserves supabase calories_target in nutritionGoals', () => {
  const result = dietService.normalizeDietPayload({
    sexo: 'M',
    idade: 30,
    peso: 80,
    altura: 178,
    objetivo: 'hipertrofia',
    supabaseSnapshot: {
      nutritionGoals: { calories_target: 2300, protein_g: 150 },
    },
  });

  assert.ok(result.nutritionGoals !== null, 'nutritionGoals deve ser não-nulo quando supabase tem metas');
  assert.equal(result.nutritionGoals.calories_target, 2300);
  assert.equal(result.nutritionGoals.protein_g, 150);
});

test('nutritionService usa renderer enterprise sem quebrar contrato do plano', () => {
  const result = nutritionService.generateNutritionPlan({
    sexo: 'M',
    idade: 30,
    peso: 80,
    altura: 178,
    objetivo: 'hipertrofia',
    nutritionMemory: {
      preferred_diet_style: 'flexivel',
      adherence_days: 3,
    },
  });

  assert.equal(result.failSafe, false);
  assert.equal(result.enterpriseAi.enabled, true);
  assert.equal(result.enterpriseAi.renderer, 'enterprise_diet_prescription_renderer');
  assert.equal(result.enterpriseAi.adaptive_ai, true);
  assert.ok(Array.isArray(result.enterpriseAi.recommendations));
  assert.equal(result.plan.enterpriseAi.renderer, 'enterprise_diet_prescription_renderer');
  assert.ok(Array.isArray(result.plan.refeicoes));
  assert.ok(result.plan.refeicoes.length > 0);
});

if (typeof globalThis.test === 'function' && globalThis.test !== test) {
  globalThis.test('diet-service node:test suite compatibility', () => {
    assert.equal(typeof nutritionService.generateNutritionPlan, 'function');
  });
}
