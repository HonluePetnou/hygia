# 010 - Client web : copilote et import de document

**Phase** : 3 — Clients
**Dépend de** : 005, 006, 009

Tâche destinée au Lead (démo du jeudi 5 novembre : pas d'essai par les juniors).

## Contexte

Maquettes Figma « 05 · Copilote clinique — réponses sourcées » et « 06 · Importer un
document — chaîne d'analyse » (RF1-RF3, RF6, RF8, RF13, RF28).

## Objectif

Écrans `/copilote/[patientId]` (branché sur `CopiloteViewModel`) et `/import` (branché sur
`IngestionViewModel`).

## Critères de fini

- Copilote : badge « Recherche limitée au dossier de … », bulles de questions (fond encre),
  réponses avec marqueurs `[n]` cliquables en violet, puces de sources sous chaque réponse ;
  clic sur une source ouvre le panneau de droite (titre, date, extrait cité surligné) ;
  réponse affichée au fil de l'eau (SSE) ; suggestions de questions ; mention « aide à la
  décision, ne remplace pas l'avis médical ». Une question en anglais reçoit une réponse en
  anglais avec le badge « Answered in English ».
- Import : zone de dépôt (glisser-déposer + Parcourir), champ « Rattacher au patient »,
  4 cartes de canaux (Upload web, Application mobile, API FHIR, WhatsApp), panneau « Chaîne
  d'analyse » avec les 5 étapes (Terminé / En cours / En attente / Erreur, durée) puis les
  branches clinique et analytique, et tableau « Entités extraites — à valider » (texte
  source, type, valeur normalisée, code, confiance, valider/rejeter, bouton « Tout valider »).
  Rien n'est enregistré avant validation.
- Pour la démo, l'import appelle `@hygia/ingestion` via une route API Next.js
  (`/api/ingestion`) qui renvoie les événements d'étape.
- Tests Testing Library : envoi d'une question et affichage des sources ; import de
  l'ordonnance fictive et affichage des 5 étapes et des entités.
- `pnpm lint && pnpm typecheck && pnpm test` verts ; `pnpm --filter web build` passe.

## Fichiers probablement concernés

`apps/web/src/app/(app)/copilote/*`, `apps/web/src/app/(app)/import/*`,
`apps/web/src/app/api/ingestion/*`.
