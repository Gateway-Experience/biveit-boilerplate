import js from '@eslint/js';
import globals from 'globals';
import * as tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist', 'src/components/shadui/**', 'src/lib/**'] },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, React: 'readonly' },
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '19.3' } },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      // base rule miscounts type-signature params; use the TS-aware version.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { args: 'after-used' }],
      'react/prop-types': 'off',
      'no-console': 'error',
      'semi': 2,
      'quotes': ['error', 'single'],
      'indent': ['error', 2],
      'comma-dangle': ['error', 'always-multiline'],
      'linebreak-style': ['error', 'unix'],
      'jsx-quotes': ['error', 'prefer-single'],
      // For convenience.
      'no-param-reassign': 'off',
      'no-throw-literal': 'off',
      'prefer-destructuring': 'off',
      'arrow-parens': 'off',
      'prefer-promise-reject-errors': 'off',
      'no-use-before-define': 'off',
      'newline-per-chained-call': 'off',
      'no-underscore-dangle': 'off',
    },
  },
  {
    // Memoizer calls useCallback inside a map (that's its whole purpose), which
    // crashes react-hooks/exhaustive-deps rather than just warning.
    files: ['src/components/common/Memoizer.tsx'],
    rules: { 'react-hooks/exhaustive-deps': 'off' },
  },
];
