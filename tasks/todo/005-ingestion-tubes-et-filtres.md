# 005 - Chaîne d'ingestion en tubes et filtres

**Phase** : 2 — Services
**Dépend de** : 001

Tâche destinée au Lead (démo du jeudi 5 novembre : pas d'essai par les juniors).

## Contexte

Section 8.2 : chaque document traverse des filtres indépendants reliés par des tubes :
1 Réception, 2 OCR, 3 Normalisation FHIR, 4 Extraction IA (entités + CIM-10), 5 Détection
des identifiants, puis deux branches : 6a clinique (indexation), 6b analytique
(pseudonymisation). Chaque filtre est idempotent et ne connaît que ses voisins. En production :
Lambda + Step Functions + SQS ; ici, une version locale testable.

## Objectif

Créer `services/ingestion` (`@hygia/ingestion`) : bibliothèque TypeScript + petit CLI.

## Critères de fini

- Interface `Filter<In, Out>` (`name`, `process(input): Promise<Out>`) et `Pipeline` qui
  enchaîne les filtres, émet un événement par étape (`started | done | failed`, durée) et
  envoie un document en échec dans une file de lettres mortes (en mémoire).
- Interface `Pipe` avec `InMemoryPipe` ; un `SqsPipe` (LocalStack, `AWS_ENDPOINT_URL`) est
  optionnel et non utilisé par les tests.
- Filtres :
  - Réception : vérifie le type (PDF, image, CSV, JSON), calcule l'empreinte SHA-256 ;
    un même document reçu deux fois n'est traité qu'une fois (idempotence).
  - OCR : `OcrEngine` (interface) ; `MockOcrEngine` renvoie le texte associé aux documents
    fictifs (dont l'ordonnance manuscrite de Florence : « Ibuprofène 400 mg : 1 cp × 3/j pdt
    5 jours », « Lombalgies »).
  - Normalisation : produit un `DocumentReference` FHIR valide (`@hygia/fhir`).
  - Extraction : dictionnaire local (médicaments → ATC, diagnostics → CIM-10, posologies,
    dates) avec score de confiance ; ibuprofène → M01AE01, lombalgie → M54.5.
  - Détection des identifiants : repère noms de praticiens/patients, téléphones, dates.
  - Pseudonymisation : remplace chaque identifiant par un jeton HMAC stable (clé en variable
    d'environnement, valeur de démo par défaut).
- CLI `pnpm --filter ingestion ingest <fichier>` qui affiche les étapes et le résultat.
- Tests Vitest : chaîne complète sur l'ordonnance de Florence (entités et codes attendus),
  idempotence de la réception, aucun nom en clair dans la sortie analytique, document invalide
  → lettres mortes.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`services/ingestion/*`.
