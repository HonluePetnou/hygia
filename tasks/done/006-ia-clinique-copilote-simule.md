# 006 - Service IA clinique : copilote sourcé et résumé (modèle simulé)

**Phase** : 2 — Services
**Dépend de** : 001, 003

Tâche destinée au Lead (démo du jeudi 5 novembre : pas d'essai par les juniors).

## Contexte

Section 8.3 (RF7, RF8) : le copilote ne répond qu'à partir des passages retrouvés dans le
dossier du patient, cite chaque source, et dit qu'il ne sait pas sans source. Il répond dans
la langue de la question (RF28). Le modèle est derrière l'interface `ClinicalLanguageModel`
(section 5.4) : simulé ici, Bedrock plus tard.

## Objectif

Créer `services/ia-clinique` en NestJS (port `IA_CLINIQUE_PORT`, défaut 3003).

## Critères de fini

- Interface `ClinicalLanguageModel` (`generate({ question, passages, language })`) et
  `MockClinicalLanguageModel` déterministe qui assemble une réponse à partir des passages
  et insère les marqueurs `[n]` des sources utilisées.
- `PassageIndex` (interface) + implémentation en mémoire : découpe les documents fictifs du
  patient en passages, recherche par mots-clés (score TF-IDF simple), filtrée sur le patient.
- Détection simple de la langue de la question (fr/en).
- Endpoints : `POST /copilote/:patientId` `{ question }` → `{ answer, language, sources:
[{ n, documentId, titre, date, extrait }] }` ; variante `GET /copilote/:patientId/flux?q=`
  en Server-Sent Events (mots envoyés au fil de l'eau) ; `GET /patients/:id/resume`
  (antécédents, traitements en cours, derniers résultats, alertes, chacun avec ses sources).
- Sans passage pertinent : réponse « Aucune source du dossier ne permet de répondre. » et
  liste de sources vide.
- Chaque question est auditée (`question_copilote`, via `@hygia/audit`).
- Même authentification simulée que 004 (`x-user-id`, `x-user-role`).
- Tests Jest : question sur l'ibuprofène de Florence cite l'ordonnance du 28/10 ; question
  en anglais sur l'échographie répond en anglais et cite le compte rendu ; question hors sujet
  → aucune source ; toute réponse non vide a au moins une source.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/ia-clinique/*`.
