# 018 - Alertes IA : liste, raisonnement et décision du soignant

**Phase** : 6 — Fonctionnalités Must
**Dépend de** : 017, 013
**Maquettes** : `docs/maquettes/07-alertes-ia.png` — ouvre ces images avant de coder pour la mise en page ; en cas de doute, le texte de la tâche fait foi.

## Contexte

Maquette « 07 · Alertes IA » : liste à gauche (onglets Ouvertes · 4 / Acceptées / Rejetées,
badge d'agent, titre, patient, ancienneté) ; détail à droite (badges Critique et agent,
titre, carte patient, « Raisonnement de l'agent » en 4 étapes numérotées, sources, encadré
« Proposition de l'agent », champ « Justification (obligatoire en cas de rejet) », boutons
Rejeter / Accepter seulement / Accepter et notifier le prescripteur, précision de l'agent
sur 30 jours). Chaque retour du soignant mesure la précision de l'agent (section 8.5).

## Objectif

Stocker les alertes produites par les agents, les exposer et enregistrer la décision humaine.

## Critères de fini

- Service Dossiers : `GET /alertes?statut=`, `GET /alertes/:id`, `POST /alertes/:id/decision`
  `{ decision: accepter | accepter_notifier | rejeter, justification }` (justification
  obligatoire si rejet) ; décision auditée ; « notifier » publie un événement pour le service
  Notification.
- Calcul de la précision par agent sur 30 jours (acceptées / décidées).
- Aucune alerte ne modifie le dossier : accepter enregistre seulement la décision.
- Web : écran `/alertes` conforme à la maquette ; compteur de la barre latérale et carte du
  tableau de bord branchés sur les alertes ouvertes.
- Tests : rejet sans justification refusé, précision calculée, notification publiée.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/dossiers/*`, `apps/web/src/app/(app)/alertes/*`.
