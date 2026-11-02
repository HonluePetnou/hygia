# 022 - Supervision, traces et tests de pannes

**Phase** : 7 — Fonctionnalités Should
**Dépend de** : 012

## Contexte

RF26, RF27, section 7.4 et maquette « 10 · Supervision » : 8 services sur 2 zones, latence
p95 de l'ouverture d'un dossier (objectif < 2 s), bandeau d'exercice « Zone eu-west-3a coupée
… 0 erreur côté utilisateur », expériences de pannes (couper une zone, arrêter une instance,
injecter de la latence, modèle de langage indisponible → copilote en mode dégradé).

## Objectif

Rendre chaque service observable et simuler les pannes localement.

## Critères de fini

- Chaque service expose `/health` et `/metrics` (requêtes, erreurs, latence p50/p95) et
  journalise l'en-tête `x-correlation-id` ; OpenTelemetry optionnel.
- Le broker gère plusieurs instances d'un même service (étiquetées zone a / zone b), répartit
  la charge, retire une instance qui ne répond plus et réessaie sur l'autre (disjoncteur).
- Module de pannes (rôle admin) : arrêter une instance, couper une zone, ajouter de la
  latence, rendre le modèle de langage indisponible ; le copilote passe alors en « mode
  dégradé : recherche simple » au lieu d'échouer.
- Web : écran `/supervision` conforme à la maquette (grille des services avec zones et p95,
  courbe de latence, liste des expériences avec bouton Lancer / Arrêter).
- Tests : bascule vers la zone restante sans erreur client, disjoncteur, mode dégradé.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/broker/*`, tous les services (`/health`, `/metrics`), `services/ia-clinique/*`,
`apps/web/src/app/(app)/supervision/*`.
