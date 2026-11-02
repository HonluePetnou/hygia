# 002 - Libellés bilingues français / anglais

**Phase** : 1 — Fondations
**Dépend de** : aucune

Tâche destinée au Lead (démo du jeudi 5 novembre : pas d'essai par les juniors).

## Contexte

RF28 : toute la plateforme existe en français et en anglais ; les vues n'ont pas à connaître
la langue, les vues-modèles exposent des libellés déjà traduits (section 6.5).

## Objectif

Créer `packages/i18n` (`@hygia/i18n`) avec les libellés des écrans de la tranche de jeudi.

## Critères de fini

- `createTranslator(locale: 'fr' | 'en')` renvoie `t(key, params?)` avec interpolation
  `{nom}` ; une clé absente renvoie la clé et ne plante pas.
- Dictionnaires `fr` et `en` typés : la clé manquante dans une langue est une erreur de
  compilation (même type de clés pour les deux).
- Libellés couverts : navigation (Accueil, Patients, Copilote IA, Importer un document,
  Alertes IA, Journal d'audit), connexion et double authentification, tableau de bord,
  dossier patient (onglets, chronologie, résumé pré-consultation), copilote (« Aucune source
  ne permet de répondre »), import (étapes de la chaîne : Réception, OCR, Normalisation,
  Extraction IA, Détection des identifiants), statuts et rôles.
- `formatDate(iso, locale)` (`2 nov. 2026` / `Nov 2, 2026`) et `formatDateTime`.
- Tests Vitest : interpolation, clé absente, formats de date dans les deux langues.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`packages/i18n/*`.
