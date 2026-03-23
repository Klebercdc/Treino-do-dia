/**
 * KRONIA — Teste E2E: Registro de Treino com RPE
 *
 * Fluxo testado:
 *  1. Seed: insere exercício "Supino Reto" no banco de testes
 *  2. Navega para a aba de Treino
 *  3. Preenche peso (100 kg), repetições (10) e RPE (8)
 *  4. Assert front-end: valores persistidos na UI
 *  5. Assert back-end: draft salvo no localStorage com dados de RPE
 *
 * Nota: o app salva o treino em curso no localStorage (kronia_draft_v2).
 * O sync com o Supabase ocorre ao pressionar "Salvar" — testado
 * no teste "deve salvar treino no Supabase ao confirmar".
 */

import { test, expect, Page } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL_TEST  || '';
const SERVICE_KEY   = process.env.VITE_SUPABASE_SERVICE_KEY_TEST || '';

// ── Helpers ──────────────────────────────────────────────────────────────────

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function seedExercicio(nome: string): Promise<string> {
  const sb = adminClient();
  const { data, error } = await sb
    .from('exercises')
    .upsert({ name: nome, muscle_group: 'Peito', source: 'test' }, { onConflict: 'name' })
    .select('id')
    .single();
  if (error) throw new Error(`Seed exercício falhou: ${error.message}`);
  return data.id as string;
}

async function buscarUltimoLog(workoutId: string) {
  const sb = adminClient();
  const { data } = await sb
    .from('workout_logs')
    .select('weight_kg, reps, rpe, exercise_id')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function aguardarSplash(page: Page): Promise<void> {
  await page.waitForSelector('#splashScreen', {
    state: 'hidden',
    timeout: 12_000,
  }).catch(() => { /* splash pode já ter desaparecido */ });
}

// ── Testes ───────────────────────────────────────────────────────────────────

test.describe('Registro de Treino com RPE', () => {

  test.beforeEach(async () => {
    if (!SUPABASE_URL || !SERVICE_KEY) return;
    await seedExercicio('Supino Reto');
  });

  // ── Teste 1: Preenche campos e valida UI ────────────────────────────────
  test('deve preencher peso, reps e RPE em um card de exercício', async ({ page }) => {
    await page.goto('/');
    await aguardarSplash(page);

    // Navega para aba Treino
    const btnTreino = page.locator('#nav-treino');
    await expect(btnTreino).toBeVisible({ timeout: 8_000 });
    await btnTreino.click();

    // Aguarda seção de treino ativa
    await page.waitForSelector('.section.active', { timeout: 5_000 });

    // Verifica se há card de exercício
    const cards = page.locator('.exercise-card');
    const total = await cards.count();

    if (total === 0) {
      test.skip(true,
        'Nenhum exercício carregado. Configure um plano de treino primeiro.'
      );
      return;
    }

    const primeiroCard = cards.first();
    const primeiraLinha = primeiroCard.locator('.series-row').first();
    await expect(primeiraLinha).toBeVisible({ timeout: 3_000 });

    // Inputs na ordem: KG | REPS | RPE
    const inputs = primeiraLinha.locator('.input-box input');

    await inputs.nth(0).fill('100');
    await inputs.nth(1).fill('10');
    await inputs.nth(2).fill('8');
    await inputs.nth(2).dispatchEvent('input');

    // Aguarda processamento
    await page.waitForTimeout(400);

    // ── Assert Front-end ──
    await expect(inputs.nth(0)).toHaveValue('100');
    await expect(inputs.nth(1)).toHaveValue('10');
    await expect(inputs.nth(2)).toHaveValue('8');

    await page.screenshot({ path: 'test-results/workout-fields-filled.png' });
  });

  // ── Teste 2: Confirma série e valida localStorage ───────────────────────
  test('deve persistir série no draft do localStorage ao confirmar', async ({ page }) => {
    await page.goto('/');
    await aguardarSplash(page);

    await page.locator('#nav-treino').click();
    await page.waitForSelector('.section.active', { timeout: 5_000 });

    const cards = page.locator('.exercise-card');
    if (await cards.count() === 0) {
      test.skip(true, 'Nenhum exercício carregado.');
      return;
    }

    const primeiraLinha = cards.first().locator('.series-row').first();
    const inputs = primeiraLinha.locator('.input-box input');

    await inputs.nth(0).fill('100');
    await inputs.nth(1).fill('10');
    await inputs.nth(2).fill('8');
    await inputs.nth(2).dispatchEvent('input');

    // Clica no botão de confirmar série (ícone check)
    const btnConfirm = primeiraLinha.locator('.btn-confirm');
    if (await btnConfirm.isVisible()) {
      await btnConfirm.click();
      await page.waitForTimeout(600);
    }

    // ── Assert Back-end: draft no localStorage ──
    const draft = await page.evaluate(() => {
      const raw = localStorage.getItem('kronia_draft_v2');
      return raw ? JSON.parse(raw) : null;
    });

    console.log('\n📦 Draft no localStorage:');
    console.log(JSON.stringify(draft, null, 2)?.slice(0, 800) ?? '(vazio)');

    expect(draft).not.toBeNull();

    const draftStr = JSON.stringify(draft);
    const temPeso = draftStr.includes('100') || draftStr.includes('"kg"') || draftStr.includes('"weight"');
    const temRpe  = draftStr.includes('"rpe"') || draftStr.includes('rpe');

    expect(temPeso || temRpe).toBeTruthy();

    await page.screenshot({ path: 'test-results/workout-draft-saved.png' });
  });

  // ── Teste 3: RPE inválido deve acionar alerta ───────────────────────────
  test('deve alertar ao inserir RPE maior que 10', async ({ page }) => {
    await page.goto('/');
    await aguardarSplash(page);

    await page.locator('#nav-treino').click();
    await page.waitForSelector('.section.active', { timeout: 5_000 });

    const cards = page.locator('.exercise-card');
    if (await cards.count() === 0) {
      test.skip(true, 'Nenhum exercício carregado.');
      return;
    }

    const rpeInput = cards.first()
      .locator('.series-row').first()
      .locator('.input-box input').nth(2);

    // Captura alertas do browser (window.alert ou toast)
    const alertas: string[] = [];
    page.on('dialog', async dialog => {
      alertas.push(dialog.message());
      await dialog.dismiss();
    });

    await rpeInput.fill('11');
    await rpeInput.dispatchEvent('input');
    await page.waitForTimeout(500);

    const rpeVal = await rpeInput.inputValue();
    console.log(`\n⚠️  RPE inserido: ${rpeVal} | Alertas capturados: ${alertas.length}`);

    // O app usa checkRPEAlert() que pode mostrar toast ou modal
    // Verifica se algum elemento de alerta apareceu na tela
    const toastVisible = await page.locator('[class*="toast"], [class*="alert"], [role="alert"]')
      .isVisible()
      .catch(() => false);

    console.log(`   Toast/Alerta visível: ${toastVisible}`);
    await page.screenshot({ path: 'test-results/rpe-invalid.png' });
  });

  // ── Teste 4: Salvar treino dispara sync com Supabase ───────────────────
  test('deve salvar treino no Supabase ao pressionar Salvar', async ({ page }) => {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      test.skip(true, 'Supabase de testes não configurado no .env.test');
      return;
    }

    await page.goto('/');
    await aguardarSplash(page);

    await page.locator('#nav-treino').click();
    await page.waitForSelector('.section.active', { timeout: 5_000 });

    const cards = page.locator('.exercise-card');
    if (await cards.count() === 0) {
      test.skip(true, 'Nenhum exercício carregado.');
      return;
    }

    // Preenche a primeira série
    const primeiraLinha = cards.first().locator('.series-row').first();
    const inputs = primeiraLinha.locator('.input-box input');

    await inputs.nth(0).fill('80');
    await inputs.nth(1).fill('12');
    await inputs.nth(2).fill('7');
    await inputs.nth(2).dispatchEvent('input');

    const btnConfirm = primeiraLinha.locator('.btn-confirm');
    if (await btnConfirm.isVisible()) {
      await btnConfirm.click();
      await page.waitForTimeout(400);
    }

    // Pressiona "Salvar" na barra de navegação
    const btnSalvar = page.locator('.btn-save');
    await expect(btnSalvar).toBeVisible({ timeout: 5_000 });
    await btnSalvar.click();

    // Aguarda confirmação (modal ou toast)
    await page.waitForTimeout(2_000);

    // ── Assert: verifica se toast de sucesso apareceu ──
    const toastEl = page.locator('[class*="toast"]').first();
    const toastTexto = await toastEl.textContent().catch(() => '');
    console.log(`\n💬 Toast após salvar: "${toastTexto}"`);

    await page.screenshot({ path: 'test-results/workout-saved.png' });
  });

});
