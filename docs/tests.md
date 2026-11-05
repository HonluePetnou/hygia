# Plan et rapport de tests — HYGIA

Mesuré le 5 novembre 2026 sur la branche `dev` (commit `e997c56`), Windows 11, Node 24, Python 3.14.

## 1. Stratégie

| Niveau | Outils | Ce qui est vérifié |
| --- | --- | --- |
| Unitaire | Vitest, Jest (NestJS), `unittest` (Python) | Logique pure : horloges, chaîne de hachage, filtres d'ingestion, règles des agents, vues-modèles MobX, traductions |
| Intégration de service | Jest + Supertest, `ThreadingHTTPServer` | Chaque service démarré en mémoire et appelé en HTTP, avec de vrais jetons signés (contrôle d'accès, consentements, versions, conflits) |
| Composants web | Vitest + Testing Library (jsdom) | Écrans réels avec vues-modèles et passerelles en mémoire : parcours de connexion, copilote, import, portail, audit, administration |
| Intégration d'infrastructure | Tests ignorés sans variable d'environnement | PostgreSQL réel (`DOSSIERS_TEST_DATABASE_URL`), LocalStack (`HYGIA_LOCALSTACK_URL`) |
| Infrastructure en code | `aws-cdk-lib/assertions` | Modèles CloudFormation : Object Lock, aucune base publique, KMS partout, 2 zones |
| Bout en bout | Démo en mode services, navigateur et API | Les 12 étapes de `docs/demo.md` |

Règle de l'équipe (AGENTS.md) : pour un correctif, écrire d'abord le test qui échoue, puis le voir passer.
Commande : `pnpm turbo run lint typecheck test` (intégration continue : `.github/workflows/ci.yml`, PR #6).

## 2. Résultats (branche `dev`)

| Paquet | Tests | Résultat |
| --- | ---: | --- |
| web | 85 | ✅ |
| dossiers | 81 | ✅ |
| @hygia/view-models | 74 | ✅ |
| @hygia/agents (Python) | 31 | ✅ |
| mobile | 28 | ✅ |
| @hygia/audit | 26 | ✅ |
| ia-clinique | 26 | ✅ |
| broker | 25 | ✅ |
| @hygia/fhir | 23 | ✅ |
| identite | 17 | ✅ |
| notification | 16 | ✅ |
| @hygia/i18n | 12 | ✅ |
| @hygia/sync-core | 9 | ✅ |
| synchronisation | 8 | ✅ |
| @hygia/ingestion | 6 | ✅ |
| @hygia/observability | 4 | ✅ |
| @hygia/auth | 4 | ✅ |
| @hygia/types | 1 | ✅ |
| **Total** | **476** | **476 / 476** |

Lint et typecheck : 63 tâches sur 63 vertes.

Tests ajoutés ensuite, fusionnés le 5 novembre : persistance PostgreSQL (+6, PR #4), jeton du service
Agents (+8, PR #5), infrastructure CDK (+10, PR #6), LocalStack (+4, PR #7). Les tests d'intégration
PostgreSQL et LocalStack ne tournent qu'avec `DOSSIERS_TEST_DATABASE_URL` et `HYGIA_LOCALSTACK_URL`.

## 3. Vérifications de bout en bout (4–5 novembre 2026, mode services, Windows)

| Parcours | Résultat |
| --- | --- |
| Connexion avec TOTP réel (6 comptes) | ✅ |
| Tableau de bord, dossier de Florence, résumé IA sourcé, risque de réadmission 31 % | ✅ |
| Copilote FR (« ibuprofène ? ») et EN (« echocardiography ») avec sources | ✅ |
| Import de `ordonnance-florence.png` : 5 étapes, 5 entités codées (ATC, CIM-10) | ✅ |
| Alertes IA : raisonnement, sources, décision | ✅ |
| Bris de glace de Dr Kamga (lien direct, accès refusé, accès d'urgence) | ✅ |
| Carte épidémiologique : foyer de choléra à Mora | ✅ |
| Portail patient : accès réels (dont le bris de glace) transmis au service Audit | ✅ |
| Journal d'audit (DPO) : chaîne intègre | ✅ |
| Supervision : latences p95 mesurées | ✅ |
| Scribe : consentement audio, brouillon structuré, validation dans le dossier, audio supprimé | ✅ |
| Bascule de zone (`DEMO_TWO_INSTANCES=1`) : zone a coupée, le copilote répond par la zone b | ✅ |
| Persistance PostgreSQL : consultation retrouvée après redémarrage de Dossiers (PR #4) | ✅ |
| Port 3007 appelé avec `x-user-role: analyste` sans jeton : refusé, 401 (PR #5) | ✅ |
| Journal d'audit sur S3 Object Lock (LocalStack) : suppression refusée (PR #7) | ✅ |

## 4. Anomalies trouvées et corrigées pendant la recette

| Anomalie | Correctif |
| --- | --- |
| Trois copies de React (configuration pnpm `hoisted`) : web en 500 | `.npmrc` `node-linker=isolated` |
| Paquets internes non compilés sur un clone neuf | `pnpm demo` compile les dépendances |
| `docker compose` en échec : bascule silencieuse en mode hors ligne | Mode services par défaut |
| Services orphelins sous Windows après Ctrl+C | Arrêt de l'arbre de processus |
| Bris de glace impossible à montrer | Retour à la page demandée après connexion |
| Portail et audit sans accès réels | Dossiers transmet son journal au service Audit |
| « Copilote IA » sans effet visible | Page de choix du patient |
| Pluriels, heures en UTC, pas de déconnexion au portail | Corrigés |
| Port 3007 ouvert sans jeton | Vérification du jeton ES256 (PR #5) |
| `init.sh` LocalStack en CRLF : aucune ressource AWS créée sous Windows | `.gitattributes` (PR #7) |
| Baux DynamoDB dépendant de `boto3` (absent) | Client DynamoDB SigV4 en bibliothèque standard (PR #7) |

## 5. Limites

- **Tests intermittents sous charge** : la saisie clavier simulée (web) et le démarrage Nest (Dossiers) pouvaient
  dépasser 5 s quand tout tourne en parallèle ; délai porté à 15 s.
- **Non couvert** : application mobile sur un vrai téléphone ; déploiement AWS réel ; charge et performance
  au-delà de la mesure p95 de la démo ; **évaluation de l'IA (F1 ≥ 0,85) non mesurée**.
- **Intégration continue** : le workflow existe (PR #6) mais GitHub Actions est bloqué par la facturation du
  compte ; aucune exécution en ligne à ce jour.
