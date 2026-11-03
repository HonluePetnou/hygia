# Hygia — Progress tracker

_Dernière mise à jour : 2026-11-03_

## État actuel

Monorepo initialisé ; tâches 001, 002, 003 (`@hygia/audit`) et 004 (service `dossiers`) 005 (`@hygia/ingestion`) et 006 (`ia-clinique`) et 007 (`view-models`) terminées.

## Fait

- [x] Structure context/, worklog/, tasks/
- [x] 001 — types FHIR partagés et données fictives (ESLint + Vitest ajoutés)
- [x] 002 — libellés bilingues fr/en (`@hygia/i18n`)
- [x] 003 — journal d'audit chaîné par hachage + Lamport (`@hygia/audit`)

- [x] 004 — service Dossiers NestJS (REST, bris de glace, audit, OpenAPI `/docs`)
- [x] 005 — chaîne d'ingestion en tubes et filtres (`@hygia/ingestion`)
- [x] 006 — service IA clinique : copilote sourcé (JSON + SSE) et résumé, modèle simulé
- [x] 007 — vues-modèles MobX partagées (`@hygia/view-models`) : dépôts HTTP + mémoire, 5 vues-modèles

- [x] 008 — client web `apps/web` : socle Next.js, design system, mise en page, connexion 2FA

- [x] 009 — web : tableau de bord `/`, liste `/patients`, dossier `/patients/[id]` (résumé IA, chronologie filtrable, accès refusé + bris de glace)

- [x] 010 — web : copilote `/copilote/[patientId]` (réponse en flux, sources cliquables, panneau de source, badge de langue) et import `/import` (dépôt, 5 étapes, branches 6a/6b, entités à valider) + route `/api/ingestion`

## À faire

- [x] 011 — `pnpm demo`, `pnpm package:usb`, `docs/demo.md`, README « Lancer la démo », `OUTILS.md` à jour, CORS des services. Vérifié par curl hors Docker ; écrans web non parcourus au navigateur, README non testé sur clone propre, journal des accès via l'API (écran = tâche 021).
- [x] 012 — `services/broker` (NestJS) : `/api/<service>/...`, registre par variables d'environnement, proxy HTTP + SSE, `x-correlation-id`, limite de débit par utilisateur (429), 503 si service muet ; web via `NEXT_PUBLIC_API_URL` ; `pnpm demo` démarre le broker.
- [ ] Tâches suivantes dans `tasks/todo/`

## Décisions / blocages

_aucun_
