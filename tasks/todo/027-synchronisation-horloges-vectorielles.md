# 027 - Service Synchronisation : horloges vectorielles et fusion sans perte

**Phase** : 7 — Fonctionnalités Should
**Dépend de** : 012

## Contexte

RF19 et section 7.5 : chaque terminal et le serveur tiennent un vecteur de compteurs par
ressource. À la synchronisation, si un vecteur domine l'autre, la version la plus récente
gagne ; s'ils sont concurrents, le conflit est détecté. Les ajouts (observations, constantes)
fusionnent automatiquement ; les modifications concurrentes d'un même champ sont présentées
au soignant. Objectif : 72 h hors ligne, resynchronisation sans perte ni doublon.

## Objectif

Créer `services/synchronisation` (NestJS) et une bibliothèque d'horloges réutilisable par le
mobile.

## Critères de fini

- `packages/sync-core` (TypeScript pur) : `VectorClock` (incrément, fusion, comparaison :
  avant / après / égal / concurrent), `mergeChanges(local, remote)` → `{ merged, conflicts }`.
- Endpoint `POST /sync` (lot de changements d'un terminal avec horloges, clé d'idempotence
  par changement) → changements fusionnés, conflits à arbitrer, nouvelles horloges ;
  `POST /sync/conflits/:id/arbitrage` (choix tracé dans l'audit).
- Exactement une fois au niveau métier : un lot rejoué n'entraîne aucun doublon.
- Tests sur les scénarios de la maquette « 17 » : 6 ajouts fusionnés automatiquement ;
  posologie du furosémide modifiée sur la tablette (40 mg) et sur le serveur (20 mg) →
  conflit ; lot rejoué → aucun doublon ; coupure longue simulée (72 h).
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`packages/sync-core/*`, `services/synchronisation/*`.
