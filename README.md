# HYGIA

Plateforme répartie d'analyse des dossiers patients sur AWS, augmentée par l'intelligence artificielle.

Projet du groupe **G2** — _Architecture logicielle et objets répartis_, ENSPD, filière GIT, option Génie Logiciel, niveau 5 (2026-2027).
Enseignant : M. Elve Charlu Tchuigoua. Chef de groupe : PETNOU HONLUE Frédéric Armel.

Le cahier des charges complet est dans [`docs/cahier-des-charges-hygia-g2.pdf`](docs/cahier-des-charges-hygia-g2.pdf).

> Toutes les données utilisées pour la démonstration sont **fictives**.

## Le projet

HYGIA centralise, sécurise et analyse les dossiers patients des établissements de santé camerounais :

- un médecin pose une question en français sur un patient et reçoit une réponse qui **cite ses sources** ;
- un agent IA **surveille les prescriptions** (interactions, allergies, doublons) ;
- une **carte épidémiologique** se met à jour en temps réel ;
- un centre rural travaille **hors ligne** puis se resynchronise sans perte ;
- le patient reçoit ses rappels sur **WhatsApp** et voit **qui a consulté son dossier**.

L'IA aide à la décision : **rien ne modifie un dossier sans la validation d'un soignant**.
La plateforme est bilingue (français, anglais) et respecte la loi camerounaise n° 2024/017 sur les données personnelles.

## Architecture

Six patrons, chacun pour son domaine (section 6 du cahier) :

| Patron                     | Rôle dans HYGIA                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| Trois étages               | Présentation → logique → données ; la présentation n'atteint les données qu'à travers le broker        |
| Client-serveur avec broker | API Gateway est le point d'entrée unique                                                               |
| Micro-services             | 8 services faiblement couplés, chacun propriétaire de ses données                                      |
| Tubes et filtres           | Chaîne d'ingestion : réception → OCR → normalisation FHIR → extraction IA → détection des identifiants |
| MVVM                       | Vues-modèles MobX partagées entre le web et le mobile                                                  |
| Multi-agents               | Agents IA abonnés au bus d'événements (tri, pharmacovigilance, qualité, veille)                        |

```
Présentation   apps/web (Next.js)   apps/mobile (Expo, hors ligne)   WhatsApp/SMS   portail patient
                          │ HTTPS
Broker         API Gateway + WAF
                          │ routage par nom
Logique        dossiers · ingestion · ia-clinique · agents · identite · synchronisation · notification · audit
                          │ bus : EventBridge, SQS FIFO, SNS
Données        Aurora PostgreSQL + pgvector · S3 versionné · S3 Object Lock (audit) · DynamoDB
```

## Organisation du dépôt

Monorepo pnpm + Turborepo.

```
apps/
  web/               Client web Next.js (MVVM) : espaces soignant, analyste, auditeur, patient, admin
  mobile/            Client Expo hors ligne (SQLite)
services/
  dossiers/          API FHIR patients et dossiers, contrôle de version optimiste (NestJS)
  ingestion/         Chaîne tubes et filtres (Lambda + Step Functions)
  ia-clinique/       Copilote RAG, résumé pré-consultation, scribe (NestJS, flux SSE)
  agents/            Agents IA : tri, pharmacovigilance, qualité, veille épidémiologique (Python)
  identite/          Comptes, rôles, équipes de soins, bris de glace (Cognito + Lambda)
  synchronisation/   Fusion hors ligne par horloges vectorielles (NestJS)
  notification/      WhatsApp, SMS, e-mail (Lambda + SNS)
  audit/             Journal chaîné par hachage, horloges de Lamport (Lambda)
packages/
  view-models/       Vues-modèles MobX partagées web/mobile
  i18n/              Libellés français et anglais
  types/             Types TypeScript partagés
  fhir/              Modèles et validation FHIR R4
infra/
  cdk/               Infrastructure AWS en code (CDK)
  localstack/        Initialisation des ressources AWS simulées
docs/
  cahier-des-charges-hygia-g2.pdf
  adr/               Décisions d'architecture
```

Les dossiers sont créés ; le code arrive par tranches (voir _État d'avancement_).

## Stack

| Couche           | Choix                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Monorepo         | pnpm + Turborepo, TypeScript strict                                                                        |
| Web / mobile     | Next.js et Expo (SQLite pour le hors ligne), vues-modèles MobX partagées                                   |
| Services         | NestJS sur ECS Fargate ; Lambda pour les filtres, l'audit et les notifications ; Python pour les agents IA |
| Données          | Prisma → Aurora PostgreSQL + pgvector, S3 versionné, DynamoDB                                              |
| Messages         | API Gateway, EventBridge, SQS FIFO, SNS, Step Functions, Kinesis                                           |
| IA               | Bedrock (Claude ou Mistral, choisi après banc d'essai), Textract, Transcribe, Guardrails                   |
| Sécurité         | Cognito (double authentification), KMS, audit sur S3 Object Lock                                           |
| Infra et qualité | AWS CDK, GitHub Actions, CloudWatch / X-Ray, Fault Injection Service                                       |
| En local         | Docker Compose : PostgreSQL/pgvector et LocalStack, sans compte AWS                                        |

La liste détaillée des outils est dans [`OUTILS.md`](OUTILS.md).

## Lancer le projet en local

Prérequis : Node 22+, pnpm 10+, Docker.

```bash
cp .env.example .env
pnpm install
docker compose up -d     # PostgreSQL + LocalStack (S3, SQS, SNS, EventBridge, DynamoDB…)
pnpm dev                 # lance les applications et services
```

Vérifier LocalStack : `curl http://localhost:4566/_localstack/health`.

## Lancer la démo

Prérequis : Node 22+ et pnpm 10+ ; Python 3 pour le service Agents (carte épidémiologique, risque de réadmission) ; Docker est facultatif.

```bash
pnpm install
pnpm demo
```

`pnpm demo` lance `docker compose up -d` si Docker est disponible, sinon bascule en mode hors ligne
(`NEXT_PUBLIC_DEMO_OFFLINE=1`, données en mémoire). Il démarre ensuite les services `dossiers` (port 3001),
`ia-clinique` (port 3003), `identite` (port 3004 : comptes, TOTP, jetons JWT), le broker (port 3000, seul point d'entrée du web : `/api/<service>/...`) et le web, puis affiche l'URL à ouvrir : **http://localhost:3100**, et le
compte de démo. En mode normal, la connexion passe par le service Identité (voir
[`services/identite/README.md`](services/identite/README.md)) : `aicha.nana@hd-bonassama.cm` / `Hygia-demo-2026`,
code 2FA **réel** donné par `pnpm --filter identite code` (code de secours : `DEMO-0001`). En mode hors ligne,
la connexion est simulée : tout mot de passe et **code 2FA `481516`**. Ctrl+C arrête tout. `DEMO_NO_DOCKER=1 pnpm demo` force le mode hors ligne.

Le scénario pas à pas est décrit dans [`docs/demo.md`](docs/demo.md).

`pnpm package:usb` produit `dist-usb/` (cahier des charges, archive du code, `OUTILS.md`, `demo.md`) ;
l'archive contient les fichiers commités du dépôt.

## Exigences (MoSCoW)

28 exigences, détaillées en section 3 du cahier.

- **Must (19, démonstration minimale)** : ingestion multicanale, OCR, conversion FHIR (RF1-RF3) ; fusion des doublons et historique des versions (RF4-RF5) ; extraction codée CIM-10 (RF6) ; résumé pré-consultation et copilote sourcé (RF7-RF8) ; pharmacovigilance (RF10) ; traitements asynchrones (RF13) ; recherche, chronologie, tableaux de bord (RF14-RF16) ; double authentification, accès par rôle et équipe, bris de glace (RF22-RF23) ; audit infalsifiable (RF24) ; pseudonymisation (RF25) ; supervision (RF26) ; bilinguisme (RF28).
- **Should** : scribe, agent qualité, export PDF/CSV, carte épidémiologique, hors ligne, WhatsApp/SMS, portail patient, tests de pannes.
- **Could** : prédiction du risque de réadmission.

## État d'avancement

- [x] Cahier des charges v1.0 (31 octobre 2026)
- [x] Structure du monorepo, environnement local (Docker Compose + LocalStack)
- [x] Maquettes des 18 écrans : [Figma](https://www.figma.com/design/AOCqWU93igGqWj6e1C66Ix)
- [ ] Tranche de démonstration (tâches 001 à 011) : service Dossiers + audit, chaîne d'ingestion, copilote simulé, client web
- [ ] Architecture et fonctionnalités complètes (tâches 012 à 031) : broker, identité, agents IA, veille épidémiologique, portail patient, WhatsApp, mobile hors ligne, scribe, supervision, CDK

Le plan de développement détaillé est dans [`tasks/todo/`](tasks/todo/), exécuté par l'orchestrateur ([`orchestrator/`](orchestrator/README.md)).

## Équipe G2

| Pôle                          | Périmètre                                                      |
| ----------------------------- | -------------------------------------------------------------- |
| Architecture et coordination  | Dossier d'architecture, ADR, contrats d'interface, intégration |
| Infra, sécurité, DevOps       | CDK, IAM, KMS, CI/CD, observabilité, chaos                     |
| Ingestion et IA clinique      | Tubes et filtres, OCR, extraction, copilote, scribe            |
| Agents et épidémiologie       | Agents Bedrock, Kinesis, carte, élection du coordinateur       |
| Services métier et hors ligne | Dossiers, Identité, Audit, Synchronisation                     |
| Clients MVVM et WhatsApp      | Web, mobile, portail patient, WhatsApp, tableaux de bord       |

DJESSANG REPELE Joseph Emile · DJIKI DJIKI Junior Arthur · FANHE MEIDO Steven · FEUPA TCHAKOUNTE Pierre Nathan · FOMEKONG TATONG Alphred · HAPPE WAKAM Loïc Belmond · KAGA Marie Andrea · MOUNA DIPPAH Borel Freddy · NWAHA Thaddée · PETNOU HONLUE Frédéric Armel (chef de groupe)

## Contribuer

- Une branche par tâche (`feat/…`, `fix/…`), fusion par demande de fusion avec revue.
- Messages de commit conventionnels (`feat:`, `fix:`, `docs:`…).
- Chaque décision d'architecture est consignée dans `docs/adr/`.
