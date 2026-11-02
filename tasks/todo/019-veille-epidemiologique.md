# 019 - Veille épidémiologique : détection des foyers et élection du coordinateur

**Phase** : 7 — Fonctionnalités Should
**Dépend de** : 005, 017

## Contexte

Section 8.5 et RF18, RF25 : l'agent de veille compte les cas par pathologie et district à
partir des diagnostics pseudonymisés et alerte quand le nombre dépasse la moyenne mobile + 2
écarts-types. Section 7.5 : ce calcul ne doit tourner qu'une fois, sur l'instance qui détient
un bail (DynamoDB) ; si elle tombe, le bail expire et une autre est élue. Flux temps réel :
Kinesis en production.

## Objectif

Ajouter l'agent de veille et l'API d'analyse, sur la branche analytique uniquement.

## Critères de fini

- Agent de veille (Python, dans `services/agents`) : agrégats hebdomadaires par pathologie
  et district, seuil moyenne mobile 8 semaines + 2σ, alerte « foyer anormal ». Jeu fictif :
  choléra à Mora, 14 cas en semaine 44 pour 3,2 attendus (seuil 7,1), 12 villes du Cameroun.
- Élection du coordinateur par bail : interface `LeaseStore` (en mémoire + DynamoDB
  LocalStack) avec durée et renouvellement ; deux instances simulées, une seule calcule ;
  la perte du détenteur fait élire l'autre après expiration.
- API analyste (rôle `analyste` seulement) : cas par district et pathologie, série des 12
  dernières semaines avec seuil, districts les plus touchés, flux SSE des nouveaux cas
  (équivalent local de Kinesis). Aucune donnée identifiante dans les réponses.
- Tests : détection du foyer de Mora, aucun foyer sur une série stable, élection et
  basculement, réponse sans nom ni IPP.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/agents/*`, `services/broker` (route), éventuel module analytique.
