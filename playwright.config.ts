import { defineConfig, devices } from '@playwright/test'

// Post-deploy browser e2e. Runs against the LIVE deployed site (SITE_URL is
// injected by the CI e2e job from the deploy stack output); defaults to the
// production domain for local runs. Every test records a video; traces are kept
// for failing runs, which is exactly when a scrubbable timeline matters. The
// HTML report is published to GitHub Pages by the workflow (see deploy.yaml).
const baseURL = process.env.SITE_URL || 'https://surfcoin.fail'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    video: 'on',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
