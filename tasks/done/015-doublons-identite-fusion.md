# 015 - Détection et fusion des doublons d'identité

**Phase** : 6 — Fonctionnalités Must
**Dépend de** : 009
**Maquettes** : `docs/maquettes/03-patients-recherche-doublons.png` — ouvre ces images avant de coder pour la mise en page ; en cas de doute, le texte de la tâche fait foi.

## Contexte

RF4 : identifier le patient de manière unique, détecter et fusionner les doublons. Maquette
« 03 · Patients » : bandeau « Doublon d'identité probable (similarité 94 %) » entre
« NGO BASSA Florence » (HYG-2024-00871, Bonassama) et « BASSA NGO Florence »
(HYG-2025-01544, CMA de Bépanda), boutons « Ignorer » et « Comparer et fusionner ».

## Objectif

Détecter les doublons dans le service Dossiers et permettre leur fusion validée par un humain.

## Critères de fini

- Score de similarité documenté : noms normalisés (accents, ordre des mots, casse), date de
  naissance, téléphone, sexe ; seuil configurable. Le doublon de Florence ajouté au dataset
  fictif atteint ≥ 90 %.
- Endpoints : `GET /doublons`, `POST /doublons/:id/ignorer`, `POST /patients/:a/fusion/:b`
  (fusion des documents, observations et prescriptions sous l'identifiant conservé, l'autre
  marqué « fusionné dans » ; opération auditée et annulable).
- Web : bandeau de doublon sur `/patients`, écran de comparaison côte à côte (champ par champ,
  choix de la valeur à garder), confirmation.
- Tests : score, fusion sans perte de ressources, annulation, audit.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/dossiers/*`, `apps/web/src/app/(app)/patients/*`.
