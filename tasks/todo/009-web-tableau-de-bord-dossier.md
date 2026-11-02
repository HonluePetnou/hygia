# 009 - Client web : tableau de bord et dossier patient

**Phase** : 3 — Clients
**Dépend de** : 004, 006, 008

## Contexte

Maquettes Figma « 02 · Accueil — tableau de bord médecin » et « 04 · Dossier patient —
chronologie et résumé IA » (RF7, RF15, RF16).

## Objectif

Écrans `/` et `/patients/[id]` branchés sur `DashboardViewModel` et `PatientRecordViewModel`,
avec les dépôts HTTP vers les services 004/006 (variables `NEXT_PUBLIC_DOSSIERS_URL`,
`NEXT_PUBLIC_IA_URL`) et repli sur les dépôts en mémoire si `NEXT_PUBLIC_DEMO_OFFLINE=1`.

## Critères de fini

- `/` : titre « Bonjour, Dr Nana », 4 indicateurs (Patients du jour, Alertes IA ouvertes,
  Documents en traitement, Résultats à valider), tableau des consultations du jour (heure,
  patient, motif, statut, bouton « Résumé IA »), carte des alertes IA (barre de couleur par
  gravité), carte des documents en cours (barre de progression), histogramme de la semaine.
- `/patients` : liste avec recherche par nom ou IPP.
- `/patients/[id]` : en-tête patient (avatar, nom, badges allergie / anticoagulant, ligne
  d'identité, boutons Exporter PDF et Demander au copilote), onglets, et trois colonnes :
  résumé pré-consultation IA (bordure violette, sections avec numéros de source, bouton
  « Valider le résumé », mention « aide à la décision »), chronologie filtrable (date à
  gauche, pastille d'icône, carte avec titre, badge de type, détail, auteur ; une alerte IA
  en bordure rouge), colonne droite constantes / traitements / équipe de soins.
- Un utilisateur hors équipe reçoit un écran « Accès refusé » avec un bouton « Accès
  d'urgence » qui ouvre une fenêtre de bris de glace (motif + précisions, mentions : 4 h, DPO
  alertée, visible par le patient) et appelle `POST /patients/:id/bris-de-glace`.
- Tests Testing Library : rendu du tableau de bord avec données en mémoire, filtre de la
  chronologie, ouverture de la fenêtre de bris de glace.
- `pnpm lint && pnpm typecheck && pnpm test` verts ; `pnpm --filter web build` passe.

## Fichiers probablement concernés

`apps/web/src/app/(app)/*`, `apps/web/src/components/*`.
