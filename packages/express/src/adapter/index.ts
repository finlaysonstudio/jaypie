import type { Application, Request, Response } from "express";

import { createLambdaRequest, LambdaRequest } from "./LambdaRequest.js";
import LambdaResponseBuffered from "./LambdaResponseBuffered.js";
import LambdaResponseStreaming from "./LambdaResponseStreaming.js";
import type {
  AwsLambdaGlobal,
  CreateLambdaHandlerOptions,
  FunctionUrlEvent,
  LambdaContext,
  LambdaHandler,
  LambdaResponse,
  LambdaStreamHandler,
  ResponseStream,
} from "./types.js";

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

let currentInvoke: { context: LambdaContext; event: FunctionUrlEvent } | null =
  null;

/**
 * Get the current Lambda invoke context.
 * Used by getCurrentInvokeUuid adapter to get the request ID.
 */
export function getCurrentInvoke(): {
  context: LambdaContext;
  event: FunctionUrlEvent;
} | null {
  return currentInvoke;
}

/**
 * Set the current Lambda invoke context.
 * Called at the start of each Lambda invocation.
 */
function setCurrentInvoke(
  event: FunctionUrlEvent,
  context: LambdaContext,
): void {
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
 */
export function createLambdaHandler(
  app: Application,
  _options?: CreateLambdaHandlerOptions,
): LambdaHandler {
  return async (
    event: FunctionUrlEvent,
    context: LambdaContext,
  ): Promise<LambdaResponse> => {
    try {
      // Set current invoke for getCurrentInvokeUuid
      setCurrentInvoke(event, context);

      // Create mock request from Lambda event
      const req = createLambdaRequest(event, context);

      // Create buffered response collector
      const res = new LambdaResponseBuffered();

      // Run Express app
      await runExpressApp(app, req, res);

      // Return Lambda response
      return res.getResult();
    } finally {
      // Clear current invoke context
      clearCurrentInvoke();
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
 */
export function createLambdaStreamHandler(
  app: Application,
  _options?: CreateLambdaHandlerOptions,
): LambdaStreamHandler {
  // Wrap with awslambda.streamifyResponse for Lambda streaming
  // @ts-expect-error awslambda is a Lambda runtime global
  return awslambda.streamifyResponse(
    async (
      event: FunctionUrlEvent,
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
      } finally {
        // Clear current invoke context
        clearCurrentInvoke();
      }
    },
  );
}

//
//
// Re-exports
//

export { LambdaRequest, createLambdaRequest } from "./LambdaRequest.js";
export { LambdaResponseBuffered } from "./LambdaResponseBuffered.js";
export { LambdaResponseStreaming } from "./LambdaResponseStreaming.js";
export type {
  AwsLambdaGlobal,
  CreateLambdaHandlerOptions,
  FunctionUrlEvent,
  HttpResponseStreamMetadata,
  LambdaContext,
  LambdaHandler,
  LambdaHandlerFactory,
  LambdaResponse,
  LambdaStreamHandler,
  LambdaStreamHandlerFactory,
  ResponseStream,
} from "./types.js";
