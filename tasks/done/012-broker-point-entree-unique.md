# 012 - Broker : point d'entrée unique devant les services

**Phase** : 5 — Architecture complète
**Dépend de** : 010

## Contexte

Sections 6.1 et 6.3 : le broker (API Gateway + WAF en production) est le seul point d'entrée.
Aucun client ne parle directement à un service ; le broker authentifie, localise le service
par son nom et transmet la requête (transparence de localisation, section 7.2).

## Objectif

Créer `services/broker` (NestJS) qui route `/api/<service>/...` vers les services par leur
nom, et faire passer le client web uniquement par lui.

## Critères de fini

- Registre de services par nom (`dossiers`, `ia-clinique`, `audit`, `ingestion`,
  `notification`, `synchronisation`, `identite`, `agents`) lu depuis l'environnement
  (équivalent local de Cloud Map) ; aucune adresse IP en dur.
- Proxy HTTP et SSE (le flux du copilote doit traverser le broker), propagation d'un en-tête
  `x-correlation-id` (généré si absent) pour tracer un appel de bout en bout.
- Limitation de débit simple par utilisateur (protection type WAF) et réponse 503 explicite si
  le service cible ne répond pas (délai configurable).
- `apps/web` n'utilise plus qu'une variable `NEXT_PUBLIC_API_URL` pointant vers le broker.
- `pnpm demo` démarre aussi le broker.
- Tests Jest : routage par nom, 404 service inconnu, 503 service muet, en-tête de corrélation
  propagé, limite de débit.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/broker/*`, `apps/web/src/lib/*`, `package.json` (script demo).
