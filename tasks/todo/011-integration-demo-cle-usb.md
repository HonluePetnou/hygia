# 011 - Intégration, script de démo et livrable clé USB

**Phase** : 4 — Livraison
**Dépend de** : 004, 005, 006, 010

Tâche destinée au Lead.

## Contexte

L'enseignant récupère jeudi 5 novembre une clé USB avec le cahier des charges en PDF, un code
source qui fonctionne et la liste des outils utilisés. Il doit pouvoir lancer la démo sur sa
machine en suivant le README.

## Objectif

Rendre la tranche lançable en une commande et vérifiée de bout en bout.

## Critères de fini

- Script racine `pnpm demo` : lance `docker compose up -d` si Docker est disponible (sinon
  mode `NEXT_PUBLIC_DEMO_OFFLINE=1`), puis démarre en parallèle `dossiers`, `ia-clinique` et
  `web`, et affiche l'URL à ouvrir et le code 2FA de démo.
- Scénario vérifié à la main et décrit dans `docs/demo.md` : connexion 2FA → tableau de bord
  → dossier de Florence Ngo Bassa (alerte d'interaction) → question au copilote avec sources
  → question en anglais → import de l'ordonnance (étapes + entités) → journal des accès du
  dossier (bris de glace visible).
- README : section « Lancer la démo » testée sur un clone propre ; `OUTILS.md` à jour avec
  les versions réellement utilisées.
- Script `pnpm package:usb` qui produit `dist-usb/` : le PDF du cahier des charges, une archive
  du code source sans `node_modules` ni `.env`, `OUTILS.md` et `docs/demo.md`.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verts.

## Fichiers probablement concernés

`package.json`, `scripts/*`, `README.md`, `OUTILS.md`, `docs/demo.md`.
