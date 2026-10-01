import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

// One flat config for every JavaScript file in the monorepo.
// Component-specific blocks (React in client/) are added next to their code.
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
      'ml-service/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
  // Turn off rules that conflict with Prettier formatting; keep this last.
  prettier,
];
