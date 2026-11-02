# 016 - Recherche multicritère et en langage naturel

**Phase** : 6 — Fonctionnalités Must
**Dépend de** : 015

## Contexte

RF14 : rechercher un dossier par nom, identifiant, pathologie, date, mot-clé ou question en
langage naturel. Maquette « 03 · Patients » : requête « patients diabétiques de plus de 60 ans
vus depuis janvier avec une HbA1c > 8 % », puces « Compris comme : Diagnostic E11 · Âge > 60
ans · Dernière visite ≥ 01/01/2026 · HbA1c > 8 % », tableau des résultats (avatar, IPP, âge ·
sexe, diagnostics CIM-10 en badges, dernière visite, établissement, langue).

## Objectif

Transformer une requête libre (français ou anglais) en filtres structurés et l'exécuter.

## Critères de fini

- `QueryInterpreter` (interface) avec implémentation à règles (pathologies → CIM-10, âges,
  dates relatives et absolues, valeurs biologiques avec comparateurs) ; prévue pour être
  remplacée par le modèle de langage plus tard.
- Endpoint `POST /recherche` → `{ filtres, resultats }` ; chaque recherche est auditée.
- Web : barre de recherche de `/patients` avec badge « Langage naturel », puces des filtres
  compris (supprimables), tableau conforme à la maquette, pagination ; la recherche de la barre
  supérieure ouvre cette page.
- Tests : la requête de la maquette donne les 4 filtres attendus ; requête équivalente en
  anglais ; suppression d'une puce relance la recherche.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/dossiers/*`, `apps/web/src/app/(app)/patients/*`, barre supérieure.
