import { Duration } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";

export interface ResolveParamsAndSecretsOptions {
  cacheSize?: number;
  logLevel?: lambda.ParamsAndSecretsLogLevel;
  parameterStoreTtl?: Duration;
  secretsManagerTtl?: Duration;
}

export const resolveParamsAndSecrets = ({
  paramsAndSecrets,
  options,
}: {
  paramsAndSecrets?: lambda.ParamsAndSecretsLayerVersion | boolean;
  options?: ResolveParamsAndSecretsOptions;
} = {}) => {
  if (paramsAndSecrets === false) {
    return;
  }

  let resolvedParamsAndSecrets: lambda.ParamsAndSecretsLayerVersion;
  if (paramsAndSecrets instanceof lambda.ParamsAndSecretsLayerVersion) {
    resolvedParamsAndSecrets = paramsAndSecrets;
  } else {
    const resolvedOptions = options || {};
    resolvedParamsAndSecrets = lambda.ParamsAndSecretsLayerVersion.fromVersion(
      lambda.ParamsAndSecretsVersions.V1_0_103,
      {
        cacheSize: resolvedOptions.cacheSize,
        logLevel:
          resolvedOptions.logLevel || lambda.ParamsAndSecretsLogLevel.WARN,
        parameterStoreTtl: resolvedOptions.parameterStoreTtl,
        secretsManagerTtl: resolvedOptions.secretsManagerTtl,
      },
    );
  }

  return resolvedParamsAndSecrets;
};

export default resolveParamsAndSecrets;
