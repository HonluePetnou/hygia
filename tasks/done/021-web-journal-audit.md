# 021 - Journal d'audit : API et écran de l'auditeur

**Phase** : 6 — Fonctionnalités Must
**Dépend de** : 003, 013
**Maquettes** : `docs/maquettes/09-journal-audit.png` — ouvre ces images avant de coder pour la mise en page ; en cas de doute, le texte de la tâche fait foi.

## Contexte

Maquette « 09 · Journal d'audit » (profil Auditrice · DPO) : badge « Chaîne intègre · vérifiée
à 03:00 », indicateurs (événements du jour, accès bris de glace, ruptures de chaîne),
schéma de chaînage des 3 dernières entrées, filtres (Tous, Lectures, Modifications, Bris de
glace, Copilote, Exports), tableau (Lamport, horodatage, acteur, action, ressource, motif,
hachage) avec la ligne de bris de glace surlignée en orange.

## Objectif

Exposer le journal en lecture seule et construire l'écran de l'auditeur.

## Critères de fini

- `services/audit` expose une petite API HTTP (lecture seule, rôles `auditeur` et patient
  pour son propre dossier) : recherche filtrée paginée, vérification de la chaîne, export
  CSV. Les autres services y écrivent via le bus ou une route interne.
- Implémentation `S3ObjectLockAuditStore` (LocalStack, mode WORM) en plus de la mémoire.
- Vérification planifiée (quotidienne, horloge injectée) qui alerte en cas de rupture.
- Web : écran `/audit` conforme à la maquette ; barre latérale réduite à Conformité pour
  l'auditeur.
- Tests : filtres, pagination, rupture détectée et signalée, refus pour un médecin.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/audit/*`, `apps/web/src/app/(app)/audit/*`.
