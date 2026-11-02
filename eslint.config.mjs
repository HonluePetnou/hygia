import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**', 'worktrees/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-restricted-exports': ['error', { restrictedNamedExports: ['default'] }],
    },
  },
);
