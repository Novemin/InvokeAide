import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['e2e/**/*.spec.ts', 'a11y/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html']] : [['list'], ['html']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-iPhone', use: { ...devices['iPhone 14'] } },
    { name: 'mobile-Android', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.CI
    ? {
        command: 'npm run build && npm run preview -- --port 5173',
        port: 5173,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : {
        command: 'npm run dev',
        port: 5173,
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
