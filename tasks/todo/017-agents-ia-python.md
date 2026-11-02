# 017 - Système multi-agents : pharmacovigilance, qualité, tri (Python)

**Phase** : 6 — Fonctionnalités Must
**Dépend de** : 001

## Contexte

Sections 6.6 et 8.5, RF10, RF11 : des agents autonomes abonnés au bus d'événements réagissent
chacun à un type d'événement et publient des alertes expliquées (raisonnement + sources).
Ajouter un agent ne modifie aucun composant existant.

## Objectif

Créer `services/agents` en Python (bibliothèque standard uniquement pour les tests) avec un
`package.json` dont les scripts appellent Python, pour que Turborepo les exécute.

## Critères de fini

- `package.json` : `lint` = `python3 -m compileall -q src`, `typecheck` = `python3 -m
compileall -q src tests`, `test` = `python3 -m unittest discover -s tests`.
- Bus d'événements (interface) : implémentation en mémoire et implémentation HTTP qui reçoit
  les événements publiés par les services (équivalent local d'EventBridge).
- Classe de base `Agent` (type d'événement écouté, `handle(event) -> list[DetectedIssue]`)
  et registre ; un agent s'ajoute sans modifier les autres.
- Agent de pharmacovigilance (nouvelle prescription) : table d'interactions locale (AVK +
  AINS → majeure ; IEC + IEC → doublon thérapeutique), allergies connues (pénicilline →
  amoxicilline). Gravité relevée selon le contexte (âge ≥ 70, INR haut de cible).
- Agent qualité (nouveau document normalisé) : valeurs aberrantes (créatininémie 1 450
  µmol/L), dates impossibles, champs manquants, avec proposition de correction.
- Agent de tri (nouveau document) : classe le document et propose le patient à rattacher.
- Chaque `DetectedIssue` contient : agent, gravité, titre, étapes de raisonnement numérotées,
  sources (documents), proposition ; format JSON identique aux types de `@hygia/types`.
- Tests unittest : ordonnance d'ibuprofène de Florence → alerte critique avec 4 étapes et 3
  sources ; amoxicilline chez un allergique ; créatinine aberrante ; agent ajouté dynamiquement.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/agents/*`.
