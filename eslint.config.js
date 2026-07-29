import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// Flat ESLint config — the static-analysis leg of the CI merge gate.
// Runs in the "Code quality" job; a lint error fails that required check.
export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'backend/dist',
      'playwright-report',
      'test-results',
      'node_modules',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    rules: {
      // Surfaces genuine mistakes; `_`-prefixed args are intentionally unused.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Deliberate state resets on dependency change (e.g. dropping stale query
      // data when the selected coin changes) trip this newer rule. Keep it as a
      // signal, not a hard gate — the codebase has no test net to catch a
      // refactor regression, and rules-of-hooks/exhaustive-deps stay in force.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  // Node contexts: backend Lambda, build/test config, and scripts.
  {
    files: [
      'backend/**/*.ts',
      '*.config.{ts,js}',
      'scripts/**/*.{ts,js}',
      'e2e/**/*.ts',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
)
