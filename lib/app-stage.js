const { Stage } = require('aws-cdk-lib');
const { LambdaStack } = require('./lambda-stack');

class AppStage extends Stage {
  constructor(scope, id, props) {
    super(scope, id, props);

    new LambdaStack(this, 'LambdaStack');
  }
}

module.exports = { AppStage };
