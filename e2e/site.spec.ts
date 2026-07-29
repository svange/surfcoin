import { test, expect } from '@playwright/test'

// Smoke-level browser e2e against the deployed site. These replace the raw
// `curl` HTTP-code checks with a real browser that records video/trace evidence.

test('marketing home page renders', async ({ page }) => {
  const res = await page.goto('/')
  expect(res, 'navigation response').toBeTruthy()
  expect(res!.status(), 'home HTTP status').toBeLessThan(400)
  await expect(page).toHaveTitle(/surf/i)
  // The hero copy is the site's headline promise — proves React mounted.
  await expect(page.getByText(/expectations down/i).first()).toBeVisible()
})

test('playground route loads the SPA shell', async ({ page }) => {
  const res = await page.goto('/playground')
  expect(res, 'navigation response').toBeTruthy()
  // CloudFront rewrites unknown paths to index.html (200), so the SPA router
  // owns /playground — a hard 404/5xx here means the deploy is broken.
  expect(res!.status(), 'playground HTTP status').toBeLessThan(400)
  await expect(page.locator('#root')).toBeVisible()
})
