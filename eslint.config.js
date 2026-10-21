import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';

export default ts.config(
  { ignores: ['dist/**', 'node_modules/**', 'data/**', 'work/**'] },
  { ...js.configs.recommended, files: ['**/*.mjs', '**/*.js'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  ...ts.configs.recommended.map(config => ({ ...config, files: ['src/**/*.ts', 'src/**/*.tsx', 'vite.config.ts'] })),
  { files: ['src/**/*.ts', 'src/**/*.tsx', 'vite.config.ts'], languageOptions: { globals: { ...globals.node, ...globals.browser } }, rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
