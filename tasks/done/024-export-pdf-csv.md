# 024 - Export du dossier et des rapports en PDF et CSV

**Phase** : 7 — Fonctionnalités Should
**Dépend de** : 016, 020

## Contexte

RF17 : exporter un dossier ou un rapport en PDF ou CSV. Boutons « Exporter PDF » (dossier),
« Exporter CSV » (liste des patients), « Exporter le rapport » (carte épidémiologique).

## Objectif

Générer les exports côté serveur, dans la langue de l'utilisateur, avec audit.

## Critères de fini

- PDF du dossier (pdfkit ou équivalent) : en-tête établissement, identité, allergies,
  traitements, chronologie, résumé validé ; pied de page avec date, auteur de l'export et
  mention de confidentialité.
- CSV de la liste des patients (résultat de recherche) et rapport épidémiologique en PDF
  (données pseudonymisées uniquement).
- Chaque export est audité (`export`) et respecte les droits (pas d'export hors équipe).
- Web : boutons branchés, téléchargement direct.
- Tests : PDF non vide contenant le nom du patient, CSV avec en-têtes, export refusé hors équipe.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/dossiers/*`, module analytique, boutons web concernés.
