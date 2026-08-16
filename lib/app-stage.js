const { Stage } = require('aws-cdk-lib');
const { OAuthConnectionsLambdaStack } = require('./lambda-stack');

class AppStage extends Stage {
  constructor(scope, id, props) {
    super(scope, id, props);

    new OAuthConnectionsLambdaStack(this, 'OAuthConnectionsLambdaStack',   {
        stackName: 'OAuthConnectionsLambdaStack',
    });
  }
}

module.exports = { AppStage };
