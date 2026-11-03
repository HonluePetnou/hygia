import rootConfig from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  {
    // Next.js impose l'export par défaut pour les pages, mises en page et la configuration.
    files: [
      'src/app/**/{page,layout,not-found,error,loading}.tsx',
      'next.config.ts',
      'vitest.config.ts',
    ],
    rules: { 'no-restricted-exports': 'off' },
  },
  { ignores: ['next-env.d.ts'] },
];
