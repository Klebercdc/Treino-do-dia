import { expect, test } from '@playwright/test';

async function waitForSplash(page: import('@playwright/test').Page) {
  await page.waitForSelector('#splashScreen', {
    state: 'hidden',
    timeout: 12_000,
  }).catch(() => {});
  await page.evaluate(() => {
    const login = document.getElementById('loginScreen');
    const email = document.getElementById('emailLoginScreen');
    const home = document.getElementById('homeScreen');
    if (login) {
      login.style.display = 'none';
      login.style.pointerEvents = 'none';
    }
    if (email) {
      email.classList.remove('show');
      email.style.pointerEvents = 'none';
    }
    if (home) home.classList.add('show');
  });
}

async function installDietCatalog(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    (window as Window & { KRONIA_PREMIUM_FOOD_CATALOG?: unknown; _dietCatalogIndexCache?: unknown }).KRONIA_PREMIUM_FOOD_CATALOG = {
      foods: [
        {
          id: 'frango_grelhado',
          slug: 'frango_grelhado',
          display_name_pt: 'Frango grelhado',
          canonical_name_pt: 'Frango grelhado',
          group_key: 'proteinas',
          default_portion_g: 120,
          default_unit: '120 g',
          kcal_100g: 165,
          protein_100g: 31,
          carbs_100g: 0,
          fat_100g: 3.6,
          fiber_100g: 0,
          sodium_mg_100g: 35,
          source: 'premium',
        },
        {
          id: 'arroz_cozido',
          slug: 'arroz_cozido',
          display_name_pt: 'Arroz cozido',
          canonical_name_pt: 'Arroz cozido',
          group_key: 'carboidratos',
          default_portion_g: 120,
          default_unit: '120 g',
          kcal_100g: 130,
          protein_100g: 2.5,
          carbs_100g: 28,
          fat_100g: 0.3,
          fiber_100g: 0.4,
          sodium_mg_100g: 35,
          source: 'premium',
        },
        {
          id: 'feijao_cozido',
          slug: 'feijao_cozido',
          display_name_pt: 'Feijão cozido',
          canonical_name_pt: 'Feijão cozido',
          group_key: 'carboidratos',
          default_portion_g: 100,
          default_unit: '100 g',
          kcal_100g: 76,
          protein_100g: 4.8,
          carbs_100g: 13.6,
          fat_100g: 0.5,
          fiber_100g: 8.5,
          sodium_mg_100g: 35,
          source: 'premium',
        },
      ],
      aliases: [
        { food_slug: 'frango_grelhado', alias: 'Frango grelhado', normalized_alias: 'frango grelhado' },
        { food_slug: 'arroz_cozido', alias: 'Arroz cozido', normalized_alias: 'arroz cozido' },
        { food_slug: 'feijao_cozido', alias: 'Feijão cozido', normalized_alias: 'feijao cozido' },
      ],
    };
    (window as Window & { _dietCatalogIndexCache?: unknown })._dietCatalogIndexCache = null;
  });
}

async function dismissUnexpectedTrainingDialog(page: import('@playwright/test').Page) {
  const dialog = page.locator('text=Treino gerado!');
  if (await dialog.isVisible().catch(() => false)) {
    const dismissButton = page.getByText('Cancelar').or(page.getByText('Confirmar')).first();
    await dismissButton.click().catch(() => {});
  }
}

async function expandFirstDietMeal(page: import('@playwright/test').Page) {
  const firstMealBody = page.locator('#dietDataScreen .tp-meal-body').first();
  const bodyClass = await firstMealBody.getAttribute('class').catch(() => '');
  if (!bodyClass?.includes('tp-meal-body--open')) {
    await page.locator('#dietDataScreen .tp-meal-header-card').first().click();
    await expect(firstMealBody).toHaveClass(/tp-meal-body--open/);
  }
}

test('diet runtime updates UI, visualPrescription and persistence after grams edit', async ({ page }) => {
  await page.route('**/api/science', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, science: [] }),
    });
  });

  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          content: [{
            type: 'diet_result',
            data: {
              objetivo: 'hipertrofia',
              meta: { calorias: 2200, proteina: 160, carbo: 220, gordura: 60, tmb: 1700, get: 2600 },
              resumoDiario: { calorias: 2200, proteinas: 160, carboidratos: 220, gorduras: 60 },
              macrosMeta: { protein: 160, carbs: 220, fat: 60 },
              visualPrescription: {
                dashboard: { subtitle: 'Plano de runtime validado' },
                summary: { kcal_total: 2200, proteina: 160, carbo: 220, gordura: 60 },
                meals: [],
                guidance: ['Concentre carboidratos perto do treino'],
                reasons: ['Proteínas distribuídas ao longo do dia'],
                observation: 'Plano de teste para validação visual',
              },
              hidratacao: { litros: 3 },
              observacoes: ['Plano gerado para validação e2e.'],
              refeicoes: [{
                nome: 'Almoço',
                horario: '12:30',
                alimentos: [
                  { nome: 'Frango grelhado', food_slug: 'frango_grelhado', gramas: 100, porcao: '100 g', calorias: 999, proteinas: 999, carboidratos: 999, gorduras: 999 },
                  { nome: 'Arroz cozido', food_slug: 'arroz_cozido', gramas: 150, porcao: '150 g', calorias: 999, proteinas: 999, carboidratos: 999, gorduras: 999 },
                  { nome: 'Feijão cozido', food_slug: 'feijao_cozido', gramas: 100, porcao: '100 g', calorias: 999, proteinas: 999, carboidratos: 999, gorduras: 999 },
                ],
              }],
            },
          }],
        },
      }),
    });
  });

  await page.goto('/');
  await waitForSplash(page);
  await installDietCatalog(page);

  await page.evaluate(() => {
    localStorage.clear();
    const runtime = window as Window & {
      openDietaSheet?: () => void;
      setNutritionFlowState?: (patch: Record<string, unknown>) => void;
      renderNutritionFlow?: () => void;
      NUTRITION_FLOW_STEPS?: Array<{ key: string }>;
    };
    runtime.openDietaSheet?.();
    const gerarStep = runtime.NUTRITION_FLOW_STEPS?.findIndex((item) => item.key === 'gerar') ?? 20;
    runtime.setNutritionFlowState?.({
      step: gerarStep,
      peso: '80',
      altura: '180',
      idade: '30',
      objetivo: 'Hipertrofia',
      refeicoesPorDia: 4,
      proteinas: ['Frango grelhado', 'Ovos', 'Whey protein'],
      carboidratos: ['Arroz', 'Feijão', 'Banana'],
      gorduras: ['Azeite de oliva', 'Abacate', 'Castanhas'],
      frutas: ['Banana', 'Maçã'],
      vegetais: ['Brócolis cozido', 'Salada verde'],
    });
    runtime.renderNutritionFlow?.();
  });

  await expect.poll(async () => {
    return page.evaluate(() => document.getElementById('nutritionFlowScreen')?.classList.contains('show') === true);
  }).toBe(true);

  await page.evaluate(async () => {
    const runtime = window as Window & { nutritionFlowGeneratePlan?: () => Promise<void> };
    if (typeof runtime.nutritionFlowGeneratePlan !== 'function') {
      throw new Error('nutritionFlowGeneratePlan indisponível');
    }
    await runtime.nutritionFlowGeneratePlan();
  });

  await expect.poll(async () => {
    return page.evaluate(() => ({
      dietData: document.getElementById('dietDataScreen')?.classList.contains('show') === true,
      nutritionFlow: document.getElementById('nutritionFlowScreen')?.classList.contains('show') === true,
      hasPlan: Boolean((window as Window & { _kroniaDietPlan?: unknown })._kroniaDietPlan),
    }));
  }).toEqual({ dietData: true, nutritionFlow: false, hasPlan: true });

  await expect(page.locator('#dietDataScreen')).toContainText('Almoço');
  await expect(page.locator('#dietDataScreen')).toContainText('Frango grelhado');
  await dismissUnexpectedTrainingDialog(page);
  await expandFirstDietMeal(page);
  await expect(page.locator('#dietDataScreen .diet-premium-food-qty').first()).toHaveText('100 g');

  const before = await page.evaluate(() => {
    const runtime = window as Window & { _kroniaDietPlan?: any };
    const plan = runtime._kroniaDietPlan;
    const firstItem = plan.meals[0].items[0];
    const firstMeal = plan.meals[0];
    const macroCards = Array.from(document.querySelectorAll('#dietDataScreen .tp-macro-val')).map((node) => (node.textContent || '').trim());
    const progressWidth = (document.querySelector('#dietDataScreen .tp-progress-fill') as HTMLElement | null)?.style.width || '';
    return {
      item: {
        grams: firstItem.grams,
        kcal: firstItem.kcal,
        protein: firstItem.protein,
      },
      mealSubtotal: firstMeal.subtotal,
      totals: plan.totals,
      visualSummary: plan.visualPrescription.summary,
      visualMeal: plan.visualPrescription.meals[0],
      macroCards,
      progressWidth,
    };
  });

  await page.locator('#dietDataScreen .diet-premium-food-row').first().click();
  await expect(page.locator('#bottomSheet.open')).toBeVisible();
  const plusButton = page.locator('#bottomSheet .diet-premium-quantity button').nth(1);
  for (let index = 0; index < 5; index += 1) {
    await plusButton.click();
  }
  await expect(page.locator('#bs-peso')).toHaveText('150');
  await page.locator('#bottomSheet .diet-premium-sheet-save').click();

  await expect(page.locator('#dietDataScreen .diet-premium-food-qty').first()).toHaveText('150 g');

  await expect.poll(async () => {
    return page.evaluate(() => {
      const runtime = window as Window & { _kroniaDietPlan?: any };
      return runtime._kroniaDietPlan?.meals?.[0]?.items?.[0]?.grams || null;
    });
  }).toBe(150);

  const after = await page.evaluate(() => {
    const runtime = window as Window & { _kroniaDietPlan?: any };
    const plan = runtime._kroniaDietPlan;
    const firstItem = plan.meals[0].items[0];
    const firstMeal = plan.meals[0];
    const macroCards = Array.from(document.querySelectorAll('#dietDataScreen .tp-macro-val')).map((node) => (node.textContent || '').trim());
    const progressWidth = (document.querySelector('#dietDataScreen .tp-progress-fill') as HTMLElement | null)?.style.width || '';
    const persisted = JSON.parse(localStorage.getItem('kronia_active_diet_plan_v2') || 'null');
    return {
      item: {
        grams: firstItem.grams,
        kcal: firstItem.kcal,
        protein: firstItem.protein,
      },
      mealSubtotal: firstMeal.subtotal,
      totals: plan.totals,
      visualSummary: plan.visualPrescription.summary,
      visualMeal: plan.visualPrescription.meals[0],
      macroCards,
      progressWidth,
      persisted: {
        grams: persisted?.meals?.[0]?.items?.[0]?.grams ?? null,
        visualProtein: persisted?.visualPrescription?.summary?.proteina ?? null,
        visualMealItem: persisted?.visualPrescription?.meals?.[0]?.items?.[0] ?? null,
      },
    };
  });

  expect(before.item.grams).toBe(100);
  expect(before.item.kcal).toBe(165);
  expect(before.item.protein).toBe(31);
  expect(before.mealSubtotal.kcal).toBe(436);
  expect(before.totals.kcal).toBe(436);

  expect(after.item.grams).toBe(150);
  expect(after.item.kcal).toBe(247.5);
  expect(after.item.protein).toBe(46.5);
  expect(after.mealSubtotal.kcal).toBe(519);
  expect(after.mealSubtotal.protein).toBe(55.1);
  expect(after.totals.kcal).toBe(519);
  expect(after.totals.protein).toBe(55.1);
  expect(after.totals.carbs).toBe(55.6);
  expect(after.visualSummary.kcal_total).toBe(519);
  expect(after.visualSummary.proteina).toBe(55.1);
  expect(after.visualMeal.kcal_estimada).toBe(519);
  expect(after.visualMeal.items[0]).toContain('Frango grelhado - 150 g');
  expect(after.persisted.grams).toBe(150);
  expect(after.persisted.visualProtein).toBe(55.1);
  expect(after.persisted.visualMealItem).toContain('Frango grelhado - 150 g');
  expect(after.macroCards[0]).toContain('519');
  expect(after.macroCards[1].replace(',', '.')).toContain('55.1');
  expect(after.progressWidth).toBe('24%');

  await page.reload();
  await waitForSplash(page);
  await page.evaluate(() => {
    const login = document.getElementById('loginScreen');
    const email = document.getElementById('emailLoginScreen');
    if (login) login.style.display = 'none';
    if (email) email.classList.remove('show');
    const runtime = window as Window & {
      navTo?: (tab: string) => void;
      openDietDataScreen?: () => void;
      KRONIA_PREMIUM_FOOD_CATALOG?: unknown;
      _dietCatalogIndexCache?: unknown;
    };
    runtime.KRONIA_PREMIUM_FOOD_CATALOG = runtime.KRONIA_PREMIUM_FOOD_CATALOG || {};
    runtime._dietCatalogIndexCache = null;
    runtime.navTo?.('dieta');
    runtime.openDietDataScreen?.();
  });

  await dismissUnexpectedTrainingDialog(page);
  await expandFirstDietMeal(page);
  await expect(page.locator('#dietDataScreen .diet-premium-food-qty').first()).toHaveText('150 g');
  await expect(page.locator('#dietDataScreen .tp-macro-val').first()).toContainText('519');

  const reloaded = await page.evaluate(() => {
    const runtime = window as Window & { _kroniaDietPlan?: any };
    const plan = runtime._kroniaDietPlan;
    const progressWidth = (document.querySelector('#dietDataScreen .tp-progress-fill') as HTMLElement | null)?.style.width || '';
    return {
      grams: plan.meals[0].items[0].grams,
      totals: plan.totals,
      visualSummary: plan.visualPrescription.summary,
      progressWidth,
    };
  });

  expect(reloaded.grams).toBe(150);
  expect(reloaded.totals.kcal).toBe(519);
  expect(reloaded.totals.protein).toBe(55.1);
  expect(reloaded.visualSummary.kcal_total).toBe(519);
  expect(reloaded.progressWidth).toBe('24%');
});
