import { Duration, Stack } from "aws-cdk-lib";
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

  const stack = Stack.of(lambdaFunction);

  let resolvedLayer: lambda.ILayerVersion | undefined = undefined;

  if (paramsAndSecrets instanceof lambda.ParamsAndSecretsLayerVersion) {
    // For custom ParamsAndSecretsLayerVersion, we need to extract the ARN
    // This is a workaround since ParamsAndSecretsLayerVersion doesn't implement ILayerVersion
    const layerArn = `arn:aws:lambda:${stack.region}:017000801446:layer:AWSLambdaParametersAndSecrets:${lambda.ParamsAndSecretsVersions.V1_0_103}`;
    resolvedLayer = lambda.LayerVersion.fromLayerVersionArn(
      stack,
      `ParamsAndSecretsLayer-${lambdaFunction.node.id}`,
      layerArn,
    );

    // Set environment variables for configuration
    if (paramsAndSecretsOptions?.cacheSize) {
      lambdaFunction.addEnvironment(
        "PARAMETERS_SECRETS_EXTENSION_CACHE_SIZE",
        paramsAndSecretsOptions.cacheSize.toString(),
      );
    }
    if (paramsAndSecretsOptions?.logLevel) {
      lambdaFunction.addEnvironment(
        "PARAMETERS_SECRETS_EXTENSION_LOG_LEVEL",
        paramsAndSecretsOptions.logLevel,
      );
    }
    if (paramsAndSecretsOptions?.parameterStoreTtl) {
      lambdaFunction.addEnvironment(
        "PARAMETERS_SECRETS_EXTENSION_PARAMETER_STORE_TTL",
        paramsAndSecretsOptions.parameterStoreTtl.toString(),
      );
    }
    if (paramsAndSecretsOptions?.secretsManagerTtl) {
      lambdaFunction.addEnvironment(
        "PARAMETERS_SECRETS_EXTENSION_SECRETS_MANAGER_TTL",
        paramsAndSecretsOptions.secretsManagerTtl.toString(),
      );
    }
  } else {
    // Create default ParamsAndSecrets layer using LayerVersion.fromLayerVersionArn
    const layerArn = `arn:aws:lambda:${stack.region}:017000801446:layer:AWSLambdaParametersAndSecrets:${lambda.ParamsAndSecretsVersions.V1_0_103}`;
    resolvedLayer = lambda.LayerVersion.fromLayerVersionArn(
      stack,
      `ParamsAndSecretsLayer-${lambdaFunction.node.id}`,
      layerArn,
    );

    // Set default environment variables
    if (paramsAndSecretsOptions?.cacheSize) {
      lambdaFunction.addEnvironment(
        "PARAMETERS_SECRETS_EXTENSION_CACHE_SIZE",
        paramsAndSecretsOptions.cacheSize.toString(),
      );
    }
    const logLevel =
      paramsAndSecretsOptions?.logLevel || lambda.ParamsAndSecretsLogLevel.WARN;
    lambdaFunction.addEnvironment(
      "PARAMETERS_SECRETS_EXTENSION_LOG_LEVEL",
      logLevel,
    );

    if (paramsAndSecretsOptions?.parameterStoreTtl) {
      lambdaFunction.addEnvironment(
        "PARAMETERS_SECRETS_EXTENSION_PARAMETER_STORE_TTL",
        paramsAndSecretsOptions.parameterStoreTtl.toString(),
      );
    }
    if (paramsAndSecretsOptions?.secretsManagerTtl) {
      lambdaFunction.addEnvironment(
        "PARAMETERS_SECRETS_EXTENSION_SECRETS_MANAGER_TTL",
        paramsAndSecretsOptions.secretsManagerTtl.toString(),
      );
    }
  }

  // Add the layer to the lambda function
  if (resolvedLayer) {
    lambdaFunction.addLayers(resolvedLayer);
    return true;
  }

  return false;
}
