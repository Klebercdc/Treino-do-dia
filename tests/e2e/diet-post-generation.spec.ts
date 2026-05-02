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
    localStorage.removeItem('kronia_diet_wizard_state_v1');
    localStorage.removeItem('kronia_diet_wizard_state_v2');
    localStorage.removeItem('kronia_diet_wizard_state_v6_standalone');
  });
}

test.describe('Diet legacy profile wizard removal', () => {
  test('legacy profile wizard entry redirects to premium diet and does not create old DOM', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await bootApp(page);
    await page.evaluate(() => {
      localStorage.setItem('kronia_diet_wizard_state_v1', JSON.stringify({ stale: true }));
      localStorage.setItem('kronia_diet_wizard_state_v2', JSON.stringify({ stale: true }));
      const runtime = window as Window & {
        openDietProfileWizard?: (userId?: string | null, opts?: Record<string, unknown>) => unknown;
      };
      runtime.openDietProfileWizard?.(null, { forceNew: true, source: 'diet_legacy_removed_e2e' });
    });

    await expect.poll(async () => page.evaluate(() => ({
      wizardCount: document.querySelectorAll('#dietProfileWizardScreen').length,
      dietTab: document.getElementById('nav-dieta')?.classList.contains('active') === true,
      dietData: document.getElementById('dietDataScreen')?.classList.contains('show') === true,
      nutritionFlow: document.getElementById('nutritionFlowScreen')?.classList.contains('show') === true,
      stateV1: localStorage.getItem('kronia_diet_wizard_state_v1'),
      stateV2: localStorage.getItem('kronia_diet_wizard_state_v2'),
      bodyLocked: document.body.classList.contains('diet-wizard-active') || document.body.classList.contains('kdw-active'),
      visibleProfileBase: /Perfil base/i.test(document.body.innerText || ''),
    }))).toEqual({
      wizardCount: 0,
      dietTab: true,
      dietData: true,
      nutritionFlow: false,
      stateV1: null,
      stateV2: null,
      bodyLocked: false,
      visibleProfileBase: false,
    });
    await expect(page.locator('#dietDataScreen')).toContainText(/Plano alimentar|Minha Dieta|Dieta com IA/);
    expect(pageErrors).toEqual([]);
  });

  test('diet create action starts clean without old profile wizard state', async ({ page }) => {
    await bootApp(page);
    await page.evaluate(async () => {
      localStorage.setItem('kronia_diet_wizard_state_v1', JSON.stringify({ stale: true }));
      localStorage.setItem('kronia_diet_wizard_state_v2', JSON.stringify({ stale: true }));
      const runtime = window as Window & { KroniaDiet?: { createPlan?: () => Promise<unknown> | unknown } };
      await runtime.KroniaDiet?.createPlan?.();
    });

    await expect.poll(async () => page.evaluate(() => ({
      wizardCount: document.querySelectorAll('#dietProfileWizardScreen').length,
      dietData: document.getElementById('dietDataScreen')?.classList.contains('show') === true,
      stateV1: localStorage.getItem('kronia_diet_wizard_state_v1'),
      stateV2: localStorage.getItem('kronia_diet_wizard_state_v2'),
    }))).toEqual({
      wizardCount: 0,
      dietData: true,
      stateV1: null,
      stateV2: null,
    });
  });
});
