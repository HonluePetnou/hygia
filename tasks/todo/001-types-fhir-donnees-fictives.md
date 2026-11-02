# 001 - Types partagés FHIR et données fictives de démonstration

**Phase** : 1 — Fondations
**Dépend de** : aucune

## Contexte

Le modèle de données suit HL7 FHIR R4 (cahier des charges, section 10). Toutes les briques
(services, vues-modèles, web) doivent partager les mêmes types et le même jeu de données
fictif, cohérent avec les maquettes Figma : patiente de référence Florence Ngo Bassa.

## Objectif

Créer `packages/types` (types métier) et `packages/fhir` (validation minimale + données
fictives), utilisables par tous les autres paquets.

## Critères de fini

- `packages/types` (`@hygia/types`) : types documentés (JSDoc) pour `Patient`, `Practitioner`,
  `CareTeam`, `Encounter`, `DocumentReference` (type, langue `fr|en`, version, statut de
  traitement), `Observation`, `Condition` (code CIM-10), `MedicationRequest` (code ATC,
  posologie), `AllergyIntolerance`, `DetectedIssue` (alerte IA : agent, gravité, explication,
  sources, décision du soignant), `AuditEvent` (acteur, action, ressource, motif, horodatage,
  estampille de Lamport, hachage précédent, hachage). Chaque ressource a `id` (UUID) et
  `version` (entier, contrôle optimiste). Rôles : `medecin | infirmier | administratif |
analyste | patient | admin | auditeur`.
- `packages/fhir` (`@hygia/fhir`) :
  - `validateResource(resource)` : vérifie `resourceType`, `id`, `version` et les champs
    obligatoires par type ; renvoie `{ ok: true } | { ok: false, errors: string[] }`.
  - `demoDataset` déterministe : 3 établissements (Hôpital de district de Bonassama, CMA de
    Bépanda, CSI de Mora), 6 praticiens (dont Dr Aïcha Nana, cardiologue ; Rose Mballa,
    infirmière ; Dr Paul Kamga, CMA de Bépanda ; Dr Bertrand Ondoa, urgences), 8 patients
    (dont Florence Ngo Bassa, 71 ans, IPP HYG-2024-00871, allergie pénicilline, warfarine
    5 mg/j, ibuprofène 400 mg × 3/j prescrit le 2026-10-28, INR 2,8 le 2026-10-14), une équipe
    de soins Cardiologie, et pour Florence 5 documents dont un compte rendu d'échographie en
    anglais (2026-06-03, FEVG 45 %).
- Tests Vitest : validation OK/KO pour chaque type, dataset sans doublon d'id, Florence
  présente avec ses traitements.
- Scripts `lint`, `typecheck`, `test`, `build` dans chaque `package.json`.
- `pnpm lint && pnpm typecheck && pnpm test` verts à la racine.

## Fichiers probablement concernés

`packages/types/*`, `packages/fhir/*`, configuration ESLint partagée si nécessaire.
