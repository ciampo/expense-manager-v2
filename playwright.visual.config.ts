import { defineConfig, devices } from '@playwright/test'

/**
 * Visual regression testing configuration.
 * Run in Docker for consistent screenshots across environments.
 */
export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Sequential for consistent screenshots
  reporter: [['html', { outputFolder: 'playwright-report-visual' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm run dev:e2e',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      // Use pixel count instead of ratio for stricter control
      // Allow ~50 pixels for minor anti-aliasing differences
      maxDiffPixels: 50,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
