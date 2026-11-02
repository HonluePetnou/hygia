# 007 - Vues-modèles MobX partagées (MVVM)

**Phase** : 3 — Clients
**Dépend de** : 001, 002

## Contexte

Section 6.5 : le web et le mobile partagent les mêmes vues-modèles MobX ; la vue ne contient
aucune logique, les vues-modèles sont testées sans interface et exposent des libellés traduits.

## Objectif

Créer `packages/view-models` (`@hygia/view-models`).

## Critères de fini

- Interfaces de dépôts (`PatientsGateway`, `CopiloteGateway`, `IngestionGateway`) avec deux
  implémentations : HTTP (`fetch`, URLs de base en paramètre, en-têtes `x-user-id` /
  `x-user-role`) et en mémoire (données de `@hygia/fhir`).
- Vues-modèles (classes `makeAutoObservable`, dépendances injectées par constructeur) :
  - `SessionViewModel` : identifiants puis code à 6 chiffres simulé (code de démo `481516`),
    rôle courant, langue courante (bascule FR/EN).
  - `DashboardViewModel` : indicateurs, consultations du jour, alertes ouvertes.
  - `PatientRecordViewModel` : patient, chronologie filtrable (tout, consultations, examens,
    prescriptions, alertes), résumé pré-consultation, état de chargement/erreur.
  - `CopiloteViewModel` : historique des messages, envoi d'une question, réponse et sources.
  - `IngestionViewModel` : fichier choisi, étapes de la chaîne avec statut et durée.
- Tests Vitest avec les dépôts en mémoire : connexion avec bon/mauvais code, filtre de la
  chronologie, envoi d'une question copilote, bascule de langue qui change les libellés.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`packages/view-models/*`.
