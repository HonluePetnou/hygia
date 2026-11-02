# 003 - Journal d'audit chaîné par hachage avec horloges de Lamport

**Phase** : 2 — Services
**Dépend de** : 001

## Contexte

RF24 et section 11.1 : chaque lecture et modification de dossier est journalisée dans un
journal chaîné par hachage, infalsifiable ; chaque entrée porte une estampille de Lamport
(section 7.5). En production : Lambda + S3 Object Lock ; ici, une bibliothèque testable.

## Objectif

Créer `services/audit` (`@hygia/audit`) : bibliothèque TypeScript pure, sans base ni réseau.

## Critères de fini

- `LamportClock` : `tick()`, `receive(remote)` (max + 1), valeur courante.
- `AuditLog` construit avec un `AuditStore` (interface) ; implémentation `InMemoryAuditStore`.
  - `append({ actor, role, action, resourceType, resourceId, patientId, reason })` calcule
    l'estampille de Lamport, le `previousHash`, et `hash = SHA-256(previousHash + JSON
canonique de l'entrée)` (module `node:crypto`). Renvoie l'`AuditEvent` créé.
  - `verify()` renvoie `{ intact: true } | { intact: false, brokenAt: number }`.
  - `forPatient(patientId)` : accès au dossier d'un patient (« Qui a vu mon dossier ? »).
- Actions : `lecture`, `modification`, `creation`, `bris_de_glace`, `question_copilote`,
  `alerte_ia`, `import_document`, `export`.
- Tests Vitest : chaîne intacte après 100 entrées ; modifier une entrée au milieu est
  détecté à la bonne position ; ordre de Lamport strictement croissant ; `forPatient` filtre.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/audit/*`.
