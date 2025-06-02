# JaypieExpressLambda

packages/constructs/src/index.ts
packages/constructs/src/JaypieLambda.ts
packages/constructs/src/__tests__/JaypieLambda.spec.ts

I want to create and export a new construct, JaypieExpressLambda.
It should extend JaypieLambda but default:
- timeout: cdk.Duration.seconds(CDK.DURATION.EXPRESS_API)
- role tag: CDK.ROLE.API
