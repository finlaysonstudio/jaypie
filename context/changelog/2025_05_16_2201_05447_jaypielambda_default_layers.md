# JaypieLambda default layers

I want JaypieLambda to abstract away this code:

```
const paramsAndSecretsLayer =
  lambda.ParamsAndSecretsLayerVersion.fromVersion(
    lambda.ParamsAndSecretsVersions.V1_0_103,
    {
      // cacheSize: 1000, // secrets and parameters to cache; 1000 is default and max
      logLevel: lambda.ParamsAndSecretsLogLevel.WARN,
      // parameterStoreTtl: 300, // time-to-live of a parameter; 300 is default and max
      // secretsManagerTtl: 300, // time-to-live of a secret; 300 is default and max
    },
  );

const lambda = new JaypieLambda(this, 'Function', {
  code: lambda.Code.fromAsset('src'),
  handler: 'index.handler',
  paramsAndSecrets: paramsAndSecretsLayer,
  secrets: [mongoConnectionString, openAiKey],
});
```

I want JaypieLambda to assume the paramsAndSecrets layer is wanted.
Allow cacheSize, logLevel, parameterStoreTtl, secretsManagerTtl to be set in paramsAndSecretsOptions.
Disable paramsAndSecrets if paramsAndSecrets is set to boolean false.