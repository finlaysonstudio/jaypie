# JaypieLambda Default Layers Implemented

The following default layers have been implemented for JaypieLambda:

1. ParamsAndSecrets Layer
   - Added by default unless `paramsAndSecrets: false` is specified
   - Default configuration uses AWS ParamsAndSecrets V1_0_103 with WARN log level
   - Custom configuration options available via `paramsAndSecretsOptions`:
     - cacheSize
     - logLevel
     - parameterStoreTtl
     - secretsManagerTtl

2. Datadog Layers
   - Added by default unless `datadog: false` is specified
   - Includes both Datadog Node20.x layer and Datadog Extension layer
   - Uses versions defined in CDK.DATADOG.LAYER constants

Files modified:
- packages/constructs/src/JaypieLambda.ts