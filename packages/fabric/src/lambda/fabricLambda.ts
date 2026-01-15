// Lambda Service adapter for @jaypie/fabric

import { getMessages } from "@jaypie/aws";
import { lambdaHandler } from "@jaypie/lambda";

import type { Message, Service, ServiceContext } from "../types.js";
import type {
  FabricLambdaConfig,
  FabricLambdaOptions,
  FabricLambdaResult,
  LambdaContext,
} from "./types.js";

/**
 * Type guard to check if a value is a Service (has been fabricated)
 */
function isService(value: unknown): value is Service {
  return typeof value === "function";
}

/**
 * Fabric a Lambda handler that wraps a service
 *
 * This function creates a Lambda-compatible handler that:
 * - Uses getMessages() to extract messages from SQS/SNS events
 * - Calls the service once for each message
 * - Returns the single response if one message, or an array of responses if multiple
 * - Integrates with lambdaHandler for lifecycle management (secrets, setup, teardown, etc.)
 *
 * @param serviceOrConfig - The service function or configuration object
 * @param options - Lambda handler options (secrets, setup, teardown, etc.)
 * @returns A Lambda handler function
 *
 * @example
 * ```typescript
 * import { fabricLambda } from "@jaypie/fabric/lambda";
 * import { myService } from "./services";
 *
 * // Direct service style
 * export const handler = fabricLambda(myService);
 *
 * // Config object style
 * export const handler2 = fabricLambda({
 *   service: myService,
 *   secrets: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"],
 * });
 *
 * // Service with options style
 * export const handler3 = fabricLambda(myService, {
 *   secrets: ["ANTHROPIC_API_KEY"],
 * });
 * ```
 */
export function fabricLambda<TResult = unknown>(
  serviceOrConfig: FabricLambdaConfig | Service,
  options: FabricLambdaOptions = {},
): FabricLambdaResult<TResult | TResult[]> {
  // Normalize arguments
  let service: Service;
  let opts: FabricLambdaOptions;

  if (isService(serviceOrConfig)) {
    service = serviceOrConfig;
    opts = options;
  } else {
    const { service: configService, ...configOpts } = serviceOrConfig;
    service = configService;
    opts = configOpts;
  }

  // Use service.alias as the name for logging (can be overridden via options.name)
  const name = opts.name ?? service.alias;

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

    // Process each message through the service
    const results: TResult[] = [];
    for (const message of messages) {
      try {
        const result = await service(
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
