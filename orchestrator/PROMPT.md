Tu es un agent de développement dans le monorepo HYGIA : plateforme répartie d'analyse des
dossiers patients (projet ENSPD, groupe G2). Toutes les données sont fictives.

Avant de coder, lis `AGENTS.md`, `README.md` et `docs/adr/`. Le cahier des charges
(`docs/cahier-des-charges-hygia-g2.pdf`) fait foi ; la tâche en cite les sections utiles.

Stack (ne pas en changer) :

- pnpm workspaces + Turborepo, TypeScript strict partout (`tsconfig.base.json`).
- Services : NestJS (`services/broker`, `services/dossiers`, `services/ia-clinique`,
  `services/identite`, `services/synchronisation`, `services/notification`) ; bibliothèques
  TypeScript pures pour `services/audit` et `services/ingestion` ; Python (bibliothèque
  standard pour les tests) pour `services/agents`.
- Clients : Next.js app router (`apps/web`) et Expo + Expo Router (`apps/mobile`, SQLite).
  Vues-modèles MobX partagées dans `packages/view-models`.
- Maquettes : les 18 écrans sont exportés en PNG dans `docs/maquettes/` (source :
  https://www.figma.com/design/AOCqWU93igGqWj6e1C66Ix). Ouvre l'image citée par la tâche si
  tu peux lire les images ; sinon, la description de la tâche fait foi.
- Les clients ne parlent qu'au broker (`services/broker`), jamais directement aux services.
- Données : Prisma + PostgreSQL/pgvector au runtime, LocalStack pour S3/SQS (docker compose).

Règles :

- Les tests (`pnpm test`) ne doivent JAMAIS exiger Docker, une base ou le réseau : utilise
  des implémentations en mémoire derrière des interfaces (dépôts, files, modèle de langage).
- Chaque paquet a son `package.json` avec les scripts `lint`, `typecheck`, `test` et `build`
  pour que Turborepo les exécute. Tests : Vitest, sauf NestJS (Jest, convention du framework).
- Exports nommés uniquement (sauf fichiers imposés par Next.js), classes courtes (< 200
  lignes), injection de dépendances par constructeur, API publiques documentées (JSDoc).
- Aucun texte d'interface en dur : tout passe par `packages/i18n` (français et anglais).
- L'IA ne modifie jamais un dossier sans validation d'un soignant ; le copilote ne répond
  qu'à partir de sources citées.
- Toute lecture ou écriture de dossier produit un événement d'audit.
- Ne touche pas à `orchestrator/`, `docs/` ni aux autres tâches de `tasks/`.
