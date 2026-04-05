import { expect, test } from '@playwright/test';

async function waitForSplash(page: import('@playwright/test').Page) {
  await page.waitForSelector('#splashScreen', {
    state: 'hidden',
    timeout: 12_000,
  }).catch(() => {});
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
  await page.click('#aiFloatBtn');
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

  test('chat CTA opens diet sheet', async ({ page }) => {
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

    const cta = page.locator('.kronia-cta', { hasText: 'Abrir dieta' }).last();
    await expect(cta).toBeVisible();
    await cta.click();

    await expect.poll(async () => {
      return page.evaluate(() => document.getElementById('dietaSheet')?.classList.contains('show') === true);
    }).toBe(true);
  });

  test('diet API failure keeps UI responsive and shows error text', async ({ page }) => {
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
      return page.evaluate(() => document.getElementById('dietaSheet')?.classList.contains('show') === true);
    }).toBe(true);

    await page.fill('#dietaPeso', '80');
    await page.fill('#dietaAltura', '180');
    await page.fill('#dietaIdade', '30');
    await page.fill('#dietaRefeicoes', '4');
    await page.fill('#dietaPrefs', 'frango, ovo');

    await page.click('#btnGerarDieta');

    await expect(page.locator('#dietaResultado')).toBeVisible();
    await expect(page.locator('#dietaTexto')).toContainText(/não consegui|erro|tente novamente/i);
    await expect(page.locator('#btnGerarDieta')).toBeEnabled();
  });
});
