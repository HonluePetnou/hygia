# 008 - Client web : socle Next.js, design system et connexion 2FA

**Phase** : 3 — Clients
**Dépend de** : 002, 007

Tâche destinée au Lead (démo du jeudi 5 novembre : pas d'essai par les juniors).

## Contexte

Maquettes Figma : https://www.figma.com/design/AOCqWU93igGqWj6e1C66Ix (page « Web —
soignants & admin », écran « 01 · Connexion »). Si tu ne peux pas ouvrir Figma, la
description ci-dessous fait foi.

Design system :

- Police Plus Jakarta Sans (`next/font/google`), corps 14 px, titres 24/18/15 px gras.
- Couleurs (variables CSS) : primaire `#0E7C6B` (survol `#0A6457`, doux `#E3F3EF`), encre /
  barre latérale `#0B1B2B`, IA `#6750D8` (doux `#EEEBFC`, réservé à tout ce qui vient de
  l'IA), fond `#F3F5F7`, surface `#FFFFFF`, bordure `#E2E7EC`, texte `#0B1B2B` / `#566676` /
  `#8A97A5`, danger `#D23F3F` (doux `#FDECEC`), alerte `#C9821A` (`#FDF3E2`), succès
  `#178A5B` (`#E4F5EC`), info `#2563C9` (`#E7EFFC`).
- Rayons 6/10/14/20 px ; ombre carte légère ; icônes au trait 1,75 (lucide-react autorisé).

## Objectif

Créer `apps/web` (Next.js app router, TypeScript strict) avec le design system et le parcours
de connexion, branché sur `SessionViewModel` (`@hygia/view-models`).

## Critères de fini

- Composants de base dans `apps/web/src/components/ui/` : `Button` (primaire, secondaire,
  fantôme, IA, danger), `Badge` (neutre, danger, alerte, succès, info, IA), `Input`, `Card`,
  `Avatar`.
- Mise en page authentifiée : barre latérale sombre 264 px (logo HYGIA, établissement,
  sections Clinique / Analyse / Conformité, utilisateur en bas avec « Session vérifiée · 2FA »)
  et barre supérieure 72 px (recherche, état réseau, bascule FR/EN, notifications).
- Écran `/connexion` en deux colonnes : panneau marque à gauche (dégradé encre → vert,
  accroche « La mémoire clinique de vos patients, sécurisée et bilingue. », 3 atouts), à
  droite étape 1 identifiants puis étape 2 code à 6 chiffres (6 cases), bouton « Vérifier et
  continuer », mention d'audit. Code de démo `481516` → redirection vers `/`.
- Bascule FR/EN fonctionnelle partout (libellés via `@hygia/i18n`, aucun texte en dur).
- Accessibilité : libellés de champs, focus visible, contraste AA.
- Test (Vitest + Testing Library) : parcours de connexion avec bon et mauvais code.
- `pnpm lint && pnpm typecheck && pnpm test` verts ; `pnpm --filter web build` passe.

## Fichiers probablement concernés

`apps/web/*`.
