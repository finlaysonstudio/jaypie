import { CDK } from "@jaypie/cdk";
import { Stack } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface ResolveDatadogLayerOptions {
  datadogApiKeyArn?: string;
  uniqueId?: string;
}

export function resolveDatadogLayers(
  scope: Construct,
  options: ResolveDatadogLayerOptions = {},
): lambda.ILayerVersion[] | undefined {
  const { datadogApiKeyArn, uniqueId } = options;

  let resolvedRegion = Stack.of(scope).region || "us-east-1";

  // Resolve the Datadog API key ARN from multiple sources
  const resolvedDatadogApiKeyArn =
    datadogApiKeyArn ||
    process.env.DATADOG_API_KEY_ARN ||
    process.env.CDK_ENV_DATADOG_API_KEY_ARN;

  // Return null if no API key is found
  if (!resolvedDatadogApiKeyArn) {
    return undefined;
  }

  const layerIdSuffix =
    uniqueId || process.env.PROJECT_NONCE || Date.now().toString();

  // Create Datadog Node.js layer
  const datadogNodeLayer = lambda.LayerVersion.fromLayerVersionArn(
    scope,
    `DatadogNodeLayer-${layerIdSuffix}`,
    `arn:aws:lambda:${resolvedRegion}:464622532012:layer:Datadog-Node20-x:${CDK.DATADOG.LAYER.NODE}`,
  );

  // Create Datadog Extension layer
  const datadogExtensionLayer = lambda.LayerVersion.fromLayerVersionArn(
    scope,
    `DatadogExtensionLayer-${layerIdSuffix}`,
    `arn:aws:lambda:${resolvedRegion}:464622532012:layer:Datadog-Extension:${CDK.DATADOG.LAYER.EXTENSION}`,
  );

  return [datadogNodeLayer, datadogExtensionLayer];
}
