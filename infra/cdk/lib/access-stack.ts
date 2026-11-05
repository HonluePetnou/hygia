import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import type * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import type { Construct } from 'constructs';

export interface AccessStackProps extends StackProps {
  brokerLoadBalancer: elbv2.INetworkLoadBalancer;
  clinicalKey: kms.IKey;
}

/**
 * Accès : API Gateway (seule porte d'entrée publique) relayée par un lien VPC jusqu'au broker,
 * protégée par un pare-feu WAF ; annuaire Cognito avec double authentification obligatoire.
 */
export class AccessStack extends Stack {
  readonly api: apigateway.RestApi;
  readonly userPool: cognito.UserPool;
  readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: AccessStackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, 'Annuaire', {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { otp: true, sms: false },
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      featurePlan: cognito.FeaturePlan.PLUS,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    this.userPool.addClient('Web', {
      authFlows: { userSrp: true },
      accessTokenValidity: Duration.minutes(30),
      preventUserExistenceErrors: true,
    });

    const link = new apigateway.VpcLink(this, 'LienVpc', { targets: [props.brokerLoadBalancer] });
    const accessLogs = new logs.LogGroup(this, 'JournalApi', {
      retention: logs.RetentionDays.THREE_MONTHS,
      encryptionKey: props.clinicalKey,
    });
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'hygia',
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
        accessLogDestination: new apigateway.LogGroupLogDestination(accessLogs),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
      },
    });
    const toBroker = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'ANY',
      uri: `http://${props.brokerLoadBalancer.loadBalancerDnsName}/{proxy}`,
      options: {
        connectionType: apigateway.ConnectionType.VPC_LINK,
        vpcLink: link,
        requestParameters: { 'integration.request.path.proxy': 'method.request.path.proxy' },
      },
    });
    this.api.root.addProxy({
      defaultIntegration: toBroker,
      defaultMethodOptions: { requestParameters: { 'method.request.path.proxy': true } },
      anyMethod: true,
    });

    const managedRule = (name: string, priority: number) => ({
      name,
      priority,
      overrideAction: { none: {} },
      statement: { managedRuleGroupStatement: { vendorName: 'AWS', name } },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: name,
        sampledRequestsEnabled: true,
      },
    });
    this.webAcl = new wafv2.CfnWebACL(this, 'PareFeu', {
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'hygia-waf',
        sampledRequestsEnabled: true,
      },
      rules: [
        managedRule('AWSManagedRulesCommonRuleSet', 1),
        managedRule('AWSManagedRulesKnownBadInputsRuleSet', 2),
        managedRule('AWSManagedRulesSQLiRuleSet', 3),
        {
          name: 'LimiteParIp',
          priority: 10,
          action: { block: {} },
          statement: { rateBasedStatement: { limit: 1000, aggregateKeyType: 'IP' } },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'limite-par-ip',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });
    new wafv2.CfnWebACLAssociation(this, 'PareFeuApi', {
      resourceArn: this.api.deploymentStage.stageArn,
      webAclArn: this.webAcl.attrArn,
    });
  }
}
