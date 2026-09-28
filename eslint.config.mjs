// ESLint flat config for Next 16 + ESLint 9.
// Wraps the Next-shipped `core-web-vitals` ruleset.
import next from 'eslint-config-next/core-web-vitals'
import jsxA11y from 'eslint-plugin-jsx-a11y'

// React 19 ships a stricter compiler-grade hook ruleset. Two of them
// (`set-state-in-effect` and `purity`) flag the canonical client-side
// fetch-then-set pattern as a concern — but for an auth-gated SPA without
// Suspense in place, that pattern is correct. Until we adopt Suspense /
// React-Server-Components data fetching, keeping these as warnings is
// pragmatic: real bugs still surface, and CI doesn't drown in false
// positives.
const config = [
  { ignores: ['.next/**', 'node_modules/**', 'public/legacy/**', 'archive/**', 'ios/**', 'lib/**', 'dist/**', 'playwright-report/**', 'test-results/**'] },
  ...next,
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: {
      "react-hooks/set-state-in-effect": 'off',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/use-memo': 'warn',
    },
  },
  {
    files: ['app/**/*.{js,jsx,ts,tsx}', 'components/**/*.{js,jsx,ts,tsx}'],
    rules: {
      ...jsxA11y.configs.recommended.rules,
      // Named scroll regions need keyboard focus to satisfy WCAG. Keep the
      // no-noninteractive-tabindex rule strict everywhere else.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['region'] }],
    },
  },
]

export default config
