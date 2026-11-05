import { Stack, Token, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import type { Construct } from 'constructs';

/**
 * Réseau : VPC sur 2 zones de disponibilité. Sous-réseaux publics (ALB, NAT), privés (Fargate,
 * Lambda) et isolés (bases). Points de terminaison VPC : le trafic vers S3, DynamoDB, SQS, KMS,
 * Bedrock… ne sort pas sur Internet (données de santé).
 */
export class NetworkStack extends Stack {
  readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      // Zones explicites quand la région est connue : aucune recherche dans le compte.
      ...(Token.isUnresolved(this.region)
        ? { maxAzs: 2 }
        : { availabilityZones: [`${this.region}a`, `${this.region}b`] }),
      // Une passerelle NAT : budget de démonstration ; deux en production (une par zone).
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'prive', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 22 },
        { name: 'isole', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
      flowLogs: { tout: { trafficType: ec2.FlowLogTrafficType.REJECT } },
    });

    this.vpc.addGatewayEndpoint('S3', { service: ec2.GatewayVpcEndpointAwsService.S3 });
    this.vpc.addGatewayEndpoint('DynamoDb', { service: ec2.GatewayVpcEndpointAwsService.DYNAMODB });
    const interfaces: Record<string, ec2.InterfaceVpcEndpointAwsService> = {
      Sqs: ec2.InterfaceVpcEndpointAwsService.SQS,
      Sns: ec2.InterfaceVpcEndpointAwsService.SNS,
      Kms: ec2.InterfaceVpcEndpointAwsService.KMS,
      SecretsManager: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      EcrApi: ec2.InterfaceVpcEndpointAwsService.ECR,
      EcrDocker: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      Logs: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      BedrockRuntime: ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
      Textract: ec2.InterfaceVpcEndpointAwsService.TEXTRACT,
    };
    for (const [name, service] of Object.entries(interfaces)) {
      this.vpc.addInterfaceEndpoint(name, { service, privateDnsEnabled: true });
    }
  }
}
