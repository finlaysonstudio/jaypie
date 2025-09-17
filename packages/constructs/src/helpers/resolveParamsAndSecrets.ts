import { Duration } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";

export interface ResolveParamsAndSecretsOptions {
  cacheSize?: number;
  logLevel?: lambda.ParamsAndSecretsLogLevel;
  parameterStoreTtl?: Duration;
  secretsManagerTtl?: Duration;
}

export const resolveParamsAndSecrets = (
  paramsAndSecretsOptions?:
    | lambda.ParamsAndSecretsLayerVersion
    | boolean
    | ResolveParamsAndSecretsOptions,
) => {
  if (paramsAndSecretsOptions === false) {
    return;
  }

  let resolvedParamsAndSecrets: lambda.ParamsAndSecretsLayerVersion;
  if (paramsAndSecretsOptions instanceof lambda.ParamsAndSecretsLayerVersion) {
    resolvedParamsAndSecrets = paramsAndSecretsOptions;
  } else {
    if (
      paramsAndSecretsOptions === true ||
      paramsAndSecretsOptions === undefined
    ) {
      paramsAndSecretsOptions = {} as ResolveParamsAndSecretsOptions;
    }
    resolvedParamsAndSecrets = lambda.ParamsAndSecretsLayerVersion.fromVersion(
      lambda.ParamsAndSecretsVersions.V1_0_103,
      {
        cacheSize: paramsAndSecretsOptions?.cacheSize,
        logLevel:
          paramsAndSecretsOptions?.logLevel ||
          lambda.ParamsAndSecretsLogLevel.WARN,
        parameterStoreTtl: paramsAndSecretsOptions?.parameterStoreTtl,
        secretsManagerTtl: paramsAndSecretsOptions?.secretsManagerTtl,
      },
    );
  }

  return resolvedParamsAndSecrets;
};

export default resolveParamsAndSecrets;
