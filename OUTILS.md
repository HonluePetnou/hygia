# Outils utilisés — HYGIA (G2)

## Développement

| Outil               | Usage                                                 |
| ------------------- | ----------------------------------------------------- |
| Node.js 22.23       | Exécution des services et des clients TypeScript      |
| pnpm 10.28          | Gestionnaire de paquets, workspaces du monorepo       |
| Turborepo 2.11      | Orchestration et cache des tâches (build, lint, test) |
| TypeScript 5.9      | Langage des services, du web et du mobile (strict)    |
| Python 3 (3.14)     | Agents IA (bibliothèque standard pour les tests)      |
| Prettier, ESLint    | Formatage et analyse statique                         |
| Git, GitHub         | Gestion de versions, revue de code                    |
| GitHub Actions      | Intégration continue                                  |

## Frameworks et bibliothèques

| Outil                     | Usage                                           |
| ------------------------- | ----------------------------------------------- |
| Next.js 16.4, React 19.3  | Client web                                      |
| Expo, Expo Router, SQLite | Client mobile hors ligne (prévu)                |
| MobX 6.16                 | Vues-modèles partagées (MVVM)                   |
| NestJS 12.3               | Services Dossiers, IA clinique, Synchronisation |
| Prisma                    | Couche d'accès aux données (prévu)              |
| Jest 30 (NestJS)          | Tests unitaires des services NestJS             |
| Vitest 5.1                | Tests unitaires des paquets et du web           |

## Données et environnement local

| Outil                    | Usage                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Docker, Docker Compose   | Environnement local (facultatif pour la démo)                                                  |
| PostgreSQL 16 + pgvector | Image `pgvector/pgvector:pg16` : base clinique et index vectoriel                              |
| LocalStack 3.8           | Simulation locale d'AWS (S3, SQS, SNS, EventBridge, DynamoDB, Step Functions, Kinesis, Lambda) |

## AWS (cible de déploiement)

API Gateway, WAF, ECS Fargate, Lambda, Step Functions, EventBridge, SQS, SNS, Kinesis, Aurora PostgreSQL,
S3 (versionnement, Object Lock), DynamoDB, ElastiCache, Cognito, KMS, Secrets Manager, Bedrock
(Agents, Guardrails), Textract, Transcribe, SageMaker, CloudWatch, X-Ray, CloudTrail, Fault Injection
Service, AWS Backup, AWS Budgets, AWS CDK.

## Conception

| Outil       | Usage                                 |
| ----------- | ------------------------------------- |
| Figma       | Maquettes des interfaces              |
| HL7 FHIR R4 | Format d'échange des données de santé |
| CIM-10      | Codage des diagnostics                |
