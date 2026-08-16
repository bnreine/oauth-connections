import { Stage } from 'aws-cdk-lib'
import { OAuthConnectionsLambdaStack } from './lambda-stack.js'

export class AppStage extends Stage {
  constructor(scope, id, props) {
    super(scope, id, props);

    new OAuthConnectionsLambdaStack(this, 'OAuthConnectionsLambdaStack',   {
        stackName: 'OAuthConnectionsLambdaStack',
    });
  }
}
