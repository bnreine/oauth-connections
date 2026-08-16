import { Stack } from 'aws-cdk-lib'
import { Runtime, LayerVersion, Code } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Duration, aws_ec2 } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { LambdaRouteConnection } from './lambda-route-connection.js';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambda from "aws-cdk-lib/aws-lambda";
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_GATEWAY_ID_SSM_PARAMETER = '/notifications/apigateway/api2/id';

export class OAuthConnectionsLambdaStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);


      const vpc = aws_ec2.Vpc.fromLookup(this, 'Vpc', {
          vpcId: 'vpc-084bacc70db0dcefd',
      });


      const rdsSgId = ssm.StringParameter.valueForStringParameter(
          this,
          '/notifications/rds-sg-id'
      );

      const rdsSg = aws_ec2.SecurityGroup.fromSecurityGroupId(
          this,
          'RdsSg',
          rdsSgId,
          { mutable: true }
      );


      const apiId = ssm.StringParameter.valueForStringParameter(
          this,
          API_GATEWAY_ID_SSM_PARAMETER,
      );

      const defaultAuthorizerId = ssm.StringParameter.valueForStringParameter(
          this,
          "/notifications/apigateway/api2/default-authorizer-id"
      );

      const defaultAuthorizerType = ssm.StringParameter.valueForStringParameter(
          this,
          "/notifications/apigateway/api2/default-authorizer-type"
      );

      const writeReadRDSdbSecret = secretsmanager.Secret.fromSecretNameV2(
          this,
          'DbSecret',
          'write_read_rds_db',
      );

      const postLambdaDir = path.join(__dirname, '../src/post');

      const lambdaSecurityGroup = new aws_ec2.SecurityGroup(this, 'OAuthConnectionsLambdaSecurityGroup', {
          vpc,
          description: 'Security group for OAuth connections Lambda functions',
          allowAllOutbound: true, // Allows the Lambda to initiate connections (e.g. to RDS)
      });

      const sharedLayerArn =
          ssm.StringParameter.valueForStringParameter(
              this,
              "/notifications/shared-layer/arn"
          );

      const sharedLayer =
          lambda.LayerVersion.fromLayerVersionArn(
              this,
              "SharedLayer",
              sharedLayerArn
          );

      const postLambda = new NodejsFunction(this, 'OAuthConnectionsPostLambda', {
          runtime: Runtime.NODEJS_22_X,
          entry: path.join(postLambdaDir, 'index.js'),
          handler: 'handler',
          timeout: Duration.seconds(29),
          projectRoot: postLambdaDir,
          depsLockFilePath: path.join(postLambdaDir, 'package-lock.json'),
          layers: [sharedLayer],
          bundling: {
              externalModules: ['/opt/*'],
              format: OutputFormat.ESM,
          },
          vpc,
          vpcSubnets: {
              subnetType: aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
          },
          securityGroups: [lambdaSecurityGroup],
      });

      writeReadRDSdbSecret.grantRead(postLambda);

      new LambdaRouteConnection(this, 'PreferencesPostRoute', {
          lambdaFunction: postLambda,
          region: this.region,
          apiId,
          routeKey: 'POST /configurations/{configurationId}/preferences',
          authorizationType: defaultAuthorizerType,
          authorizerId: defaultAuthorizerId,
      });




  }
}

