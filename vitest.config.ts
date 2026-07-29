import { defineConfig } from 'vitest/config'

// Unit-test + coverage config. Coverage is scoped to the pure business-logic
// modules (bonding-curve math, formatters) and the thresholds below FAIL the
// build when breached — this is the enforced coverage gate the CI "Tests" job
// runs (`vitest run --coverage`).
export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',
    reporters: ['default', 'junit'],
    outputFile: { junit: './test-results/junit.xml' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/lib/bondingCurve.ts', 'src/lib/format.ts'],
      thresholds: {
        lines: 95,
        functions: 100,
        branches: 85,
        statements: 95,
      },
    },
  },
})
