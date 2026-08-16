const { Stack } = require('aws-cdk-lib');

class LambdaStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);
  }
}

module.exports = { LambdaStack };
