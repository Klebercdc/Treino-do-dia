import { expect, test } from '@playwright/test';

async function bootApp(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForSelector('#splashScreen', { state: 'hidden', timeout: 12_000 }).catch(() => {});
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
    localStorage.removeItem('kronia_last_generated_diet');
    localStorage.removeItem('kronia_diet_wizard_state_v6_standalone');
  });
}

async function openStandaloneWizard(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const runtime = window as Window & {
      KroniaDiet?: { createPlan?: () => Promise<unknown> | unknown };
      openDietProfileWizard?: (userId?: string | null, opts?: Record<string, unknown>) => unknown;
    };
    if (runtime.KroniaDiet?.createPlan) await runtime.KroniaDiet.createPlan();
    else runtime.openDietProfileWizard?.(null, { forceNew: true, source: 'diet_post_generation_e2e' });
  });
  await expect(page.locator('#dietProfileWizardScreen')).toBeVisible();
}

async function completeBodyStep(page: import('@playwright/test').Page) {
  const wizard = page.locator('#dietProfileWizardScreen');
  await wizard.locator('[name="age"]').fill('30');
  await wizard.locator('[name="weight_kg"]').fill('80');
  await wizard.locator('[name="height_cm"]').fill('180');
  await wizard.locator('[name="body_fat_percent"]').fill('18');
  await wizard.locator('#kdwNext').click();
}

async function completeGoalStep(page: import('@playwright/test').Page) {
  const wizard = page.locator('#dietProfileWizardScreen');
  await wizard.locator('.kdw-chip[data-group="objective"][data-value="hipertrofia"]').click();
  await wizard.locator('.kdw-chip[data-group="strategy"][data-value="moderada"]').click();
  await wizard.locator('[name="meals"]').selectOption('4');
  await wizard.locator('#kdwNext').click();
}

async function advanceOptionalStepsToFinal(page: import('@playwright/test').Page) {
  const wizard = page.locator('#dietProfileWizardScreen');
  await wizard.locator('#kdwNext').click();
  await wizard.locator('#kdwNext').click();
  await wizard.locator('#kdwNext').click();
}

test.describe('Diet post-generation contract', () => {
  test('generated diet lands on final visual plan and never returns to Perfil base', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.route('**/api/kronia/diet/generate', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'forced fallback' }),
      });
    });
    await page.route('**/api/kronia/diet', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'forced fallback' }),
      });
    });

    await bootApp(page);
    await openStandaloneWizard(page);
    await completeBodyStep(page);
    await completeGoalStep(page);
    await advanceOptionalStepsToFinal(page);

    await page.locator('#dietProfileWizardScreen #kdwNext').click();

    await expect.poll(async () => page.evaluate(() => ({
      wizardVisible: document.getElementById('dietProfileWizardScreen')?.classList.contains('kdw-screen') === true,
      visualVisible: document.getElementById('kroniaDietPlanVisualScreen')?.classList.contains('kdp-screen') === true,
      hasLastPlan: Boolean(localStorage.getItem('kronia_last_generated_diet')),
      hasWizardState: Boolean(localStorage.getItem('kronia_diet_wizard_state_v6_standalone')),
      completed: (window as Window & { __kroniaDietGenerationCompleted?: boolean }).__kroniaDietGenerationCompleted === true,
      nutritionVisible: document.getElementById('nutritionFlowScreen')?.classList.contains('show') === true,
      visiblePerfilBase: Array.from(document.querySelectorAll('body *')).some((el) => {
        const text = el.textContent || '';
        if (!/Perfil base/i.test(text)) return false;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
      }),
    })), { timeout: 8_000 }).toMatchObject({
      wizardVisible: false,
      visualVisible: true,
      hasLastPlan: true,
      hasWizardState: false,
      completed: true,
      nutritionVisible: false,
      visiblePerfilBase: false,
    });

    await expect(page.locator('#kroniaDietPlanVisualScreen')).toBeVisible();
    await expect(page.locator('#kroniaDietPlanVisualScreen')).toContainText(/Dieta gerada|Plano alimentar|Refeições de hoje/);
    await expect(page.locator('#dietProfileWizardScreen')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('health step exams button is clickable without pageerror and preserves wizard state', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await bootApp(page);
    await openStandaloneWizard(page);
    await completeBodyStep(page);
    await completeGoalStep(page);

    await expect(page.locator('#dietProfileWizardScreen')).toContainText('Saúde, patologias e exames');
    await expect(page.locator('#dietProfileWizardScreen [data-action="open-labs"]')).toBeVisible();

    await page.evaluate(() => {
      const runtime = window as unknown as Window & Record<string, unknown>;
      [
        'openLabsSheet',
        'openExamsScreen',
        'openLabExams',
        'openCheckupsScreen',
        'openMedicalExamsScreen',
        'openUserExams',
        'openLabsScreen',
        'openLabsUploadScreen',
      ].forEach((name) => { runtime[name] = undefined; });
      runtime.__dietLabsToast = null;
      runtime.showToast = (message: string) => { runtime.__dietLabsToast = message; };
    });

    await page.locator('#dietProfileWizardScreen [data-action="open-labs"]').click();

    await expect.poll(async () => page.evaluate(() => ({
      wizardVisible: document.getElementById('dietProfileWizardScreen')?.classList.contains('kdw-screen') === true,
      current: (window as Window & { __kroniaDietWizardState?: { current?: number } }).__kroniaDietWizardState?.current,
      stateSaved: Boolean(localStorage.getItem('kronia_diet_wizard_state_v6_standalone')),
      toast: (window as Window & { __dietLabsToast?: string }).__dietLabsToast || '',
    }))).toEqual({
      wizardVisible: true,
      current: 2,
      stateSaved: true,
      toast: 'Nenhum módulo de exames encontrado ainda. Seus exames carregados serão considerados quando disponíveis.',
    });
    expect(pageErrors).toEqual([]);
  });
});
