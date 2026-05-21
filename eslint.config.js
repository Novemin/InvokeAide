// ESLint v9 flat config — 2026-05-21 週末タスクA-3 で .eslintrc.cjs から移行。
//
// 構成:
//   - @eslint/js recommended(JavaScript 基本ルール)
//   - typescript-eslint recommended(TypeScript ルール)
//   - eslint-plugin-vue flat/vue3-recommended(Vue 3 SFC)
//   - vue-eslint-parser を *.vue の parser として指定
//   - globals で browser + node + es2022 を有効化(v8 系の env: の代替)
//
// 旧 .eslintrc.cjs と等価のルール:
//   - @typescript-eslint/no-unused-vars(argsIgnorePattern: ^_)
//   - @typescript-eslint/no-explicit-any: warn
//   - vue/multi-word-component-names: off
//   - ignorePatterns: dist/ node_modules/ coverage/ playwright-report/ test-results/ .lighthouseci/

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.lighthouseci/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'vue/multi-word-component-names': 'off',
    },
  },
];
