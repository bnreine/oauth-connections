#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { PipelineStack } = require('../lib/pipeline-stack');

const app = new cdk.App();

new PipelineStack(app, 'OauthConnectionsPipelineStack', {
  env: {
    account: '010273536955',
    region: 'us-east-1',
  },
});
