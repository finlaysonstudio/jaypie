import { Stack } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { CDK } from "@jaypie/cdk";

export interface AddDatadogLayerOptions {
  datadogApiKeyArn?: string;
}

export function addDatadogLayer(
  lambdaFunction: lambda.Function,
  options: AddDatadogLayerOptions = {},
): boolean {
  const { datadogApiKeyArn } = options;

  // Resolve the Datadog API key ARN from multiple sources
  const resolvedDatadogApiKeyArn =
    datadogApiKeyArn ||
    process.env.DATADOG_API_KEY_ARN ||
    process.env.CDK_ENV_DATADOG_API_KEY_ARN;

  // Return false if no API key is found
  if (!resolvedDatadogApiKeyArn) {
    return false;
  }

  const stack = Stack.of(lambdaFunction);

  // Create Datadog Node.js layer
  const datadogNodeLayer = lambda.LayerVersion.fromLayerVersionArn(
    stack,
    `DatadogNodeLayer-${lambdaFunction.node.id}`,
    `arn:aws:lambda:${stack.region}:464622532012:layer:Datadog-Node20-x:${CDK.DATADOG.LAYER.NODE}`,
  );

  // Create Datadog Extension layer
  const datadogExtensionLayer = lambda.LayerVersion.fromLayerVersionArn(
    stack,
    `DatadogExtensionLayer-${lambdaFunction.node.id}`,
    `arn:aws:lambda:${stack.region}:464622532012:layer:Datadog-Extension:${CDK.DATADOG.LAYER.EXTENSION}`,
  );

  // Add layers to the lambda function
  lambdaFunction.addLayers(datadogNodeLayer, datadogExtensionLayer);

  // Define Datadog environment variables
  const datadogEnvVars = {
    DD_API_KEY_SECRET_ARN: resolvedDatadogApiKeyArn,
    DD_ENHANCED_METRICS: "true",
    DD_ENV: process.env.PROJECT_ENV || "",
    DD_PROFILING_ENABLED: "false",
    DD_SERVERLESS_APPSEC_ENABLED: "false",
    DD_SERVICE: process.env.PROJECT_SERVICE || "",
    DD_SITE: CDK.DATADOG.SITE,
    DD_TAGS: `${CDK.TAG.SPONSOR}:${process.env.PROJECT_SPONSOR || ""}`,
    DD_TRACE_OTEL_ENABLED: "false",
  };

  // Add environment variables only if they don't already exist
  Object.entries(datadogEnvVars).forEach(([key, value]) => {
    if (lambdaFunction.environment[key] === undefined) {
      lambdaFunction.addEnvironment(key, value);
    }
  });

  // Grant Datadog API key read permission
  const datadogApiKey = secretsmanager.Secret.fromSecretCompleteArn(
    stack,
    `DatadogApiKeyGrant-${lambdaFunction.node.id}`,
    resolvedDatadogApiKeyArn,
  );
  datadogApiKey.grantRead(lambdaFunction);

  return true;
}
