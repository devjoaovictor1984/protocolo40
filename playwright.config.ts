import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// os testes precisam das credenciais reais para criar e apagar usuários
if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

/**
 * Testes de ponta a ponta.
 *
 * Mobile-first também aqui: o projeto padrão é um telefone, porque é onde o
 * P20X é realmente usado — durante o treino, com uma mão.
 *
 * Na primeira execução, instale os navegadores: `npx playwright install`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
