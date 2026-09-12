import type { Application, Request, Response } from "express";

import { flushLlmObs } from "@jaypie/datadog";

import { createLambdaRequest, LambdaRequest } from "./LambdaRequest.js";
import LambdaResponseBuffered from "./LambdaResponseBuffered.js";
import LambdaResponseStreaming from "./LambdaResponseStreaming.js";
import type {
  AwsLambdaGlobal,
  CreateLambdaHandlerOptions,
  LambdaContext,
  LambdaEvent,
  LambdaHandler,
  LambdaResponse,
  LambdaStreamHandler,
  ResponseStream,
} from "./types.js";

//
//
// Constants
//

const DEFAULT_HANDLER_NAME = "createLambdaHandler";
const DEFAULT_STREAM_HANDLER_NAME = "createLambdaStreamHandler";

//
//
// Declare awslambda global (provided by Lambda runtime)
// This may be undefined in non-Lambda environments
//

declare const awslambda: AwsLambdaGlobal | undefined;

//
//
// Current Invoke Context
//

let currentInvoke: { context: LambdaContext; event: LambdaEvent } | null = null;

/**
 * Get the current Lambda invoke context.
 * Used by getCurrentInvokeUuid adapter to get the request ID.
 */
export function getCurrentInvoke(): {
  context: LambdaContext;
  event: LambdaEvent;
} | null {
  return currentInvoke;
}

/**
 * Set the current Lambda invoke context.
 * Called at the start of each Lambda invocation.
 */
function setCurrentInvoke(event: LambdaEvent, context: LambdaContext): void {
  currentInvoke = { context, event };
}

/**
 * Clear the current Lambda invoke context.
 * Called at the end of each Lambda invocation.
 */
function clearCurrentInvoke(): void {
  currentInvoke = null;
}

//
//
// Express App Runner
//

/**
 * Log an unhandled adapter error with the handler name as its label.
 * Uses console, not log: must reach CloudWatch even if the logger itself is broken
 */
function logUnhandledError(error: unknown, { name }: { name: string }): void {
  // eslint-disable-next-line no-console
  console.error(`[${name}] Unhandled error:`, error);
  if (error instanceof Error) {
    // eslint-disable-next-line no-console
    console.error(`[${name}] Stack:`, error.stack);
  }
}

/**
 * Run Express app with mock request/response.
 * Returns a promise that resolves when the response is complete.
 */
function runExpressApp(
  app: Application,
  req: LambdaRequest,
  res: LambdaResponseBuffered | LambdaResponseStreaming,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Listen for response completion
    res.on("finish", resolve);
    res.on("error", reject);

    // Run the Express app
    // Cast to Express types since our mocks implement the required interface
    app(req as unknown as Request, res as unknown as Response);
  });
}

//
//
// Buffered Handler Factory
//

/**
 * Create a Lambda handler that buffers the Express response.
 * Returns the complete response as a Lambda response object.
 *
 * @example
 * ```typescript
 * import express from "express";
 * import { createLambdaHandler } from "@jaypie/express";
 *
 * const app = express();
 * app.get("/", (req, res) => res.json({ message: "Hello" }));
 *
 * export const handler = createLambdaHandler(app);
 * ```
 *
 * Options:
 * - `name` labels unhandled error output (default "createLambdaHandler")
 */
export function createLambdaHandler(
  app: Application,
  { name = DEFAULT_HANDLER_NAME }: CreateLambdaHandlerOptions = {},
): LambdaHandler {
  return async (
    event: LambdaEvent,
    context: LambdaContext,
  ): Promise<LambdaResponse> => {
    let result: LambdaResponse | undefined;
    try {
      // Set current invoke for getCurrentInvokeUuid
      setCurrentInvoke(event, context);

      // Create mock request from Lambda event
      const req = createLambdaRequest(event, context);

      // Create buffered response collector
      const res = new LambdaResponseBuffered();

      // Run Express app
      await runExpressApp(app, req, res);

      // Get Lambda response - await explicitly to ensure we have the result
      result = await res.getResult();

      return result;
    } catch (error) {
      logUnhandledError(error, { name });

      // Return a proper error response instead of throwing
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          errors: [
            {
              status: 500,
              title: "Internal Server Error",
              detail:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred",
            },
          ],
        }),
        isBase64Encoded: false,
      };
    } finally {
      // Clear current invoke context
      clearCurrentInvoke();

      // Flush buffered LLM Observability spans before the Lambda freezes.
      // No-op unless DD_LLMOBS_ENABLED; never throws.
      flushLlmObs();
    }
  };
}

//
//
// Streaming Handler Factory
//

/**
 * Create a Lambda handler that streams the Express response.
 * Uses awslambda.streamifyResponse() for Lambda response streaming.
 *
 * Outside the Lambda runtime (no `awslambda` global) the unwrapped
 * `(event, responseStream, context)` handler is returned instead, so importing
 * a module that calls this factory does not throw in tests or local servers.
 *
 * @example
 * ```typescript
 * import express from "express";
 * import { createLambdaStreamHandler } from "@jaypie/express";
 *
 * const app = express();
 * app.get("/stream", (req, res) => {
 *   res.setHeader("Content-Type", "text/event-stream");
 *   res.write("data: Hello\n\n");
 *   res.end();
 * });
 *
 * export const handler = createLambdaStreamHandler(app);
 * ```
 *
 * Options:
 * - `name` labels unhandled error output (default "createLambdaStreamHandler")
 */
export function createLambdaStreamHandler(
  app: Application,
  { name = DEFAULT_STREAM_HANDLER_NAME }: CreateLambdaHandlerOptions = {},
): LambdaStreamHandler {
  const innerHandler = async (
    event: LambdaEvent,
    responseStream: ResponseStream,
    context: LambdaContext,
  ): Promise<void> => {
    try {
      // Set current invoke for getCurrentInvokeUuid
      setCurrentInvoke(event, context);

      // Create mock request from Lambda event
      const req = createLambdaRequest(event, context);

      // Create streaming response that pipes to Lambda responseStream
      const res = new LambdaResponseStreaming(responseStream);

      // Run Express app
      await runExpressApp(app, req, res);
    } catch (error) {
      logUnhandledError(error, { name });
      throw error;
    } finally {
      // Clear current invoke context
      clearCurrentInvoke();

      // Flush buffered LLM Observability spans before the Lambda freezes.
      // No-op unless DD_LLMOBS_ENABLED; never throws.
      flushLlmObs();
    }
  };

  // Wrap with awslambda.streamifyResponse when running in the Lambda runtime
  if (typeof awslambda !== "undefined" && awslambda?.streamifyResponse) {
    return awslambda.streamifyResponse<LambdaEvent>(innerHandler);
  }

  // Outside Lambda, return the unwrapped handler so callers can pass a stream
  return innerHandler as unknown as LambdaStreamHandler;
}

//
//
// Re-exports
//

export { LambdaRequest, createLambdaRequest } from "./LambdaRequest.js";
export { LambdaResponseBuffered } from "./LambdaResponseBuffered.js";
export { LambdaResponseStreaming } from "./LambdaResponseStreaming.js";
export type {
  ApiGatewayV1Event,
  AwsLambdaGlobal,
  CreateLambdaHandlerOptions,
  FunctionUrlEvent,
  HttpResponseStreamMetadata,
  LambdaContext,
  LambdaEvent,
  LambdaHandler,
  LambdaHandlerFactory,
  LambdaResponse,
  LambdaStreamHandler,
  LambdaStreamHandlerFactory,
  ResponseStream,
} from "./types.js";
