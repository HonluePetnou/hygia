import rootConfig from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  {
    // Expo Router impose l'export par défaut pour les écrans et les mises en page.
    files: ['app/**/*.tsx', 'vitest.config.ts'],
    rules: { 'no-restricted-exports': 'off' },
  },
  {
    // Metro charge sa configuration en CommonJS.
    files: ['metro.config.js'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  { ignores: ['.expo/**', 'dist/**'] },
];
