import { Tags, type App, type Environment } from 'aws-cdk-lib';
import { AccessStack } from './access-stack.js';
import { ComputeStack } from './compute-stack.js';
import { DataStack } from './data-stack.js';
import { MessagingStack } from './messaging-stack.js';
import { NetworkStack } from './network-stack.js';
import { ObservabilityStack } from './observability-stack.js';

export interface HygiaOptions {
  env?: Environment;
  monthlyBudgetUsd?: number;
  budgetEmail?: string;
}

/**
 * Toute l'architecture HYGIA (section 9 du cahier), en six piles. Aucune recherche dans un compte
 * AWS (pas de `fromLookup`) : `cdk synth` fonctionne hors ligne.
 */
export function buildHygia(app: App, options: HygiaOptions = {}) {
  const env = options.env ? { env: options.env } : {};
  const network = new NetworkStack(app, 'HygiaReseau', env);
  const data = new DataStack(app, 'HygiaDonnees', { ...env, vpc: network.vpc });
  const messaging = new MessagingStack(app, 'HygiaMessages', {
    ...env,
    clinicalKey: data.clinicalKey,
    analyticsKey: data.analyticsKey,
  });
  const compute = new ComputeStack(app, 'HygiaCalcul', {
    ...env,
    vpc: network.vpc,
    clinicalKey: data.clinicalKey,
    artifactsBucket: data.artifactsBucket,
    deadLetterQueue: messaging.deadLetterQueue,
  });
  const access = new AccessStack(app, 'HygiaAcces', {
    ...env,
    brokerLoadBalancer: compute.brokerLoadBalancer,
    clinicalKey: data.clinicalKey,
  });
  const observability = new ObservabilityStack(app, 'HygiaObservabilite', {
    ...env,
    loadBalancer: compute.loadBalancer,
    deadLetterQueue: messaging.deadLetterQueue,
    dossiersService: compute.fargateServices[0] as ComputeStack['fargateServices'][number],
    database: data.database,
    leasesTable: data.leasesTable,
    backupKey: data.clinicalKey,
    monthlyBudgetUsd: options.monthlyBudgetUsd ?? 50,
    budgetEmail: options.budgetEmail ?? 'equipe-g2@example.org',
  });

  for (const stack of [network, data, messaging, compute, access, observability]) {
    Tags.of(stack).add('projet', 'hygia');
    Tags.of(stack).add('groupe', 'G2');
  }
  return { network, data, messaging, compute, access, observability };
}
