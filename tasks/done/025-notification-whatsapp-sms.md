# 025 - Service Notification : WhatsApp, SMS et réception de photos

**Phase** : 7 — Fonctionnalités Should
**Dépend de** : 005, 018
**Maquettes** : `docs/maquettes/14-whatsapp.png` — ouvre ces images avant de coder pour la mise en page ; en cas de doute, le texte de la tâche fait foi.

## Contexte

RF1, RF20 et maquette « 14 · WhatsApp » : rappel de rendez-vous (« Répondez 1 pour confirmer,
2 pour reporter »), confirmation, photo d'ordonnance envoyée par la patiente puis « Document
reçu », message validé par le médecin sur l'interaction. En production : API WhatsApp
Business (bac à sable) via Lambda + SNS.

## Objectif

Créer `services/notification` (NestJS) avec des canaux interchangeables.

## Critères de fini

- Interface `ChannelSender` : WhatsApp (bac à sable), SMS (SNS LocalStack), e-mail, et
  implémentation console pour la démo ; modèles de messages FR/EN selon la langue du patient.
- Planification des rappels (veille du rendez-vous) ; réponses « 1 » / « 2 » traitées.
- Webhook entrant WhatsApp : une photo devient un document envoyé dans la chaîne d'ingestion
  (tâche 005) avec le canal « WhatsApp ».
- Un message lié à une alerte critique n'est envoyé qu'après validation d'un soignant
  (événement de la tâche 018).
- Notifications dans l'application (cloche de la barre supérieure, RF13) : fin d'une analyse
  longue (ingestion, résumé), nouvelle alerte IA, poussées en SSE via le broker.
- Sémantique « au plus une fois » acceptée pour les rappels (section 7.3), documentée.
- Tests : rappel en français et en anglais, confirmation, photo transmise à l'ingestion,
  message critique bloqué sans validation.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/notification/*`.
