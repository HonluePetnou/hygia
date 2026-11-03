# 026 - Portail patient : accès au dossier, consentements, droits

**Phase** : 7 — Fonctionnalités Should
**Dépend de** : 021, 024
**Maquettes** : `docs/maquettes/13-portail-patient.png` — ouvre ces images avant de coder pour la mise en page ; en cas de doute, le texte de la tâche fait foi.

## Contexte

RF21 et maquette « 13 · Portail patient » : navigation propre (Mon dossier, Rendez-vous,
Qui a vu mon dossier ?, Consentements, Mes droits), bandeau « Bonjour Florence » avec le
prochain rendez-vous, journal des accès (lecture, bris de glace en orange avec motif, agent
IA, ajout de documents), « Signaler » un accès suspect, consentements avec interrupteurs
(Soins requis, IA, Statistiques pseudonymisées, Enregistrement audio, Rappels WhatsApp),
droits (télécharger mon dossier PDF, rectification, suppression) traités par la DPO.

## Objectif

Espace `/portail` pour le rôle patient, branché sur les services existants.

## Critères de fini

- Ressource `Consent` (service Dossiers) : finalités, date, révocation ; les autres services
  la respectent (par exemple, pas de rappel WhatsApp si refusé, pas d'IA si refusée).
- Journal « Qui a vu mon dossier ? » via l'API d'audit (accès du patient à ses propres
  entrées seulement) ; signalement transmis à la DPO.
- Demandes d'exercice des droits enregistrées et visibles par la DPO dans `/audit`.
- Interface en français et en anglais selon la langue du patient.
- Tests : révocation du consentement IA bloque le copilote pour ce patient, journal limité au
  patient connecté, demande de rectification visible côté DPO.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`apps/web/src/app/(portail)/*`, `services/dossiers/*`, `services/audit/*`.
