import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carrega .env.test antes de qualquer coisa
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // Banco de testes único — sem paralelismo para evitar race conditions
  fullyParallel: false,
  workers: 1,

  retries: process.env.CI ? 2 : 0,

  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // Global setup: limpa o banco antes de todos os testes
  globalSetup: require.resolve('./tests/utils/supabase-setup'),

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        // Injeta variáveis de ambiente de teste no contexto do browser via localStorage
        storageState: undefined,
      },
    },
  ],

  // Servidor local para os testes (roda `npm run serve` automaticamente)
  webServer: {
    command: 'npm run serve',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
