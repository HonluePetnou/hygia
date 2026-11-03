/**
 * Nest 12 et les paquets @hygia/* sont des modules ES : Jest tourne en mode ESM
 * (`--experimental-vm-modules`) et charge les paquets @hygia/* depuis leurs sources TypeScript
 * (pas de build préalable requis pour les tests).
 */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: 'test/.*\\.spec\\.ts$',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: 'tsconfig.json', useESM: true, diagnostics: { ignoreCodes: [151002] } },
    ],
  },
  moduleNameMapper: {
    '^@hygia/audit$': '<rootDir>/../audit/src/index.ts',
    '^@hygia/auth$': '<rootDir>/../../packages/auth/src/index.ts',
    '^@hygia/observability$': '<rootDir>/../../packages/observability/src/index.ts',
    '^@hygia/sync-core$': '<rootDir>/../../packages/sync-core/src/index.ts',
    '^@hygia/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
