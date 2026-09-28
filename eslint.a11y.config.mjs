import jsxA11y from 'eslint-plugin-jsx-a11y'
import tsParser from '@typescript-eslint/parser'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooks from 'eslint-plugin-react-hooks'

const config = [
  {
    files: [
      'app/**/*.{js,jsx,ts,tsx}',
      'components/**/*.{js,jsx,ts,tsx}',
      'lib/**/*.{js,jsx,ts,tsx}',
    ],
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/legacy/**',
      'archive/**',
      'ios/**',
      'dist/**',
      'playwright-report/**',
      'test-results/**',
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    plugins: {
      'jsx-a11y': jsxA11y,
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      // WCAG requires keyboard access to scrollable regions. Allow tabIndex
      // specifically on named ARIA regions while keeping the rule strict for
      // ordinary non-interactive elements.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['region'] }],
    },
  },
]

export default config
