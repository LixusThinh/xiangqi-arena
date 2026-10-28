import { defineConfig, devices } from '@playwright/test';

/**
 * E2E luồng MVP (XQA-108). Cần backend (cổng 3000, PostgreSQL thật) và web (cổng 3001) đang chạy;
 * trên CI do .github/workflows/e2e.yml dựng. Chạy tay: xem apps/e2e/README.md.
 * AC2: trace + video + screenshot được giữ lại khi test fail (upload artifact trên CI).
 */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3001',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1366, height: 768 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } }],
});
