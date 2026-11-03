# Hygia — Progress tracker

_Dernière mise à jour : 2026-11-03_

## État actuel

Monorepo initialisé ; tâches 001, 002, 003 (`@hygia/audit`) et 004 (service `dossiers`) 005 (`@hygia/ingestion`) et 006 (`ia-clinique`) et 007 (`view-models`) et 013 (service Identité) et 014 (historique des versions) et 015 (doublons et fusion) et 016 (recherche en langage naturel) et 017 (agents) et 018 (alertes IA) et 019 (veille épidémiologique) terminées.

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
- [x] 013 — `services/identite` (comptes, TOTP réel + QR + codes de secours, JWT 30 min + JWKS, équipes, bris de glace 4 h avec événement DPO) et `@hygia/auth` ; broker/dossiers/ia-clinique vérifient le jeton (en-têtes `x-user-*` supprimés) ; connexion web branchée. Pas de renouvellement automatique du jeton côté web ; `docs/demo.md` à mettre à jour.
- [x] 014 — historique des versions : `DocumentStore` (mémoire + S3 versionné via `S3Operations`), `PATCH /documents/:id`, `GET /patients/:id/versions`, `GET /documents/:id/versions[/:n]`, lectures auditées ; web : onglet « Versions » avec comparaison côte à côte. Pas d'écran de modification, `S3DocumentStore` non branché (pas d'adaptateur SDK).
- [x] 015 — doublons d'identité : score documenté (`services/dossiers/src/doublons/similarity.ts`, seuil `DOSSIERS_SEUIL_DOUBLONS`, défaut 0,85), `GET /doublons`, `POST /doublons/:id/ignorer`, `POST /patients/:a/fusion/:b`, `POST /fusions/:id/annuler` (audités) ; dataset : 9e patient « BASSA NGO Florence » (≈ 98 %) ; web : bandeaux sur `/patients`, écran `/patients/doublons/[id]`. Paires ignorées et fusions en mémoire du service ; non testé au navigateur.
- [x] 016 — `POST /recherche` (requête libre fr/en → filtres via `QueryInterpreter` à règles dans `@hygia/fhir`, ou filtres fournis), audité ; web : `/patients` avec badge « Langage naturel », puces supprimables, tableau et pagination, barre supérieure → `/patients?q=`. Aucun patient diabétique dans le jeu fictif ; « + Filtre » et export CSV non faits ; non testé au navigateur.
- [x] 017 — `services/agents` (Python, stdlib) : bus mémoire + HTTP (`POST /events`), registre d'agents, pharmacovigilance, qualité, tri ; alertes expliquées au format `DetectedIssue`. Non branché à `pnpm demo`, les services ne publient pas encore d'événements.
- [x] 018 — alertes IA : `GET /alertes?statut=`, `GET /alertes/:id`, `GET /alertes/precision`, `POST /alertes/:id/decision` (rejet sans justification refusé, audité, « notifier » publie `alerte.notification`), `POST /alertes` (dépôt par un agent, rôle `admin`) ; précision par agent sur 30 jours ; web `/alertes`, pastille de la barre latérale et carte du tableau de bord sur les alertes ouvertes. Diffuseur d'événements en mémoire (pas de consommateur Notification), agents Python pas encore branchés sur `POST /alertes`, 4 alertes de démo toutes sur Florence, non testé au navigateur.
- [x] 019 — veille épidémiologique (`services/agents`) : agrégats hebdomadaires, seuil moyenne mobile 8 sem. + 2σ, foyer de Mora détecté ; élection du coordinateur par bail (`LeaseStore` mémoire + DynamoDB) ; API `/analyse/*` (cas, série 12 sem., districts, foyers, flux SSE) réservée au rôle `analyste` (broker 403 + `x-user-role`). Bail DynamoDB non testé contre LocalStack ; alertes de veille non postées sur `/alertes`.
- [x] 020 — web `/epidemiologie` (profil analyste) : carte SVG du Cameroun (bulles proportionnelles, halo animé sur foyer, info-bulle), filtres pathologie / période (4 semaines) / région, flux SSE `/analyse/flux`, courbe 12 semaines avec seuil, classement des districts, bouton « Notifier la délégation » (publie `epidemie.notification` sur `POST /agents/events`). Barre latérale analyste réduite à la veille, les autres écrans le renvoient vers `/epidemiologie`. Non testé au navigateur ; contour du pays très simplifié ; aucun consommateur de `epidemie.notification`.
- [ ] Tâches suivantes dans `tasks/todo/`

## Décisions / blocages

_aucun_
