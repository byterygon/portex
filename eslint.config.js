import js from '@eslint/js';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'apps/**', 'packages/**'],
  },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
