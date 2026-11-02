# 023 - Client web : administration des comptes, rôles et équipes

**Phase** : 6 — Fonctionnalités Must
**Dépend de** : 013, 008

## Contexte

Maquette « 11 · Administration » (Lionel Tchakounte, administrateur système) : titre
« Comptes et rôles », tableau des utilisateurs (nom, e-mail, badge de rôle, équipes, état de
la double authentification, dernière connexion), carte « Équipes de soins », carte « Politique
de sécurité » (2FA obligatoire, session 30 min, bris de glace 4 h, mots de passe 12 caractères).
L'administrateur n'a aucun accès aux données de santé.

## Objectif

Écran `/administration` branché sur le service Identité.

## Critères de fini

- Inviter un utilisateur, changer son rôle, l'ajouter à une équipe, réinitialiser sa double
  authentification, désactiver un compte ; chaque action est auditée.
- Gestion des équipes de soins (création, membres, patients rattachés).
- Barre latérale réduite à Conformité pour l'admin ; un lien direct vers un dossier patient
  renvoie « Accès refusé ».
- Tests : invitation, changement de rôle, refus d'accès aux dossiers.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`apps/web/src/app/(app)/administration/*`, `services/identite/*`.
