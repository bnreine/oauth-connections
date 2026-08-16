#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { PipelineStack } from '../lib/pipeline-stack.js'

const app = new cdk.App();

new PipelineStack(app, 'OauthConnectionsPipelineStack', {
  env: {
    account: '010273536955',
    region: 'us-east-1',
  },
});
