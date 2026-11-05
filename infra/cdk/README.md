# Infrastructure AWS de HYGIA (CDK)

Toute l'architecture de la section 9 du cahier, en TypeScript, en six piles :

| Pile | Contenu |
| --- | --- |
| `HygiaReseau` | VPC sur 2 zones (public, privé, isolé), NAT, points de terminaison VPC (S3, DynamoDB, SQS, SNS, KMS, Secrets Manager, ECR, CloudWatch Logs, Bedrock, Textract), journaux de flux |
| `HygiaDonnees` | 3 clés KMS (clinique, analytique, audit), Aurora PostgreSQL Serverless v2 Multi-AZ (pgvector), S3 versionné (documents, lac analytique, artefacts), S3 Object Lock en mode conformité (audit, 10 ans), DynamoDB (baux) |
| `HygiaMessages` | EventBridge (+ archive), SQS FIFO d'ingestion avec lettres mortes, SNS des alertes, Kinesis analytique |
| `HygiaCalcul` | ECS Fargate (Dossiers, IA clinique, Synchronisation derrière un ALB interne ; broker derrière un NLB), 2 tâches sur 2 zones ; Lambda (ingestion, agents, notification, audit) ; Step Functions pour la chaîne d'ingestion ; X-Ray |
| `HygiaAcces` | API Gateway (lien VPC vers le broker), WAF (règles gérées AWS + limite par IP), Cognito avec double authentification obligatoire |
| `HygiaObservabilite` | Tableau de bord et alarmes CloudWatch (p95 < 2 s, 5xx, lettres mortes), expérience FIS (arrêt de 50 % des tâches Dossiers), AWS Backup quotidien, AWS Budgets (50 $/mois) |

## Commandes

```bash
pnpm --filter @hygia/infra-cdk test    # assertions (Object Lock, aucune base publique, KMS partout, 2 zones…)
pnpm --filter @hygia/infra-cdk synth   # modèles CloudFormation dans cdk.out/
```

La synthèse **n'appelle jamais AWS**, même si des identifiants sont configurés sur la machine : les
piles ne dépendent d'aucun compte. Pour déployer, donner le compte explicitement :

```bash
HYGIA_AWS_ACCOUNT=123456789012 pnpm --filter @hygia/infra-cdk exec cdk deploy --all -c budgetEmail=equipe@exemple.org
```

Avant le déploiement : construire les images (`hygia/<service>` dans ECR) et déposer les paquets
Lambda dans le compartiment d'artefacts (`services/<nom>.zip`). Non fait : aucun déploiement réel.
