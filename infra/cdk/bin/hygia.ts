#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { buildHygia } from '../lib/hygia-app.js';

// Piles indépendantes de tout compte : `cdk synth` n'appelle jamais AWS, même si des
// identifiants sont configurés sur la machine (le CLI remplit CDK_DEFAULT_ACCOUNT : ignoré).
// Pour déployer, le compte est donné explicitement : HYGIA_AWS_ACCOUNT=123456789012.
const app = new App();
const account = process.env['HYGIA_AWS_ACCOUNT'];
const budgetEmail = app.node.tryGetContext('budgetEmail') as string | undefined;
buildHygia(app, {
  ...(account ? { env: { account, region: process.env['HYGIA_AWS_REGION'] ?? 'eu-west-3' } } : {}),
  ...(budgetEmail ? { budgetEmail } : {}),
});
app.synth();
