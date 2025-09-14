import { Arn, Duration, Stack } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";

export interface AddParamsAndSecretsOptions {
  cacheSize?: number;
  logLevel?: lambda.ParamsAndSecretsLogLevel;
  parameterStoreTtl?: Duration;
  secretsManagerTtl?: Duration;
}

export const PARAMS_AND_SECRETS_VERSION =
  lambda.ParamsAndSecretsVersions.V1_0_103;
export const PARAMS_AND_SECRETS_ACCOUNT = "017000801446";

export function addParamsAndSecrets(
  lambdaFunction: lambda.Function,
  options:
    | AddParamsAndSecretsOptions
    | boolean = {} as AddParamsAndSecretsOptions,
): boolean {
  if (typeof options === "boolean" && options === false) {
    return false;
  }

  const stack = Stack.of(lambdaFunction);
  const arn = Arn.format(
    {
      partition: stack.partition,
      service: "lambda",
      region: stack.region,
      account: PARAMS_AND_SECRETS_ACCOUNT,
      resource: "layer",
      resourceName: `AWSLambdaParametersAndSecrets:${PARAMS_AND_SECRETS_VERSION}`,
    },
    stack,
  );

  const layer = lambda.LayerVersion.fromLayerVersionArn(
    stack,
    "ParamsAndSecretsExtension",
    arn,
  );

  if (typeof options === "boolean" && options === true) {
    options = {} as AddParamsAndSecretsOptions;
  }
  if (!options.logLevel) {
    options.logLevel = lambda.ParamsAndSecretsLogLevel.WARN;
  }
  const { cacheSize, logLevel, parameterStoreTtl, secretsManagerTtl } = options;

  // Set environment variables for configuration
  if (cacheSize) {
    lambdaFunction.addEnvironment(
      "PARAMETERS_SECRETS_EXTENSION_CACHE_SIZE",
      cacheSize.toString(),
    );
  }
  if (logLevel) {
    lambdaFunction.addEnvironment(
      "PARAMETERS_SECRETS_EXTENSION_LOG_LEVEL",
      logLevel,
    );
  }
  if (parameterStoreTtl) {
    lambdaFunction.addEnvironment(
      "PARAMETERS_SECRETS_EXTENSION_PARAMETER_STORE_TTL",
      parameterStoreTtl.toString(),
    );
  }
  if (secretsManagerTtl) {
    lambdaFunction.addEnvironment(
      "PARAMETERS_SECRETS_EXTENSION_SECRETS_MANAGER_TTL",
      secretsManagerTtl.toString(),
    );
  }

  // Add the layer to the lambda function
  lambdaFunction.addLayers(layer);
  return true;
}
