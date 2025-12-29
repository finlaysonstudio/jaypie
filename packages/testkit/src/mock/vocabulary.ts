// Mock implementations for @jaypie/vocabulary

import { createMockFunction } from "./utils";
import { lambdaHandler } from "./lambda";
import { getMessages } from "./aws";

// Vocabulary types
type ServiceHandlerFunction = (
  input?: Record<string, unknown> | string,
) => Promise<unknown>;

interface LambdaServiceHandlerOptions {
  chaos?: string;
  name?: string;
  secrets?: string[];
  setup?: ((...args: unknown[]) => void | Promise<void>)[];
  teardown?: ((...args: unknown[]) => void | Promise<void>)[];
  throw?: boolean;
  unavailable?: boolean;
  validate?: ((...args: unknown[]) => unknown | Promise<unknown>)[];
}

interface LambdaServiceHandlerConfig extends LambdaServiceHandlerOptions {
  handler: ServiceHandlerFunction;
}

// Handler function type - must match what lambdaHandler returns
type HandlerFunction = (...args: unknown[]) => unknown;

/**
 * Mock implementation of lambdaServiceHandler
 * Mirrors the real implementation: wraps a service handler for Lambda with getMessages processing
 */
export const lambdaServiceHandler = createMockFunction<
  (
    handlerOrConfig: ServiceHandlerFunction | LambdaServiceHandlerConfig,
    options?: LambdaServiceHandlerOptions,
  ) => HandlerFunction
>((handlerOrConfig, options = {}) => {
  // Normalize arguments
  let handler: ServiceHandlerFunction;
  let opts: LambdaServiceHandlerOptions;

  if (typeof handlerOrConfig === "function") {
    handler = handlerOrConfig;
    opts = options;
  } else {
    const { handler: configHandler, ...configOpts } = handlerOrConfig;
    handler = configHandler;
    opts = configOpts;
  }

  // Use handler.alias as the name for logging (can be overridden via options.name)
  const name = opts.name ?? (handler as { alias?: string }).alias;

  // Create the inner Lambda handler logic
  const innerHandler = async (event: unknown): Promise<unknown> => {
    // Extract messages from SQS/SNS event wrapper
    const messages = getMessages(event);

    // Process each message through the service handler
    const results: unknown[] = [];
    for (const message of messages) {
      const result = await handler(message as Record<string, unknown>);
      results.push(result);
    }

    // Return single result if only one message, otherwise return array
    if (results.length === 1) {
      return results[0];
    }
    return results;
  };

  // Wrap with lambdaHandler for lifecycle management
  return lambdaHandler(innerHandler, {
    chaos: opts.chaos,
    name,
    secrets: opts.secrets,
    setup: opts.setup,
    teardown: opts.teardown,
    throw: opts.throw,
    unavailable: opts.unavailable,
    validate: opts.validate,
  });
});
