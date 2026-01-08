// Lambda Service Handler for @jaypie/vocabulary

import { getMessages } from "@jaypie/aws";
import { lambdaHandler } from "@jaypie/lambda";

import type {
  Message,
  ServiceContext,
  ServiceHandlerFunction,
} from "../types.js";
import type {
  LambdaContext,
  LambdaServiceHandlerConfig,
  LambdaServiceHandlerOptions,
  LambdaServiceHandlerResult,
} from "./types.js";

/**
 * Create a Lambda handler that wraps a service handler
 *
 * This function creates a Lambda-compatible handler that:
 * - Uses getMessages() to extract messages from SQS/SNS events
 * - Calls the service handler once for each message
 * - Returns the single response if one message, or an array of responses if multiple
 * - Integrates with lambdaHandler for lifecycle management (secrets, setup, teardown, etc.)
 *
 * @param handlerOrConfig - The service handler function or configuration object
 * @param options - Lambda handler options (secrets, setup, teardown, etc.)
 * @returns A Lambda handler function
 *
 * @example
 * ```typescript
 * import { lambdaServiceHandler } from "@jaypie/vocabulary/lambda";
 * import { myServiceHandler } from "./handlers";
 *
 * // Config object style
 * export const handler = lambdaServiceHandler({
 *   handler: myServiceHandler,
 *   secrets: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"],
 * });
 *
 * // Handler with options style
 * export const handler2 = lambdaServiceHandler(myServiceHandler, {
 *   secrets: ["ANTHROPIC_API_KEY"],
 * });
 * ```
 */
export function lambdaServiceHandler<TResult = unknown>(
  handlerOrConfig: ServiceHandlerFunction | LambdaServiceHandlerConfig,
  options: LambdaServiceHandlerOptions = {},
): LambdaServiceHandlerResult<TResult | TResult[]> {
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
  const name = opts.name ?? handler.alias;

  // Create context callbacks that wrap the registration callbacks with error swallowing
  // Callback failures should never halt service execution
  const sendMessage = opts.onMessage
    ? async (message: Message): Promise<void> => {
        try {
          await opts.onMessage!(message);
        } catch {
          // Swallow errors - callback failures should not halt execution
        }
      }
    : undefined;

  const contextOnError = opts.onError
    ? async (error: unknown): Promise<void> => {
        try {
          await opts.onError!(error);
        } catch {
          // Swallow errors - callback failures should not halt execution
        }
      }
    : undefined;

  const contextOnFatal = opts.onFatal
    ? async (error: unknown): Promise<void> => {
        try {
          await opts.onFatal!(error);
        } catch {
          // Swallow errors - callback failures should not halt execution
        }
      }
    : undefined;

  // Create context for the service
  const context: ServiceContext = {
    onError: contextOnError,
    onFatal: contextOnFatal,
    sendMessage,
  };

  // Create the inner Lambda handler logic (context param required for lambdaHandler signature)
  const innerHandler = async (
    event: unknown,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context?: LambdaContext,
  ): Promise<TResult | TResult[]> => {
    // Extract messages from SQS/SNS event wrapper
    const messages = getMessages(event);

    // Process each message through the service handler
    const results: TResult[] = [];
    for (const message of messages) {
      try {
        const result = await handler(
          message as Record<string, unknown>,
          context,
        );
        results.push(result as TResult);
      } catch (error) {
        // Any thrown error is fatal - call onFatal or onError as fallback
        if (opts.onFatal) {
          await opts.onFatal(error);
        } else if (opts.onError) {
          await opts.onError(error);
        }
        // Re-throw to let lambdaHandler handle it
        throw error;
      }
    }

    // Call onComplete if provided
    const response = results.length === 1 ? results[0] : results;
    if (opts.onComplete) {
      try {
        await opts.onComplete(response);
      } catch {
        // Swallow errors - callback failures should not halt execution
      }
    }

    return response;
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
}
