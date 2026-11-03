/**
 * Nest 12 est un module ES : Jest tourne en mode ESM (`--experimental-vm-modules`) et charge
 * les sources TypeScript directement (pas de build préalable requis pour les tests).
 */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: 'test/.*\\.spec\\.ts$',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', useESM: true, diagnostics: { ignoreCodes: [151002] } }],
  },
  moduleNameMapper: {
    '^@hygia/auth$': '<rootDir>/../../packages/auth/src/index.ts',
    '^@hygia/observability$': '<rootDir>/../../packages/observability/src/index.ts',
    '^@hygia/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
