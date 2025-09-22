import * as lambda from "aws-cdk-lib/aws-lambda";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { CDK } from "@jaypie/cdk";
import { DatadogLambda } from "datadog-cdk-constructs-v2";

export interface AddDatadogLayerOptions {
  datadogApiKeyArn?: string;
}

export function addDatadogLayers(
  lambdaFunction: lambda.Function,
  options: AddDatadogLayerOptions = {},
): boolean {
  const datadogApiKeyArn = options?.datadogApiKeyArn;

  const resolvedDatadogApiKeyArn =
    datadogApiKeyArn ||
    process.env.DATADOG_API_KEY_ARN ||
    process.env.CDK_ENV_DATADOG_API_KEY_ARN;
  if (!resolvedDatadogApiKeyArn) {
    return false;
  }

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
    lambdaFunction.addEnvironment(key, value);
  });

  const datadogApiKeySecret: secretsmanager.ISecret =
    secretsmanager.Secret.fromSecretCompleteArn(
      lambdaFunction,
      "DatadogApiKey",
      resolvedDatadogApiKeyArn,
    );
  const datadogLambda = new DatadogLambda(lambdaFunction, "DatadogLambda", {
    apiKeySecret: datadogApiKeySecret, // apiKeySecret auto-grants secret access to the added lambdas
    nodeLayerVersion: CDK.DATADOG.LAYER.NODE,
    extensionLayerVersion: CDK.DATADOG.LAYER.EXTENSION,
    env: process.env.PROJECT_ENV,
    service: process.env.PROJECT_SERVICE,
    version: process.env.PROJECT_VERSION,
  });
  datadogLambda.addLambdaFunctions([lambdaFunction]);

  return true;
}
