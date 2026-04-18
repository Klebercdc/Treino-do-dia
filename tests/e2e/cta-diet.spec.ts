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
    if (login) login.style.display = 'none';
    if (email) email.classList.remove('show');
    if (home) home.classList.add('show');
  });
  await dismissCustomModal(page);
}

async function dismissCustomModal(page: import('@playwright/test').Page) {
  const cancel = page.locator('#customModal.show #cmNo');
  if (await cancel.count()) {
    await cancel.click({ force: true }).catch(() => {});
  }
}

async function mockAgentCta(
  page: import('@playwright/test').Page,
  action: 'open_training' | 'open_diet',
  label: string,
  payload: Record<string, unknown>,
  message: string,
) {
  await page.route('**/api/agent', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        type: 'chat_reply',
        message,
        data: { content: [{ type: 'text', text: message }] },
        conversationIntent: {
          eligible: true,
          type: action,
          target: action === 'open_training' ? 'home_training_card' : 'home_diet_card',
          label,
          source: 'agent',
          payload,
          meta: {},
        },
      }),
    });
  });
}

async function openAiAndSend(page: import('@playwright/test').Page, prompt: string) {
  await page.evaluate(() => {
    const login = document.getElementById('loginScreen');
    const email = document.getElementById('emailLoginScreen');
    if (login) login.style.display = 'none';
    if (email) email.classList.remove('show');
    const runtime = window as Window & { openAI?: () => void };
    runtime.openAI?.();
  });
  await page.fill('#aiInput', prompt);
  await page.click('#aiSendBtn');
}

test.describe('CTA and Diet flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/science', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          science: [],
        }),
      });
    });
  });

  test('chat CTA opens training config sheet', async ({ page }) => {
    await mockAgentCta(
      page,
      'open_training',
      'Abrir treino',
      { objective: 'hipertrofia', days_per_week: 4 },
      'Posso abrir seu treino agora.',
    );

    await page.goto('/');
    await waitForSplash(page);
    await openAiAndSend(page, 'quero um treino');

    const cta = page.locator('.kronia-cta', { hasText: 'Abrir treino' }).last();
    await expect(cta).toBeVisible();
    await cta.click();

    await expect.poll(async () => {
      return page.evaluate(() => document.getElementById('configSheet')?.classList.contains('show') === true);
    }).toBe(true);
  });

  test('chat CTA opens native diet flow', async ({ page }) => {
    await mockAgentCta(
      page,
      'open_diet',
      'Abrir dieta',
      { objective: 'hipertrofia', meals: 4 },
      'Posso abrir sua dieta agora.',
    );

    await page.goto('/');
    await waitForSplash(page);
    await openAiAndSend(page, 'quero uma dieta');

    const cta = page.locator('.kronia-cta').filter({ hasText: /Abrir dieta|Gerar dieta/ }).last();
    await expect(cta).toBeVisible();
    await cta.click();

    await expect.poll(async () => {
      return page.evaluate(() => document.getElementById('nutritionFlowScreen')?.classList.contains('show') === true);
    }).toBe(true);
    await expect(page.locator('#nutritionFlowBody')).toContainText('Dieta IA');
  });

  test('home diet card and bottom nav use the same diet CTA destination', async ({ page }) => {
    await page.goto('/');
    await waitForSplash(page);

    await page.locator('.home-hero-dieta').click();

    await expect.poll(async () => {
      return page.evaluate(() => ({
        dietTab: document.getElementById('nav-dieta')?.classList.contains('active') === true,
        dietData: document.getElementById('dietDataScreen')?.classList.contains('show') === true,
        nutritionFlow: document.getElementById('nutritionFlowScreen')?.classList.contains('show') === true,
      }));
    }).toEqual({ dietTab: true, dietData: true, nutritionFlow: true });

    await page.locator('.nutrition-flow-back').click();
    await expect.poll(async () => {
      return page.evaluate(() => ({
        dietTab: document.getElementById('nav-dieta')?.classList.contains('active') === true,
        dietData: document.getElementById('dietDataScreen')?.classList.contains('show') === true,
        nutritionFlow: document.getElementById('nutritionFlowScreen')?.classList.contains('show') === true,
      }));
    }).toEqual({ dietTab: true, dietData: true, nutritionFlow: false });

    await page.locator('#nav-inicio').click();
    await page.locator('#nav-dieta').click();

    await expect.poll(async () => {
      return page.evaluate(() => ({
        dietTab: document.getElementById('nav-dieta')?.classList.contains('active') === true,
        dietData: document.getElementById('dietDataScreen')?.classList.contains('show') === true,
        nutritionFlow: document.getElementById('nutritionFlowScreen')?.classList.contains('show') === true,
      }));
    }).toEqual({ dietTab: true, dietData: true, nutritionFlow: true });
  });

  test('diet generation keeps UI responsive and lands on today screen with fallback plan', async ({ page }) => {
    await page.route('**/api/kronia/diet', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          type: 'diet_result',
          message: 'API falhou',
          error: 'API falhou',
          data: { content: [] },
        }),
      });
    });

    await page.goto('/');
    await waitForSplash(page);

    await page.evaluate(() => {
      if (typeof (window as Window & { openDietaSheet?: () => void }).openDietaSheet === 'function') {
        (window as Window & { openDietaSheet?: () => void }).openDietaSheet?.();
      }
    });
    await expect.poll(async () => {
      return page.evaluate(() => document.getElementById('nutritionFlowScreen')?.classList.contains('show') === true);
    }).toBe(true);
    await dismissCustomModal(page);

    await page.evaluate(() => {
      const runtime = window as Window & {
        setNutritionFlowState?: (patch: Record<string, unknown>) => void;
        renderNutritionFlow?: () => void;
      };
      runtime.setNutritionFlowState?.({
        step: 20,
        peso: '80',
        altura: '180',
        idade: '30',
        refeicoesPorDia: 4,
        proteinas: ['Frango grelhado', 'Ovos', 'Whey protein'],
        carboidratos: ['Arroz', 'Feijão', 'Banana'],
        gorduras: ['Azeite de oliva', 'Abacate', 'Castanhas'],
        frutas: ['Banana', 'Maçã'],
        vegetais: ['Brócolis cozido', 'Salada verde'],
      });
      runtime.renderNutritionFlow?.();
    });

    await page.click('#nutritionFlowPrimary');

    await expect(page.locator('#nutritionFlowBody')).toContainText('Hoje');
    await expect(page.locator('#nutritionFlowBody')).toContainText(/Meta do dia|Proteína/);
    await expect(page.locator('#nutritionFlowPrimary')).toBeEnabled();
  });
});
