# Outils utilisés — HYGIA (G2)

## Développement

| Outil               | Usage                                                 |
| ------------------- | ----------------------------------------------------- |
| Node.js 22          | Exécution des services et des clients TypeScript      |
| pnpm 10             | Gestionnaire de paquets, workspaces du monorepo       |
| Turborepo           | Orchestration et cache des tâches (build, lint, test) |
| TypeScript (strict) | Langage des services, du web et du mobile             |
| Python 3.12         | Agents IA                                             |
| Prettier, ESLint    | Formatage et analyse statique                         |
| Git, GitHub         | Gestion de versions, revue de code                    |
| GitHub Actions      | Intégration continue                                  |

## Frameworks et bibliothèques

| Outil                     | Usage                                           |
| ------------------------- | ----------------------------------------------- |
| Next.js                   | Client web                                      |
| Expo, Expo Router, SQLite | Client mobile hors ligne                        |
| MobX                      | Vues-modèles partagées (MVVM)                   |
| NestJS                    | Services Dossiers, IA clinique, Synchronisation |
| Prisma                    | Couche d'accès aux données                      |
| Jest, pytest              | Tests unitaires                                 |

## Données et environnement local

| Outil                    | Usage                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Docker, Docker Compose   | Environnement local                                                                            |
| PostgreSQL 16 + pgvector | Base clinique et index vectoriel                                                               |
| LocalStack               | Simulation locale d'AWS (S3, SQS, SNS, EventBridge, DynamoDB, Step Functions, Kinesis, Lambda) |

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
