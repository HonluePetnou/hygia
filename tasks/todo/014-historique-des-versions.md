# 014 - Historique des versions des documents et du dossier

**Phase** : 6 — Fonctionnalités Must
**Dépend de** : 009
**Maquettes** : `docs/maquettes/04-dossier-patient.png` — ouvre ces images avant de coder pour la mise en page ; en cas de doute, le texte de la tâche fait foi.

## Contexte

RF5 : conserver l'historique des versions de chaque document (S3 versionné en production).
Maquette « 04 · Dossier patient » : onglet « Versions », mention « Version 14 du dossier ».

## Objectif

Versionner documents et ressources du dossier côté service Dossiers et afficher l'historique.

## Critères de fini

- Chaque modification crée une nouvelle version immuable (numéro, auteur, date, motif) ;
  l'ancienne reste consultable. Interface `DocumentStore` avec implémentation en mémoire et
  implémentation S3 versionné (LocalStack, non utilisée par les tests).
- Endpoints `GET /patients/:id/versions`, `GET /documents/:id/versions`,
  `GET /documents/:id/versions/:n`.
- Web : onglet « Versions » listant les versions, et comparaison côte à côte de deux versions
  avec les champs modifiés surlignés.
- Tests : trois modifications produisent trois versions ; une version ancienne reste lisible ;
  chaque lecture de version est auditée.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/dossiers/*`, `apps/web/src/app/(app)/patients/[id]/*`.
