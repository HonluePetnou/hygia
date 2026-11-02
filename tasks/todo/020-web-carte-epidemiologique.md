# 020 - Client web : carte épidémiologique du Cameroun

**Phase** : 7 — Fonctionnalités Should
**Dépend de** : 019, 008

## Contexte

Maquette « 08 · Carte épidémiologique » (profil analyste, Dr Ibrahim Moussa) : titre « Veille
épidémiologique », badge « Données pseudonymisées », puces de pathologies (Choléra actif en
rouge, Paludisme, Rougeole, Dengue, Mpox), carte du Cameroun avec bulles par ville (rouge :
foyer anormal avec halo, orange : hausse, vert : niveau attendu), légende, colonne droite
« Foyer anormal détecté » (bouton « Notifier la délégation »), courbe 12 semaines avec seuil
en pointillés rouges, liste des districts les plus touchés.

## Objectif

Écran `/epidemiologie` branché sur l'API de la tâche 019, mis à jour en temps réel.

## Critères de fini

- Carte en SVG (contour du Cameroun + positions des villes en longitude/latitude projetées),
  bulles proportionnelles aux cas, halo animé sur un foyer, info-bulle au survol.
- Filtres pathologie, période et région ; mise à jour en direct via SSE.
- Courbe et liste conformes à la maquette ; bouton de notification qui publie l'événement.
- Barre latérale adaptée au rôle analyste (pas d'accès aux dossiers identifiés).
- Tests : rendu avec données fictives, changement de pathologie, arrivée d'un cas en direct.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`apps/web/src/app/(app)/epidemiologie/*`.
