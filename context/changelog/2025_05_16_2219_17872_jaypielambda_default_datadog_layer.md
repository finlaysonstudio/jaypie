# JaypieLambda default Datadog Layer

packages/constructs/src/JaypieLambda.ts
packages/constructs/src/__tests__/JaypieLambda.spec.ts

I would like JaypieLambda to abstract away this code:

```
const datadogApiKey = secretsmanager.Secret.fromSecretCompleteArn(
  this,
  "DatadogApiKey",
  datadogApiKeyArn,
);

const datadogLayer = new Datadog(this, "DatadogLayer", {
  apiKeySecretArn: datadogApiKey.secretArn,
  env: process.env.PROJECT_ENV,
  extensionLayerVersion: CDK.DATADOG.LAYER.EXTENSION,
  // logLevel: "debug" // when set to `debug` the Datadog Lambda Library and Extension will log additional information to help troubleshoot issues.
  nodeLayerVersion: CDK.DATADOG.LAYER.NODE,
  service: process.env.PROJECT_SERVICE,
  site: CDK.DATADOG.SITE,
  tags: `${CDK.TAG.SPONSOR}:${process.env.PROJECT_SPONSOR}`, // A comma separated list of key:value pairs as a single string
  version,
});

const lambda = new JaypieLambda(this, 'Function', {
  code: lambda.Code.fromAsset('src'),
  handler: 'index.handler',
  layers: [datadogLayer],
});

datadogApiKey.grantRead(lambda);
```

Instead the following should suffice:

```
const lambda = new JaypieLambda(this, 'Function', {
  code: lambda.Code.fromAsset('src'),
  datadogApiKeyArn,
  handler: 'index.handler',
});
```

If datadogApiKeyArn is not set, use DATADOG_API_KEY_ARN (first) || CDK_ENV_DATADOG_API_KEY_ARN (second) from the environment.
If datadogApiKeyArn is not set or is boolean false, do not add the datadog extension.

This request was partially implemented without regard to the above instructions.
Delete or replace not-requested existing code.
