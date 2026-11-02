# HYGIA

Contexte pour les outils d'IA (Claude Code, Codex, Cursor…). Le cahier des charges
(`docs/cahier-des-charges-hygia-g2.pdf`) fait foi ; ce fichier en résume les règles de travail.

## Stack

- TypeScript strict partout (Node >= 22), Python pour `services/agents`
- Monorepo pnpm workspaces + Turborepo
- Web : Next.js (app router) ; mobile : Expo + Expo Router + SQLite
- Vues-modèles MobX partagées dans `packages/view-models` (MVVM)
- Services : NestJS (dossiers, ia-clinique, synchronisation), Lambda (ingestion, notification, audit, identite)
- Données : Prisma → PostgreSQL + pgvector ; S3 versionné ; DynamoDB (baux, verrous)
- IA : derrière l'interface `ClinicalLanguageModel` (implémentation `mock` en local, Bedrock ensuite)
- Local : `docker compose up -d` (PostgreSQL + LocalStack), aucun compte AWS

## Commandes

```bash
pnpm install
docker compose up -d
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm format
```

## Règles d'architecture (sections 6 et 7 du cahier)

- Trois étages : un composant n'appartient qu'à un étage ; échanges uniquement entre étages consécutifs.
- Aucun client ne parle directement à un service ou à une base : tout passe par le broker.
- Chaque micro-service possède ses données ; pas de base partagée entre services.
- La branche analytique ne lit que des données pseudonymisées.
- Les filtres de la chaîne d'ingestion sont idempotents et ne connaissent que leurs voisins.
- Toute ressource porte un UUID stable et un numéro de version (contrôle optimiste).
- Toute lecture ou écriture de dossier produit un événement d'audit.
- L'IA ne modifie jamais un dossier : toute sortie est validée par un soignant.
- Le copilote ne répond qu'à partir des passages retrouvés et cite chaque source.

## Règles de code

- SOLID, injection de dépendances par constructeur, classes courtes (< 200 lignes).
- Exports nommés uniquement, pas d'export par défaut (sauf là où le framework l'exige, ex. pages Next.js).
- camelCase pour les variables, PascalCase pour les classes et composants.
- Valider les variables d'environnement au démarrage.
- Documenter les API publiques (OpenAPI pour les endpoints REST).
- Interfaces bilingues : aucun texte en dur dans les vues, tout passe par `packages/i18n`.
- Données fictives uniquement.
- Accessibilité WCAG AA sur le web et le mobile.

## Git

- Branches `feat/…`, `fix/…` ; fusion par demande de fusion avec revue.
- Commits conventionnels.
- Décisions d'architecture dans `docs/adr/NNNN-titre.md`.
