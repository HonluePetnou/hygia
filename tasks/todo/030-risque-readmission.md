# 030 - Estimation du risque de réadmission (Could)

**Phase** : 8 — Extensions
**Dépend de** : 009, 019

## Contexte

RF12 et section 8.6 : estimer le risque de réadmission à 30 jours avec les facteurs qui
l'expliquent, à titre d'aide à la décision, à partir de la branche pseudonymisée. En
production : gradient boosting sur SageMaker avec valeurs SHAP. Écran non maquetté : suivre
le style de la colonne droite du dossier patient.

## Objectif

Modèle simple et explicable, entraîné sur données fictives pseudonymisées, affiché dans le
dossier.

## Critères de fini

- Modèle (régression logistique ou arbre, Python dans `services/agents`) entraîné sur un jeu
  fictif reproductible ; contributions par facteur (âge, nombre d'hospitalisations, nombre de
  traitements, insuffisance cardiaque, etc.).
- Endpoint qui renvoie `{ score, niveau, facteurs: [{ libelle, contribution }] }` sans donnée
  identifiante en entrée du modèle.
- Web : carte « Risque de réadmission à 30 jours » dans le dossier (jauge, 3 facteurs
  principaux, mention « aide à la décision »).
- Tests : score reproductible, facteurs triés, refus si le consentement « statistiques » est
  révoqué.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/agents/*`, `apps/web/src/app/(app)/patients/[id]/*`.
