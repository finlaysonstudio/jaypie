import { CDK } from "@jaypie/cdk";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

const DEFAULT_FUNCTION_NAME = "DatadogForwarderFunction";

// Cache to store resolved functions
// Using nested structure to support multiple functions per scope with automatic GC
const functionCache = new WeakMap<Construct, Map<string, lambda.IFunction>>();

export interface ResolveDatadogForwarderFunctionOptions {
  import?: string;
  name?: string;
}

export function resolveDatadogForwarderFunction(
  scope: Construct,
  options?: ResolveDatadogForwarderFunctionOptions,
): lambda.IFunction {
  const { import: importValue, name } = options || {};

  const functionName = name || DEFAULT_FUNCTION_NAME;
  const importKey = importValue || CDK.IMPORT.DATADOG_LOG_FORWARDER;

  // Create a cache key based on name and import
  const cacheKey = `${functionName}:${importKey}`;

  // Get or create scope cache
  let scopeCache = functionCache.get(scope);
  if (!scopeCache) {
    scopeCache = new Map<string, lambda.IFunction>();
    functionCache.set(scope, scopeCache);
  }

  // Return cached function if it exists
  const cachedFunction = scopeCache.get(cacheKey);
  if (cachedFunction) {
    return cachedFunction;
  }

  // Create and cache the function
  const func = lambda.Function.fromFunctionArn(
    scope,
    functionName,
    cdk.Fn.importValue(importKey),
  );
  scopeCache.set(cacheKey, func);

  return func;
}
