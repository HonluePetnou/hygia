# 013 - Service Identité et accès : comptes, double authentification réelle, rôles, équipes

**Phase** : 5 — Architecture complète
**Dépend de** : 012

## Contexte

RF22, RF23, section 11 : double authentification obligatoire pour le personnel médical,
sessions courtes, accès par rôle (RBAC) et par équipe de soins (ABAC), bris de glace 4 h.
En production : Cognito + Lambda ; ici, un service local au même contrat.

## Objectif

Créer `services/identite` (NestJS) et remplacer l'authentification simulée par en-têtes
(`x-user-id`, `x-user-role`) de tous les services par un jeton vérifié.

## Critères de fini

- Comptes de démo pour chaque rôle (médecin, infirmier, administratif, analyste, patient,
  admin système, auditeur/DPO), mots de passe hachés (argon2 ou bcrypt).
- Double authentification TOTP réelle (otplib) : enrôlement avec QR code, vérification ;
  code de démo documenté pour la soutenance. Codes de secours.
- Jeton JWT signé, durée 30 min, contenant rôle, équipes de soins et accès d'urgence actifs ;
  clé publique exposée (`/.well-known/jwks.json`) ; le broker et les services la vérifient.
- Équipes de soins (`CareTeam`) et bris de glace stockés ici : `POST /bris-de-glace` crée un
  accès de 4 h et notifie la DPO (événement sur le bus).
- Politique : l'administrateur gère comptes et équipes mais aucun jeton admin n'ouvre de
  donnée de santé (vérifié par test sur le service Dossiers).
- Écran de connexion web (tâche 008) branché sur ce service.
- Tests Jest : TOTP valide/invalide, expiration du jeton, refus admin sur un dossier, accès
  d'urgence expiré après 4 h (horloge simulée).
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/identite/*`, gardes d'authentification des services, `packages/view-models`.
