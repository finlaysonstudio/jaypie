import { ConfigurationError, UnhandledError } from "@jaypie/errors";
import { JAYPIE, jaypieHandler } from "@jaypie/kit";
import { log as publicLogger } from "@jaypie/logger";

//
//
// Types
//

export interface LambdaContext {
  awsRequestId?: string;
  [key: string]: unknown;
}

type ValidatorFunction = (...args: unknown[]) => unknown | Promise<unknown>;
type LifecycleFunction = (...args: unknown[]) => void | Promise<void>;

export interface LambdaHandlerOptions {
  chaos?: string;
  name?: string;
  setup?: LifecycleFunction[];
  teardown?: LifecycleFunction[];
  throw?: boolean;
  unavailable?: boolean;
  validate?: ValidatorFunction[];
}

export type LambdaHandlerFunction<TEvent = unknown, TResult = unknown> = (
  event: TEvent,
  context?: LambdaContext,
  ...args: unknown[]
) => Promise<TResult> | TResult;

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
// Main
//

const lambdaHandler = function <TEvent = unknown, TResult = unknown>(
  handler: LambdaHandlerFunction<TEvent, TResult> | LambdaHandlerOptions,
  options: LambdaHandlerOptions | LambdaHandlerFunction<TEvent, TResult> = {},
): LambdaHandlerFunction<TEvent, TResult> {
  // If handler is an object and options is a function, swap them
  if (typeof handler === "object" && typeof options === "function") {
    const temp = handler;
    handler = options;
    options = temp;
  }

  const opts = options as LambdaHandlerOptions;
  let {
    chaos,
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
    context: LambdaContext = {},
    ...args: unknown[]
  ): Promise<TResult> => {
    if (!name) {
      // If handler has a name, use it
      if ((handler as LambdaHandlerFunction).name) {
        name = (handler as LambdaHandlerFunction).name;
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
    libLogger.trace("[jaypie] Lambda init");

    const log = (publicLogger as unknown as JaypieLogger).lib({
      level: (publicLogger as unknown as JaypieLogger).level,
      lib: JAYPIE.LIB.LAMBDA,
    });

    //
    //
    // Preprocess
    //

    const jaypieFunction = jaypieHandler(
      handler as (...args: unknown[]) => Promise<unknown>,
      {
        chaos,
        name,
        setup,
        teardown,
        unavailable,
        validate,
      },
    );

    let response: TResult;

    try {
      libLogger.trace("[jaypie] Lambda execution");
      log.info.var({ event });

      //
      //
      // Process
      //

      response = (await jaypieFunction(event, context, ...args)) as TResult;

      //
      //
      // Error Handling
      //
    } catch (error) {
      // Jaypie or "project" errors are intentional and should be handled like expected cases
      if ((error as JaypieError).isProjectError) {
        log.debug("Caught jaypie error");
        log.info.var({ jaypieError: error });
        response = (error as JaypieError).body() as TResult;
      } else {
        // Otherwise, flag unhandled errors as fatal
        log.fatal("Caught unhandled error");
        log.info.var({ unhandledError: (error as Error).message });
        response = new UnhandledError().body() as TResult;
      }
      if (shouldThrow) {
        libLogger.debug(
          `Throwing error instead of returning response (throw=${shouldThrow})`,
        );
        throw error;
      }
    }

    //
    //
    // Postprocess
    //

    // TODO: API Gateway proxy response

    // Log response
    log.info.var({ response });

    // Clean up the public logger
    (publicLogger as unknown as JaypieLogger).untag("handler");

    //
    //
    // Return
    //

    return response;
  };
};

//
//
// Export
//

export default lambdaHandler;
