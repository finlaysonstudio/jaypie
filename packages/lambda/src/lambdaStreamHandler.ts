import { ConfigurationError, UnhandledError } from "@jaypie/errors";
import { JAYPIE, jaypieHandler } from "@jaypie/kit";
import { log as publicLogger } from "@jaypie/logger";

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
  name?: string;
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

//
//
// Helper
//

/**
 * Format an error as an SSE error event
 */
function formatErrorSSE(error: JaypieError | Error): string {
  const isJaypieError = (error as JaypieError).isProjectError;
  const body = isJaypieError
    ? (error as JaypieError).body()
    : new UnhandledError().body();

  return `event: error\ndata: ${JSON.stringify(body)}\n\n`;
}

//
//
// Main
//

/**
 * Creates a streaming Lambda handler compatible with AWS Lambda Response Streaming.
 *
 * Usage with awslambda.streamifyResponse:
 * ```ts
 * export const handler = awslambda.streamifyResponse(
 *   lambdaStreamHandler(async (event, context) => {
 *     const llmStream = llm.stream("Hello");
 *     await createLambdaStream(llmStream, context.responseStream);
 *   })
 * );
 * ```
 *
 * The handler receives an extended context with `responseStream` for direct access
 * to the Lambda response stream writer.
 */
const lambdaStreamHandler = function <TEvent = unknown>(
  handler: LambdaStreamHandlerFunction<TEvent> | LambdaStreamHandlerOptions,
  options:
    | LambdaStreamHandlerOptions
    | LambdaStreamHandlerFunction<TEvent> = {},
): AwsStreamingHandler<TEvent> {
  // If handler is an object and options is a function, swap them
  if (typeof handler === "object" && typeof options === "function") {
    const temp = handler;
    handler = options;
    options = temp;
  }

  const opts = options as LambdaStreamHandlerOptions;
  let {
    chaos,
    contentType = "text/event-stream",
    name,
    setup,
    teardown,
    throw: shouldThrow = false,
    unavailable,
    validate,
  } = opts;

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

  return async (
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
        // Write error as SSE event
        responseStream.write(formatErrorSSE(error as JaypieError));
      } else {
        // Otherwise, flag unhandled errors as fatal
        log.fatal("Caught unhandled error");
        log.info.var({ unhandledError: (error as Error).message });
        // Write unhandled error as SSE event
        responseStream.write(formatErrorSSE(error as Error));
      }
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
};

//
//
// Export
//

export default lambdaStreamHandler;
