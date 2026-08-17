import cdk from 'aws-cdk-lib'
import { PipelineType } from 'aws-cdk-lib/aws-codepipeline'
import { CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines'
import { AppStage } from './app-stage.js'

export class PipelineStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const githubConnectionArn = cdk.Fn.importValue('GlobalGitHubConnectionArn');

    const pipeline = new cdk.pipelines.CodePipeline(this, 'Pipeline', {
      codeBuildDefaults: {
        buildEnvironment: {
          buildImage: cdk.aws_codebuild.LinuxBuildImage.STANDARD_7_0,
        },
        partialBuildSpec: cdk.aws_codebuild.BuildSpec.fromObject({
          version: '0.2',
          phases: {
            install: {
              'runtime-versions': {
                nodejs: 22,
              },
            },
          },
        }),
      },
      pipelineName: 'OauthConnectionsPipeline',
      pipelineType: PipelineType.V2,
      selfMutation: true,
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.connection('bnreine/oauth-connections', 'main', {
          connectionArn: githubConnectionArn,
          triggerOnPush: true,
        }),
        commands: ['npm ci', 'npx cdk synth'],
      }),
      synthCodeBuildDefaults: {
        rolePolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              'sts:AssumeRole',
              'iam:PassRole',
            ],
            resources: ['arn:aws:iam::*:role/cdk-*'],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              'ec2:DescribeVpcs',
              'ec2:DescribeSubnets',
              'ec2:DescribeRouteTables',
              'ec2:DescribeAvailabilityZones',
            ],
            resources: ['*'],
          }),
        ],
      },
    });


    pipeline.addStage(
      new AppStage(this, 'Production', {
        env: {
          account: this.account,
          region: this.region,
        },
      }),
    );
  }
}
