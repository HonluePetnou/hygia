import { defineConfig } from 'prisma/config';

// Base du service Dossiers (une base par service). Valeur factice pour `prisma generate`, qui
// n'ouvre aucune connexion ; `prisma migrate deploy` exige la vraie URL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url:
      process.env['DOSSIERS_DATABASE_URL'] ??
      `postgresql://hygia:hygia@localhost:${process.env['HYGIA_POSTGRES_PORT'] ?? '54320'}/dossiers`,
  },
});
