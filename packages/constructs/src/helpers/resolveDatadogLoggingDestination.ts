import { CDK } from "../constants";
import * as logDestinations from "aws-cdk-lib/aws-logs-destinations";
import { Construct } from "constructs";

import {
  resolveDatadogForwarderFunction,
  ResolveDatadogForwarderFunctionOptions,
} from "./resolveDatadogForwarderFunction";

const DEFAULT_FUNCTION_NAME = "DatadogForwarderFunction";

// Cache to store resolved logging destinations
// Using nested structure to support multiple destinations per scope with automatic GC
const destinationCache = new WeakMap<
  Construct,
  Map<string, logDestinations.LambdaDestination>
>();

export function resolveDatadogLoggingDestination(
  scope: Construct,
  options?: ResolveDatadogForwarderFunctionOptions,
): logDestinations.LambdaDestination {
  const { import: importValue, name } = options || {};

  // Create a cache key based on name and import (same as forwarder function)
  const functionName = name || DEFAULT_FUNCTION_NAME;
  const importKey = importValue || CDK.IMPORT.DATADOG_LOG_FORWARDER;
  const cacheKey = `${functionName}:${importKey}`;

  // Get or create scope cache
  let scopeCache = destinationCache.get(scope);
  if (!scopeCache) {
    scopeCache = new Map<string, logDestinations.LambdaDestination>();
    destinationCache.set(scope, scopeCache);
  }

  // Return cached destination if it exists
  const cachedDestination = scopeCache.get(cacheKey);
  if (cachedDestination) {
    return cachedDestination;
  }

  // Resolve the Datadog forwarder function
  const datadogForwarderFunction = resolveDatadogForwarderFunction(
    scope,
    options,
  );

  // Create and cache the logging destination
  const datadogLoggingDestination = new logDestinations.LambdaDestination(
    datadogForwarderFunction,
  );
  scopeCache.set(cacheKey, datadogLoggingDestination);

  return datadogLoggingDestination;
}
