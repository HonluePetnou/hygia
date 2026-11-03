# Service Identité et accès

Équivalent local de Cognito + Lambda (RF22, RF23, section 11) : comptes, double authentification
TOTP, jetons JWT, équipes de soins et bris de glace. Données fictives uniquement. Port **3004**
(`IDENTITE_PORT`), documentation OpenAPI sur `/docs`.

## Connexion en deux étapes

1. `POST /auth/login` `{ email, password }` → `{ challengeId, mfa }` (`mfa: "enroll"` si le compte n'a pas encore d'application d'authentification).
2. (première connexion) `POST /auth/mfa/enroll` `{ challengeId }` → secret, URI `otpauth://` et QR code (`data:image/png`).
3. `POST /auth/mfa/verify` `{ challengeId, code }` ou `{ challengeId, backupCode }` → `{ accessToken, expiresAt, user }`. Après un enrôlement, la réponse contient aussi 8 `backupCodes` (affichés une seule fois, usage unique).

Une étape de connexion dure 5 minutes et accepte 5 essais de second facteur.

## Jeton

JWT ES256, **30 minutes**, avec `sub`, `role`, `teams` (équipes de soins) et `emergency` (accès
d'urgence actifs). La clé publique est exposée sur `/.well-known/jwks.json` : le broker, Dossiers et
IA clinique vérifient la signature sans appeler le service (variable `IDENTITE_JWKS_URL`, ou
`BROKER_SERVICE_IDENTITE_URL` pour le broker). `POST /auth/refresh` renouvelle un jeton encore valide.
`IDENTITE_JWT_PRIVATE_KEY` (PKCS#8 PEM) fixe la clé ; sans elle, une clé éphémère est créée à chaque démarrage.

## Comptes de démonstration (soutenance)

Mot de passe commun : **`Hygia-demo-2026`**.

| Rôle | E-mail |
| --- | --- |
| médecin (équipe Cardiologie) | `aicha.nana@hd-bonassama.cm` |
| infirmier (équipe Cardiologie) | `rose.mballa@hd-bonassama.cm` |
| administratif | `marthe.eyenga@hd-bonassama.cm` |
| analyste | `analyste@hygia.local` |
| patient | `florence.ngo@patient.hygia.local` |
| admin système | `admin@hygia.local` |
| auditeur / DPO | `dpo@hygia.local` |
| médecin hors équipe | `paul.kamga@cma-bepanda.cm` |

**Code 2FA de démo** : le TOTP est réel (RFC 6238, otplib). Tous les comptes de démo partagent le
secret `KRUGKIDROVUWG2ZAMJZG653OEBTYQSZY`, à saisir dans une application d'authentification, ou
`pnpm --filter identite code` pour afficher le code courant. Codes de secours : `DEMO-0001`,
`DEMO-0002`, `DEMO-0003` (usage unique, par compte, jusqu'au redémarrage du service).

## Politique d'accès

- `POST /bris-de-glace` `{ patientId, motif, precisions? }` (médecin ou infirmier) : accès de 4 h, événement `bris_de_glace.ouvert` à destination de la DPO sur le bus (en mémoire ici), nouveau jeton qui porte l'accès. Dossiers trace ensuite le motif dans l'audit (`POST /patients/:id/bris-de-glace`, qui exige l'accès dans le jeton).
- `/comptes` et `/equipes` : réservés au rôle `admin`. L'admin gère comptes et équipes mais Dossiers et IA clinique refusent tout jeton admin sur les données de santé.
- Les équipes de soins viennent du jeu FHIR de démonstration (Cardiologie) ; un ajout de membre prend effet au prochain jeton.

Les comptes, équipes, accès d'urgence et le bus sont en mémoire et repartent de zéro au redémarrage.
