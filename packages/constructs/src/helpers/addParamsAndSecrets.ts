import { Duration } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";

export interface AddParamsAndSecretsOptions {
  paramsAndSecrets?: lambda.ParamsAndSecretsLayerVersion | boolean;
  paramsAndSecretsOptions?: {
    cacheSize?: number;
    logLevel?: lambda.ParamsAndSecretsLogLevel;
    parameterStoreTtl?: number;
    secretsManagerTtl?: number;
  };
}

export function addParamsAndSecrets(
  lambdaFunction: lambda.Function,
  options: AddParamsAndSecretsOptions = {},
): boolean {
  const { paramsAndSecrets, paramsAndSecretsOptions } = options;

  // Return false if explicitly disabled
  if (paramsAndSecrets === false) {
    return false;
  }

  let resolvedParamsAndSecrets:
    | lambda.ParamsAndSecretsLayerVersion
    | undefined = undefined;

  if (paramsAndSecrets instanceof lambda.ParamsAndSecretsLayerVersion) {
    resolvedParamsAndSecrets = paramsAndSecrets;
  } else {
    // Create default ParamsAndSecrets layer
    resolvedParamsAndSecrets = lambda.ParamsAndSecretsLayerVersion.fromVersion(
      lambda.ParamsAndSecretsVersions.V1_0_103,
      {
        cacheSize: paramsAndSecretsOptions?.cacheSize,
        logLevel:
          paramsAndSecretsOptions?.logLevel ||
          lambda.ParamsAndSecretsLogLevel.WARN,
        parameterStoreTtl: paramsAndSecretsOptions?.parameterStoreTtl
          ? Duration.seconds(paramsAndSecretsOptions.parameterStoreTtl)
          : undefined,
        secretsManagerTtl: paramsAndSecretsOptions?.secretsManagerTtl
          ? Duration.seconds(paramsAndSecretsOptions.secretsManagerTtl)
          : undefined,
      },
    );
  }

  // Add the layer to the lambda function
  if (resolvedParamsAndSecrets) {
    lambdaFunction.addLayers(resolvedParamsAndSecrets);
    return true;
  }

  return false;
}