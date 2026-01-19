import {
  formatStreamError,
  getContentTypeForFormat,
  loadEnvSecrets,
} from "@jaypie/aws";
import type { StreamFormat } from "@jaypie/aws";
import { ConfigurationError, UnhandledError } from "@jaypie/errors";
import { JAYPIE, jaypieHandler } from "@jaypie/kit";
import { log as publicLogger } from "@jaypie/logger";

//
//
// Globals
//

// Declare awslambda global for Lambda runtime
declare const awslambda:
  | {
      streamifyResponse: <T>(
        handler: (
          event: T,
          responseStream: ResponseStream,
          context: LambdaStreamContext,
        ) => Promise<void>,
      ) => (event: T, context: LambdaStreamContext) => Promise<void>;
    }
  | undefined;

//
//
// Types
//

/**
 * Lambda Response Stream writer interface
 */
export interface ResponseStream {
  write(chunk: string | Uint8Array): void;
  end(): void;
  setContentType?(contentType: string): void;
}

/**
 * Lambda context from AWS
 */
export interface LambdaStreamContext {
  awsRequestId?: string;
  [key: string]: unknown;
}

/**
 * Extended context provided to streaming handlers
 */
export interface StreamHandlerContext extends LambdaStreamContext {
  responseStream: ResponseStream;
}

type ValidatorFunction = (...args: unknown[]) => unknown | Promise<unknown>;
type LifecycleFunction = (...args: unknown[]) => void | Promise<void>;

export interface LambdaStreamHandlerOptions {
  chaos?: string;
  contentType?: string;
  format?: StreamFormat;
  name?: string;
  secrets?: string[];
  setup?: LifecycleFunction[];
  teardown?: LifecycleFunction[];
  throw?: boolean;
  unavailable?: boolean;
  validate?: ValidatorFunction[];
}

/**
 * Handler function signature for streaming Lambda handlers
 */
export type LambdaStreamHandlerFunction<TEvent = unknown> = (
  event: TEvent,
  context: StreamHandlerContext,
  ...args: unknown[]
) => Promise<void> | void;

/**
 * Raw AWS streaming handler signature (for awslambda.streamifyResponse)
 */
export type AwsStreamingHandler<TEvent = unknown> = (
  event: TEvent,
  responseStream: ResponseStream,
  context: LambdaStreamContext,
) => Promise<void>;

interface JaypieError extends Error {
  isProjectError?: boolean;
  body: () => unknown;
  json: () => unknown;
}

interface JaypieLogger {
  init: () => void;
  tag: (tags: Record<string, unknown>) => void;
  untag: (tag: string) => void;
  lib: (options: Record<string, unknown>) => JaypieLibLogger;
  level: string;
}

interface JaypieLibLogger {
  trace: (message: string) => void;
  debug: (message: string) => void;
  fatal: (message: string) => void;
  info: {
    var: (data: Record<string, unknown>) => void;
  };
}

/**
 * Wrapped Lambda handler (after awslambda.streamifyResponse)
 */
export type LambdaHandler<TEvent = unknown> = (
  event: TEvent,
  context: LambdaStreamContext,
) => Promise<void>;

//
//
// Helper
//

/**
 * Get error body from an error
 */
function getErrorBody(error: JaypieError | Error): Record<string, unknown> {
  const isJaypieError = (error as JaypieError).isProjectError;
  return isJaypieError
    ? ((error as JaypieError).body() as unknown as Record<string, unknown>)
    : (new UnhandledError().body() as unknown as Record<string, unknown>);
}

//
//
// Main
//

/**
 * Creates a streaming Lambda handler compatible with AWS Lambda Response Streaming.
 * Automatically wraps with awslambda.streamifyResponse() in Lambda environment.
 *
 * Usage:
 * ```ts
 * export const handler = lambdaStreamHandler(async (event, context) => {
 *   const llmStream = llm.stream("Hello");
 *   await createLambdaStream(llmStream, context.responseStream);
 * });
 * ```
 *
 * The handler receives an extended context with `responseStream` for direct access
 * to the Lambda response stream writer.
 *
 * Supports both SSE (default) and NLJSON formats:
 * ```ts
 * export const handler = lambdaStreamHandler(myHandler, { format: "nljson" });
 * ```
 */
const lambdaStreamHandler = function <TEvent = unknown>(
  handler: LambdaStreamHandlerFunction<TEvent> | LambdaStreamHandlerOptions,
  options:
    | LambdaStreamHandlerOptions
    | LambdaStreamHandlerFunction<TEvent> = {},
): LambdaHandler<TEvent> {
  // If handler is an object and options is a function, swap them
  if (typeof handler === "object" && typeof options === "function") {
    const temp = handler;
    handler = options;
    options = temp;
  }

  const opts = options as LambdaStreamHandlerOptions;
  const format: StreamFormat = opts.format ?? "sse";
  let {
    chaos,
    contentType = getContentTypeForFormat(format),
    name,
    secrets,
    setup = [],
    teardown,
    throw: shouldThrow = false,
    unavailable,
    validate,
  } = opts;

  // Add secrets loading to setup if secrets are provided
  if (secrets && secrets.length > 0) {
    const secretsToLoad = secrets;
    const secretsSetup: LifecycleFunction = async () => {
      await loadEnvSecrets(...secretsToLoad);
    };
    setup = [secretsSetup, ...setup];
  }

  //
  //
  // Validate
  //

  if (typeof handler !== "function") {
    throw new ConfigurationError(
      "The handler responding to the request encountered a configuration error",
    );
  }

  //
  //
  // Setup
  //

  const innerHandler: AwsStreamingHandler<TEvent> = async (
    event: TEvent = {} as TEvent,
    responseStream: ResponseStream,
    context: LambdaStreamContext = {},
  ): Promise<void> => {
    if (!name) {
      // If handler has a name, use it
      if ((handler as LambdaStreamHandlerFunction).name) {
        name = (handler as LambdaStreamHandlerFunction).name;
      } else {
        name = JAYPIE.UNKNOWN;
      }
    }

    // Re-init the logger
    (publicLogger as unknown as JaypieLogger).init();

    // The public logger is also the "root" logger
    if (context.awsRequestId) {
      (publicLogger as unknown as JaypieLogger).tag({
        invoke: context.awsRequestId,
      });
      (publicLogger as unknown as JaypieLogger).tag({
        shortInvoke: context.awsRequestId.slice(0, 8),
      });
    }
    (publicLogger as unknown as JaypieLogger).tag({ handler: name });

    // Very low-level, sub-trace details
    const libLogger = (publicLogger as unknown as JaypieLogger).lib({
      lib: JAYPIE.LIB.LAMBDA,
    });
    libLogger.trace("[jaypie] Lambda stream init");

    const log = (publicLogger as unknown as JaypieLogger).lib({
      level: (publicLogger as unknown as JaypieLogger).level,
      lib: JAYPIE.LIB.LAMBDA,
    });

    // Set content type for SSE
    if (responseStream.setContentType) {
      responseStream.setContentType(contentType);
    }

    //
    //
    // Preprocess
    //

    // Create extended context with responseStream
    const extendedContext: StreamHandlerContext = {
      ...context,
      responseStream,
    };

    // Wrap with jaypieHandler for lifecycle hooks
    const jaypieFunction = jaypieHandler(
      async (...args: unknown[]) => {
        await (handler as LambdaStreamHandlerFunction<TEvent>)(
          args[0] as TEvent,
          args[1] as StreamHandlerContext,
          ...args.slice(2),
        );
      },
      {
        chaos,
        name,
        setup,
        teardown,
        unavailable,
        validate,
      },
    );

    try {
      libLogger.trace("[jaypie] Lambda stream execution");
      log.info.var({ event });

      //
      //
      // Process
      //

      await jaypieFunction(event, extendedContext);

      //
      //
      // Error Handling
      //
    } catch (error) {
      // Jaypie or "project" errors are intentional and should be handled like expected cases
      if ((error as JaypieError).isProjectError) {
        log.debug("Caught jaypie error");
        log.info.var({ jaypieError: error });
      } else {
        // Otherwise, flag unhandled errors as fatal
        log.fatal("Caught unhandled error");
        log.info.var({ unhandledError: (error as Error).message });
      }

      // Write error in the appropriate format
      const errorBody = getErrorBody(error as JaypieError | Error);
      responseStream.write(formatStreamError(errorBody, format));

      if (shouldThrow) {
        libLogger.debug(
          `Throwing error instead of streaming response (throw=${shouldThrow})`,
        );
        throw error;
      }
    } finally {
      // Always end the stream
      responseStream.end();

      //
      //
      // Postprocess
      //

      // Clean up the public logger
      (publicLogger as unknown as JaypieLogger).untag("handler");
    }
  };

  //
  //
  // Auto-wrap with awslambda.streamifyResponse()
  //

  // Check if awslambda global exists (Lambda runtime)
  if (typeof awslambda !== "undefined" && awslambda?.streamifyResponse) {
    return awslambda.streamifyResponse(innerHandler);
  }

  // For testing - return a handler that accepts a mock response stream
  // This allows tests to pass a mock stream directly
  return innerHandler as unknown as LambdaHandler<TEvent>;
};

//
//
// Export
//

export default lambdaStreamHandler;

// Also export the raw handler type for testing purposes
export type { AwsStreamingHandler as RawStreamingHandler };
