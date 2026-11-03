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

## À faire

- [ ] Tâches suivantes dans `tasks/todo/`

## Décisions / blocages

_aucun_
