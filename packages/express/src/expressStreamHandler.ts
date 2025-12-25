import type { Request, Response } from "express";
import { BadRequestError, UnhandledError } from "@jaypie/errors";
import { force, getHeaderFrom, HTTP, JAYPIE, jaypieHandler } from "@jaypie/kit";
import { log as publicLogger } from "@jaypie/logger";
import { DATADOG, hasDatadogEnv, submitMetric } from "@jaypie/datadog";

import getCurrentInvokeUuid from "./getCurrentInvokeUuid.adapter.js";
import summarizeRequest from "./summarizeRequest.helper.js";

//
//
// Types
//

// Extended logger interface for features not in the base type definitions
interface ExtendedLogger {
  init: () => void;
  level: string;
  debug: {
    (...args: unknown[]): void;
    var(key: string | Record<string, unknown>, value?: unknown): void;
  };
  error: {
    (...args: unknown[]): void;
    var(key: string | Record<string, unknown>, value?: unknown): void;
  };
  fatal: {
    (...args: unknown[]): void;
    var(key: string | Record<string, unknown>, value?: unknown): void;
  };
  info: {
    (...args: unknown[]): void;
    var(key: string | Record<string, unknown>, value?: unknown): void;
  };
  trace: {
    (...args: unknown[]): void;
    var(key: string | Record<string, unknown>, value?: unknown): void;
  };
  warn: {
    (...args: unknown[]): void;
    var(key: string | Record<string, unknown>, value?: unknown): void;
  };
  var(key: string | Record<string, unknown>, value?: unknown): void;
  tag(
    key: string | string[] | Record<string, unknown> | null,
    value?: string,
  ): void;
  untag(tags: string | string[] | Record<string, unknown> | null): void;
  lib(options: {
    level?: string;
    lib?: string;
    tags?: Record<string, unknown>;
  }): ExtendedLogger;
}

// Exported type aliases for defining handler lifecycle functions
export type JaypieStreamHandlerSetup = (
  req: Request,
  res: Response,
) => Promise<void> | void;

export type JaypieStreamHandlerTeardown = (
  req: Request,
  res: Response,
) => Promise<void> | void;

export type JaypieStreamHandlerValidate = (
  req: Request,
  res: Response,
) => Promise<boolean> | boolean;

export type ExpressStreamHandlerLocals = (
  req: Request,
  res: Response,
) => Promise<unknown> | unknown;

export interface ExpressStreamHandlerOptions {
  chaos?: string;
  contentType?: string;
  locals?: Record<string, unknown | ExpressStreamHandlerLocals>;
  name?: string;
  setup?: JaypieStreamHandlerSetup[] | JaypieStreamHandlerSetup;
  teardown?: JaypieStreamHandlerTeardown[] | JaypieStreamHandlerTeardown;
  unavailable?: boolean;
  validate?: JaypieStreamHandlerValidate[] | JaypieStreamHandlerValidate;
}

interface ExtendedRequest extends Request {
  locals: Record<string, unknown> & {
    _jaypie?: Record<string, unknown>;
  };
}

interface ExtendedResponse extends Response {
  locals: Record<string, unknown> & {
    _jaypie?: Record<string, unknown>;
  };
}

/**
 * Streaming Express handler function signature.
 * Handler should write to the response stream and not return a value.
 */
export type ExpressStreamHandler = (
  req: Request,
  res: Response,
  ...params: unknown[]
) => Promise<void>;

interface JaypieError extends Error {
  status?: number;
  body?: () => Record<string, unknown>;
  isProjectError?: boolean;
}

// Cast logger to extended interface for runtime features not in type definitions
const logger = publicLogger as unknown as ExtendedLogger;

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
    ? ((error as JaypieError).body?.() ?? { error: error.message })
    : new UnhandledError().body();

  return `event: error\ndata: ${JSON.stringify(body)}\n\n`;
}

//
//
// Main
//

/**
 * Creates a streaming Express handler that sets up SSE headers and allows
 * streaming responses. The handler receives the standard req/res and should
 * write to res.write() directly.
 *
 * Usage:
 * ```ts
 * app.get('/stream', expressStreamHandler(async (req, res) => {
 *   const llmStream = llm.stream("Hello");
 *   await createExpressStream(llmStream, res);
 * }));
 * ```
 *
 * The handler sets appropriate SSE headers automatically:
 * - Content-Type: text/event-stream
 * - Cache-Control: no-cache
 * - Connection: keep-alive
 * - X-Accel-Buffering: no (disables nginx buffering)
 */
/* eslint-disable no-redeclare */
function expressStreamHandler(
  handler: ExpressStreamHandler,
  options?: ExpressStreamHandlerOptions,
): ExpressStreamHandler;
function expressStreamHandler(
  options: ExpressStreamHandlerOptions,
  handler: ExpressStreamHandler,
): ExpressStreamHandler;
function expressStreamHandler(
  handlerOrOptions: ExpressStreamHandler | ExpressStreamHandlerOptions,
  optionsOrHandler?: ExpressStreamHandlerOptions | ExpressStreamHandler,
): ExpressStreamHandler {
  /* eslint-enable no-redeclare */
  let handler: ExpressStreamHandler;
  let options: ExpressStreamHandlerOptions;

  // If handler is an object and options is a function, swap them
  if (
    typeof handlerOrOptions === "object" &&
    typeof optionsOrHandler === "function"
  ) {
    handler = optionsOrHandler as ExpressStreamHandler;
    options = handlerOrOptions as ExpressStreamHandlerOptions;
  } else {
    handler = handlerOrOptions as ExpressStreamHandler;
    options = (optionsOrHandler || {}) as ExpressStreamHandlerOptions;
  }

  //
  //
  // Validate
  //
  let {
    chaos,
    contentType = "text/event-stream",
    locals,
    name,
    setup = [],
    teardown = [],
    unavailable,
    validate,
  } = options;
  if (typeof handler !== "function") {
    throw new BadRequestError(
      `Argument "${handler}" doesn't match type "function"`,
    );
  }
  if (
    locals !== undefined &&
    (typeof locals !== "object" || locals === null || Array.isArray(locals))
  ) {
    throw new BadRequestError(
      `Argument "${locals}" doesn't match type "object"`,
    );
  }
  setup = force.array(setup) as ((
    req: Request,
    res: Response,
  ) => Promise<void>)[];
  teardown = force.array(teardown) as ((
    req: Request,
    res: Response,
  ) => Promise<void>)[];

  //
  //
  // Setup
  //

  let jaypieFunction: ReturnType<typeof jaypieHandler>;

  return async (
    req: Request,
    res: Response,
    ...params: unknown[]
  ): Promise<void> => {
    const extReq = req as ExtendedRequest;
    const extRes = res as ExtendedResponse;

    // Set default chaos value
    if (chaos === undefined) {
      chaos =
        process.env.PROJECT_CHAOS ||
        (getHeaderFrom(
          "X-Project-Chaos",
          req as unknown as Record<string, unknown>,
        ) as string | undefined);
    }

    // Re-init the logger
    logger.init();
    const libLogger = logger.lib({
      lib: JAYPIE.LIB.EXPRESS,
    });
    const log = logger.lib({
      level: logger.level,
      lib: JAYPIE.LIB.EXPRESS,
    });

    // Update the public logger with the request ID
    const invokeUuid = getCurrentInvokeUuid();
    if (invokeUuid) {
      logger.tag({ invoke: invokeUuid });
      logger.tag({ shortInvoke: invokeUuid.slice(0, 8) });
      libLogger.tag({ invoke: invokeUuid });
      libLogger.tag({ shortInvoke: invokeUuid.slice(0, 8) });
      log.tag({ invoke: invokeUuid });
      log.tag({ shortInvoke: invokeUuid.slice(0, 8) });
    }

    if (!name) {
      if (handler.name) {
        name = handler.name;
      } else {
        name = JAYPIE.UNKNOWN;
      }
    }
    logger.tag({ handler: name });
    libLogger.tag({ handler: name });
    log.tag({ handler: name });

    libLogger.trace("[jaypie] Express stream init");

    // Set req.locals if it doesn't exist
    if (!extReq.locals) extReq.locals = {};
    if (!extReq.locals._jaypie) extReq.locals._jaypie = {};

    // Set res.locals if it doesn't exist
    if (!extRes.locals) extRes.locals = {};
    if (!extRes.locals._jaypie) extRes.locals._jaypie = {};

    //
    //
    // SSE Headers
    //

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    res.flushHeaders();

    //
    //
    // Preprocess
    //

    if (locals) {
      const keys = Object.keys(locals);
      if (keys.length > 0) {
        const localsSetup = async (localsReq: Request, localsRes: Response) => {
          const extLocalsReq = localsReq as ExtendedRequest;
          for (let i = 0; i < keys.length; i += 1) {
            const key = keys[i];
            libLogger.trace(`[jaypie] Locals: ${key}`);
            const localValue = locals[key];
            if (typeof localValue === "function") {
              extLocalsReq.locals[key] = await localValue(localsReq, localsRes);
            } else {
              extLocalsReq.locals[key] = localValue;
            }
          }
        };
        setup.push(localsSetup);
      }
    }

    try {
      log.info.var({ req: summarizeRequest(req) });

      jaypieFunction = jaypieHandler(
        handler as unknown as (...args: unknown[]) => Promise<unknown>,
        {
          chaos,
          name,
          setup,
          teardown,
          unavailable,
          validate,
        } as any,
      );

      libLogger.trace("[jaypie] Express stream execution");

      //
      //
      // Process
      //

      await jaypieFunction(req, res, ...params);

      //
      //
      // Error Handling
      //
    } catch (error) {
      const jaypieError = error as JaypieError;

      // Log the error
      if (jaypieError.isProjectError) {
        log.debug("Caught jaypie error in stream handler");
        log.info.var({ jaypieError: error });
      } else {
        log.fatal("Caught unhandled error in stream handler");
        log.info.var({ unhandledError: (error as Error).message });
      }

      // Write error as SSE event
      try {
        res.write(formatErrorSSE(error as Error));
      } catch {
        // Response may already be closed
        log.warn("Failed to write error to stream - response may be closed");
      }
    } finally {
      // End the response
      try {
        res.end();
      } catch {
        // Response may already be ended
      }

      //
      //
      // Postprocess
      //

      // Log completion
      log.info.var({
        res: { statusCode: res.statusCode, streaming: true },
      });

      // Submit metric if Datadog is configured
      if (hasDatadogEnv()) {
        let path = (req.baseUrl || "") + (req.url || "");
        if (!path.startsWith("/")) {
          path = "/" + path;
        }
        if (path.length > 1 && path.endsWith("/")) {
          path = path.slice(0, -1);
        }
        path = path.replace(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
          ":id",
        );

        let metricPrefix = "project";
        if (process.env.PROJECT_SPONSOR) {
          metricPrefix = process.env.PROJECT_SPONSOR;
        } else if (process.env.PROJECT_KEY) {
          metricPrefix = `project.${process.env.PROJECT_KEY}`;
        }

        await submitMetric({
          name: `${metricPrefix}.api.stream`,
          type: DATADOG.METRIC.TYPE.COUNT,
          value: 1,
          tags: {
            status: String(res.statusCode),
            path,
          },
        });
      }

      // Clean up the public logger
      logger.untag("handler");
    }
  };
}

//
//
// Export
//

export default expressStreamHandler;
