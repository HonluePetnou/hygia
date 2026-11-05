# ADR 0002 — Persistance du service Dossiers

- Statut : accepté
- Date : 2026-11-05

## Contexte

Jusqu'ici, toutes les données de Dossiers vivaient en mémoire et disparaissaient à l'arrêt du
service. Le cahier prévoit Prisma et PostgreSQL, une base par service. Deux contraintes :

- l'interface `PatientRepository` est **synchrone** (`findById` renvoie un `Patient`), et une
  vingtaine de services de Dossiers en dépendent ; un accès base est asynchrone ;
- le schéma relationnel ébauché (`prisma/schema.prisma`, jamais utilisé) ne couvrait qu'une partie
  des ressources FHIR (ni diagnostics, ni allergies, ni codages, ni références) et demandait du
  code de correspondance pour dix types de ressources.

## Décision

1. **Stockage** : une table `fhir_resource` (clé type + identifiant, patient, version, contenu
   `jsonb`), gérée par Prisma 7 (adaptateur `pg`) et des migrations versionnées. C'est le format
   courant des serveurs FHIR : chaque ressource est gardée entière, indexée par patient.
2. **Accès** : `PersistentPatientRepository` enveloppe le dépôt en mémoire, qui reste le cache de
   travail (lectures synchrones, services inchangés). Au démarrage, il est chargé depuis la base
   (remplie avec le jeu de données si elle est vide). Après chaque modification (fiche, document,
   consultation, fusion, annulation de fusion), les ressources changées sont écrites dans l'ordre,
   en une transaction. Base injoignable : le service continue, l'écriture repart à la suivante.
3. **Activation** : `DOSSIERS_DATABASE_URL`. Absente, comportement inchangé (tests, mode hors
   ligne). `DEMO_INFRA=1 pnpm demo` démarre PostgreSQL, crée la base `dossiers`, applique les
   migrations et active la persistance.

## Conséquences

- Les données de Dossiers survivent aux redémarrages ; les tests restent sans base (un test
  d'intégration tourne avec `DOSSIERS_TEST_DATABASE_URL`).
- Le cache impose **une seule instance** de Dossiers par base : deux instances ne verraient pas
  les écritures l'une de l'autre. Passer à plusieurs instances demandera un dépôt asynchrone
  (lecture en base à chaque requête) : l'interface `PatientRepository` devra alors devenir
  asynchrone.
- Les recherches par critère clinique se font en mémoire ; à grande échelle, des index `jsonb`
  (GIN) ou des colonnes dédiées seront nécessaires.
- Restent en mémoire : alertes, consentements, journal d'audit local (transmis au service Audit),
  autorisations de bris de glace. Ils suivront le même modèle.
- PostgreSQL écoute sur le port hôte 54320 (`HYGIA_POSTGRES_PORT`) pour éviter le conflit avec un
  autre PostgreSQL local sur 5432.
