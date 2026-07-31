import { defineConfig } from 'vitest/config'

// Unit-test + coverage config. Coverage is scoped to the pure business-logic
// modules (bonding-curve math, formatters, and the RBAC approved-role decision)
// and the thresholds below FAIL the build when breached — this is the enforced
// coverage gate the CI "Tests" job runs (`vitest run --coverage`).
export default defineConfig({
  test: {
    // Frontend unit tests live under src/; backend pure logic (rbac) is tested
    // under backend/. Both run in the node environment below.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'backend/**/*.{test,spec}.ts'],
    environment: 'node',
    reporters: ['default', 'junit'],
    outputFile: { junit: './test-results/junit.xml' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/lib/bondingCurve.ts', 'src/lib/format.ts', 'backend/src/rbac.ts'],
      thresholds: {
        lines: 95,
        functions: 100,
        branches: 85,
        statements: 95,
      },
    },
  },
})
