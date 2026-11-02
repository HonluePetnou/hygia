# 031 - Infrastructure AWS en code (CDK) et intégration continue

**Phase** : 8 — Déploiement
**Dépend de** : 012

Tâche destinée au Lead.

## Contexte

Sections 5.2, 9 et 11 : infrastructure entièrement décrite avec AWS CDK ; CI GitHub Actions
sur chaque demande de fusion (section 13). Le budget de démonstration est plafonné par des
alertes AWS Budgets.

## Objectif

Créer `infra/cdk` (TypeScript) qui synthétise toute l'architecture sans compte AWS, et la CI.

## Critères de fini

- Piles CDK : réseau (VPC, sous-réseaux privés, VPC endpoints), données (Aurora PostgreSQL
  Multi-AZ avec pgvector, S3 versionné, S3 Object Lock en mode conformité pour l'audit,
  DynamoDB pour les baux, clés KMS distinctes par branche), messages (EventBridge, SQS FIFO
  - lettres mortes, SNS, Kinesis), calcul (ECS Fargate derrière un ALB sur 2 zones pour
    Dossiers, IA clinique, Synchronisation ; Lambda pour ingestion, agents, notification,
    audit ; Step Functions pour la chaîne), accès (API Gateway + WAF, Cognito avec 2FA),
    observabilité (CloudWatch, X-Ray), Fault Injection Service, AWS Backup, AWS Budgets.
- `cdk synth` fonctionne hors ligne ; tests d'assertions CDK (Object Lock activé, aucune
  base publique, chiffrement KMS partout, 2 zones pour les services Fargate).
- `.github/workflows/ci.yml` : installation pnpm, `pnpm lint`, `pnpm typecheck`, `pnpm test`
  sur chaque push et demande de fusion.
- `pnpm lint && pnpm typecheck && pnpm test` verts.

## Fichiers probablement concernés

`infra/cdk/*`, `.github/workflows/ci.yml`.
