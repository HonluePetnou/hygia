# 004 - Service Dossiers patients (NestJS, REST)

**Phase** : 2 — Services
**Dépend de** : 001, 003

## Contexte

Section 6.2 : le service Dossiers expose l'API des patients, dossiers et observations, avec
contrôle de version optimiste et publication d'événements. Accès par rôle et par équipe de
soins, avec bris de glace tracé (RF23, matrice section 11.2). Chaque accès est audité (RF24).

## Objectif

Créer `services/dossiers` en NestJS, démarrable seul (`pnpm --filter dossiers dev`, port
`DOSSIERS_PORT`, défaut 3001), avec des données fictives chargées au démarrage.

## Critères de fini

- Authentification simulée pour la démo : en-têtes `x-user-id` et `x-user-role` (un garde
  NestJS refuse la requête s'ils manquent : 401). Documenté comme remplacé par Cognito plus tard.
- Contrôle d'accès : un médecin ou infirmier ne lit que les patients de son équipe de soins
  (403 sinon) ; l'administrateur système n'a aucun accès aux données de santé.
- Endpoints (OpenAPI via `@nestjs/swagger`, servi sur `/docs`) :
  - `GET /patients?q=` (recherche par nom ou IPP), `GET /patients/:id`,
  - `GET /patients/:id/chronologie` (événements triés du plus récent au plus ancien :
    consultations, examens, prescriptions, documents, alertes),
  - `PATCH /patients/:id` avec en-tête `If-Match: <version>` (409 si version périmée),
  - `POST /patients/:id/bris-de-glace` `{ motif, precisions }` : ouvre l'accès 4 h,
  - `GET /patients/:id/acces` : journal des accès à ce dossier (via `@hygia/audit`).
- Chaque lecture ou écriture appelle `AuditLog.append` (motif `bris_de_glace` le cas échéant).
- Persistance derrière une interface `PatientRepository` : implémentation en mémoire
  alimentée par `demoDataset` (utilisée par les tests) ; schéma Prisma
  (`services/dossiers/prisma/schema.prisma`) prêt pour PostgreSQL, non requis par les tests.
- Validation des variables d'environnement au démarrage.
- Tests Jest + supertest (sans base) : 401 sans en-têtes, 403 hors équipe, 200 dans l'équipe,
  409 sur version périmée, bris de glace ouvre l'accès et laisse une entrée d'audit.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/dossiers/*`.
