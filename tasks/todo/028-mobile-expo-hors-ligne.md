# 028 - Application mobile Expo hors ligne

**Phase** : 7 — Fonctionnalités Should
**Dépend de** : 027, 007

## Contexte

Maquettes « 15 · patients hors ligne », « 16 · saisie des constantes », « 17 · synchronisation
et conflit » (page « Mobile hors ligne » du Figma). Client épais avec base SQLite embarquée,
file d'envoi locale et reprise automatique (section 6.3). Mêmes vues-modèles MobX que le web.

## Objectif

Créer `apps/mobile` (Expo + Expo Router, TypeScript strict).

## Critères de fini

- Même design system que le web (couleurs, Plus Jakarta Sans, badges), barre d'onglets
  Patients / Saisie / Synchro / Scribe.
- Base locale `expo-sqlite` derrière les interfaces de dépôts de `@hygia/view-models`
  (transparence d'accès : même vue-modèle, donnée locale ou distante).
- Écran Patients : bandeau orange « Hors ligne depuis … · N modifications en attente »,
  recherche dans les dossiers locaux, cartes patient avec statut de synchronisation.
- Écran Saisie : constantes (tension, pouls, température, SpO2, poids, selles/24 h ; valeurs
  anormales en orange), observation de soins, horloge vectorielle affichée, « Enregistrer
  sur l'appareil ».
- Écran Synchro : modifications fusionnées, conflit à arbitrer (deux versions côte à côte
  avec auteur, heure et horloge), « Appliquer ce choix » (via `@hygia/sync-core` et le
  service 027).
- Tests des vues-modèles et de la file d'envoi (Vitest ou Jest selon la convention Expo).
- `pnpm lint && pnpm typecheck && pnpm test` verts ; `npx expo export` passe.

## Fichiers probablement concernés

`apps/mobile/*`, `packages/view-models/*`.
