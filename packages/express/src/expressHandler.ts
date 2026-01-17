import type { Request, Response } from "express";
import { loadEnvSecrets } from "@jaypie/aws";
import { BadRequestError, UnhandledError } from "@jaypie/errors";
import { force, getHeaderFrom, HTTP, JAYPIE, jaypieHandler } from "@jaypie/kit";
import { log as publicLogger } from "@jaypie/logger";
import { DATADOG, hasDatadogEnv, submitMetric } from "@jaypie/datadog";

import getCurrentInvokeUuid from "./getCurrentInvokeUuid.adapter.js";
import decorateResponse from "./decorateResponse.helper.js";
import summarizeRequest from "./summarizeRequest.helper.js";
import summarizeResponse from "./summarizeResponse.helper.js";

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
export type JaypieHandlerSetup = (
  req: Request,
  res: Response,
) => Promise<void> | void;

export type JaypieHandlerTeardown = (
  req: Request,
  res: Response,
) => Promise<void> | void;

export type JaypieHandlerValidate = (
  req: Request,
  res: Response,
) => Promise<boolean> | boolean;

export type ExpressHandlerLocals = (
  req: Request,
  res: Response,
) => Promise<unknown> | unknown;

export interface ExpressHandlerOptions {
  chaos?: string;
  locals?: Record<string, unknown | ExpressHandlerLocals>;
  name?: string;
  secrets?: string[];
  setup?: JaypieHandlerSetup[] | JaypieHandlerSetup;
  teardown?: JaypieHandlerTeardown[] | JaypieHandlerTeardown;
  unavailable?: boolean;
  validate?: JaypieHandlerValidate[] | JaypieHandlerValidate;
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

// Extended response type for Lambda mock responses with direct internal access
interface LambdaMockResponse extends Response {
  _chunks?: Buffer[];
  _headers?: Map<string, string | string[]>;
  _headersSent?: boolean;
  _resolve?: ((result: unknown) => void) | null;
  buildResult?: () => unknown;
  // Internal bypass methods for dd-trace compatibility
  _internalGetHeader?: (name: string) => string | undefined;
  _internalSetHeader?: (name: string, value: string) => void;
  _internalHasHeader?: (name: string) => boolean;
  _internalRemoveHeader?: (name: string) => void;
}

type ExpressHandler<T> = (
  req: Request,
  res: Response,
  ...params: unknown[]
) => Promise<T>;

interface JaypieError extends Error {
  status?: number;
  body?: () => Record<string, unknown>;
}

interface ResponseWithJson {
  json: () => Record<string, unknown>;
}

// Cast logger to extended interface for runtime features not in type definitions
const logger = publicLogger as unknown as ExtendedLogger;

//
//
// Helpers - Safe response methods to bypass dd-trace interception
//

/**
 * Check if response is a Lambda mock response with direct internal access.
 */
function isLambdaMockResponse(res: Response): res is LambdaMockResponse {
  const mock = res as LambdaMockResponse;
  return (
    mock._headers instanceof Map &&
    Array.isArray(mock._chunks) &&
    typeof mock.buildResult === "function"
  );
}

/**
 * Safely send a JSON response, avoiding dd-trace interception.
 * For Lambda mock responses, directly manipulates internal state instead of
 * using stream methods (write/end) which dd-trace intercepts.
 */
function safeSendJson(res: Response, statusCode: number, data: unknown): void {
  if (isLambdaMockResponse(res)) {
    // Use internal method to set header (completely bypasses dd-trace)
    if (typeof res._internalSetHeader === "function") {
      res._internalSetHeader("content-type", "application/json");
    } else {
      // Fall back to direct _headers manipulation
      res._headers!.set("content-type", "application/json");
    }
    res.statusCode = statusCode;

    // Directly push to chunks array instead of using stream write/end
    const chunk = Buffer.from(JSON.stringify(data));
    res._chunks!.push(chunk);
    res._headersSent = true;

    // Signal completion if a promise is waiting
    if (res._resolve) {
      res._resolve(res.buildResult!());
    }
    return;
  }
  // Fall back to standard Express methods for real responses
  res.status(statusCode).json(data);
}

/**
 * Safely send a response body, avoiding dd-trace interception.
 * For Lambda mock responses, directly manipulates internal state instead of
 * using stream methods (write/end) which dd-trace intercepts.
 */
function safeSend(
  res: Response,
  statusCode: number,
  body?: string,
): void {
  if (isLambdaMockResponse(res)) {
    // Direct internal state manipulation - bypasses dd-trace completely
    res.statusCode = statusCode;

    if (body !== undefined) {
      const chunk = Buffer.from(body);
      res._chunks!.push(chunk);
    }
    res._headersSent = true;

    // Signal completion if a promise is waiting
    if (res._resolve) {
      res._resolve(res.buildResult!());
    }
    return;
  }
  // Fall back to standard Express methods for real responses
  if (body !== undefined) {
    res.status(statusCode).send(body);
  } else {
    res.status(statusCode).send();
  }
}

//
//
// Main
//

/* eslint-disable no-redeclare */
function expressHandler<T>(
  handler: ExpressHandler<T>,
  options?: ExpressHandlerOptions,
): ExpressHandler<T>;
function expressHandler<T>(
  options: ExpressHandlerOptions,
  handler: ExpressHandler<T>,
): ExpressHandler<T>;
function expressHandler<T>(
  handlerOrOptions: ExpressHandler<T> | ExpressHandlerOptions,
  optionsOrHandler?: ExpressHandlerOptions | ExpressHandler<T>,
): ExpressHandler<T> {
  /* eslint-enable no-redeclare */
  let handler: ExpressHandler<T>;
  let options: ExpressHandlerOptions;

  // If handler is an object and options is a function, swap them
  if (
    typeof handlerOrOptions === "object" &&
    typeof optionsOrHandler === "function"
  ) {
    handler = optionsOrHandler as ExpressHandler<T>;
    options = handlerOrOptions as ExpressHandlerOptions;
  } else {
    handler = handlerOrOptions as ExpressHandler<T>;
    options = (optionsOrHandler || {}) as ExpressHandlerOptions;
  }

  //
  //
  // Validate
  //
  let {
    chaos,
    locals,
    name,
    secrets,
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
  ) => Promise<void>)[]; // allows a single item
  teardown = force.array(teardown) as ((
    req: Request,
    res: Response,
  ) => Promise<void>)[]; // allows a single item

  //
  //
  // Setup
  //

  let jaypieFunction: ReturnType<typeof jaypieHandler>;

  return async (
    req: Request,
    res: Response,
    ...params: unknown[]
  ): Promise<T> => {
    // * This is the first line of code that runs when a request is received
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
    // Very low-level, internal sub-trace details
    const libLogger = logger.lib({
      lib: JAYPIE.LIB.EXPRESS,
    });
    // Top-level, important details that run at the same level as the main logger
    const log = logger.lib({
      level: logger.level,
      lib: JAYPIE.LIB.EXPRESS,
    });

    // Update the public logger with the request ID
    const invokeUuid = getCurrentInvokeUuid(req);
    if (invokeUuid) {
      logger.tag({ invoke: invokeUuid });
      logger.tag({ shortInvoke: invokeUuid.slice(0, 8) });
      // TODO: in theory this is redundant
      libLogger.tag({ invoke: invokeUuid });
      libLogger.tag({ shortInvoke: invokeUuid.slice(0, 8) });
      log.tag({ invoke: invokeUuid });
      log.tag({ shortInvoke: invokeUuid.slice(0, 8) });
    }

    if (!name) {
      // If handler has a name, use it
      if (handler.name) {
        name = handler.name;
      } else {
        name = JAYPIE.UNKNOWN;
      }
    }
    logger.tag({ handler: name });
    // TODO: in theory this is redundant
    libLogger.tag({ handler: name });
    log.tag({ handler: name });

    libLogger.trace("[jaypie] Express init");

    // Set req.locals if it doesn't exist
    if (!extReq.locals) extReq.locals = {};
    if (!extReq.locals._jaypie) extReq.locals._jaypie = {};

    // Set res.locals if it doesn't exist
    if (!extRes.locals) extRes.locals = {};
    if (!extRes.locals._jaypie) extRes.locals._jaypie = {};

    const originalRes = {
      attemptedCall: undefined as ((...args: unknown[]) => unknown) | undefined,
      attemptedParams: undefined as unknown[] | undefined,
      end: res.end.bind(res) as typeof res.end,
      json: res.json.bind(res) as typeof res.json,
      send: res.send.bind(res) as typeof res.send,
      status: res.status.bind(res) as typeof res.status,
      statusSent: false as boolean | number,
    };

    res.end = ((...endParams: unknown[]) => {
      originalRes.attemptedCall = originalRes.end as unknown as (
        ...args: unknown[]
      ) => unknown;
      originalRes.attemptedParams = endParams;
      log.warn(
        "[jaypie] Illegal call to res.end(); prefer Jaypie response conventions",
      );
      return res;
    }) as typeof res.end;

    res.json = ((...jsonParams: unknown[]) => {
      originalRes.attemptedCall = originalRes.json;
      originalRes.attemptedParams = jsonParams;
      log.warn(
        "[jaypie] Illegal call to res.json(); prefer Jaypie response conventions",
      );
      return res;
    }) as typeof res.json;

    res.send = ((...sendParams: unknown[]) => {
      originalRes.attemptedCall = originalRes.send;
      originalRes.attemptedParams = sendParams;
      log.warn(
        "[jaypie] Illegal call to res.send(); prefer Jaypie response conventions",
      );
      return res;
    }) as typeof res.send;

    res.status = ((...statusParams: [number]) => {
      originalRes.statusSent = statusParams[0];
      return originalRes.status(...statusParams);
    }) as typeof res.status;

    //
    //
    // Preprocess
    //

    // Load secrets into process.env if configured
    if (secrets && secrets.length > 0) {
      const secretsToLoad = secrets;
      const secretsSetup: JaypieHandlerSetup = async () => {
        await loadEnvSecrets(...secretsToLoad);
      };
      setup.unshift(secretsSetup);
    }

    if (locals) {
      // Locals
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

    let response: T | Record<string, unknown> | undefined;
    let status: number = HTTP.CODE.OK;

    try {
      log.info.var({ req: summarizeRequest(req) });

      // Initialize after logging is set up

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

      libLogger.trace("[jaypie] Express execution");

      //
      //
      // Process
      //

      response = (await jaypieFunction(req, res, ...params)) as
        | T
        | Record<string, unknown>
        | undefined;

      //
      //
      // Error Handling
      //
    } catch (error) {
      // In theory jaypieFunction has handled all errors
      const jaypieError = error as JaypieError;
      if (jaypieError.status) {
        status = jaypieError.status;
      }
      if (typeof jaypieError.body === "function") {
        response = jaypieError.body();
      } else {
        // This should never happen
        const unhandledError = new UnhandledError();
        response = unhandledError.body() as unknown as Record<string, unknown>;
        status = unhandledError.status;
      }
    }

    //
    //
    // Postprocess
    //

    // Restore original res functions
    res.end = originalRes.end;
    res.json = originalRes.json;
    res.send = originalRes.send;
    res.status = originalRes.status;

    // Decorate response
    decorateResponse(res, { handler: name });

    // Allow the sent status to override the status in the response
    if (originalRes.statusSent) {
      status = originalRes.statusSent as number;
    }

    // Send response
    try {
      if (!originalRes.attemptedCall) {
        // Body
        if (response) {
          if (typeof response === "object") {
            if (
              typeof (response as unknown as ResponseWithJson).json ===
              "function"
            ) {
              safeSendJson(
                res,
                status,
                (response as unknown as ResponseWithJson).json(),
              );
            } else {
              safeSendJson(res, status, response);
            }
          } else if (typeof response === "string") {
            try {
              safeSendJson(res, status, JSON.parse(response));
            } catch {
              safeSend(res, status, response);
            }
          } else if (response === true) {
            safeSend(res, HTTP.CODE.CREATED);
          } else {
            safeSend(res, status, response as unknown as string);
          }
        } else {
          // No response
          safeSend(res, HTTP.CODE.NO_CONTENT);
        }
      } else {
        // Resolve illegal call to res.end(), res.json(), or res.send()
        log.debug("[jaypie] Resolving illegal call to res");
        log.var({
          attemptedCall: {
            name: originalRes.attemptedCall.name,
            params: originalRes.attemptedParams,
          },
        });
        // Call the original function with the original parameters and the original `this` (res)
        (originalRes.attemptedCall as (...args: unknown[]) => unknown).call(
          res,
          ...(originalRes.attemptedParams || []),
        );
      }
    } catch (error) {
      log.fatal("Express encountered an error while sending the response");
      log.var({ responseError: error });
      // Log full stack trace for debugging
      if (error instanceof Error && error.stack) {
        log.error(error.stack);
      }
    }

    // Log response
    const extras: Record<string, unknown> = {};
    if (response) extras.body = response;
    log.info.var({
      res: summarizeResponse(res, extras),
    });

    // Submit metric if Datadog is configured
    if (hasDatadogEnv()) {
      // Construct path from baseUrl and url
      let path = (req.baseUrl || "") + (req.url || "");
      // Ensure path starts with /
      if (!path.startsWith("/")) {
        path = "/" + path;
      }
      // Remove trailing slash unless it's the root path
      if (path.length > 1 && path.endsWith("/")) {
        path = path.slice(0, -1);
      }

      // Replace UUIDs with :id for better aggregation
      // Matches standard UUID v4 format (8-4-4-4-12 hex characters)
      path = path.replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        ":id",
      );

      // Determine metric name based on environment variables
      let metricPrefix = "project";
      if (process.env.PROJECT_SPONSOR) {
        metricPrefix = process.env.PROJECT_SPONSOR;
      } else if (process.env.PROJECT_KEY) {
        metricPrefix = `project.${process.env.PROJECT_KEY}`;
      }

      await submitMetric({
        name: `${metricPrefix}.api.response`,
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

    //
    //
    // Return
    //

    return response as T;
  };
}

//
//
// Export
//

export default expressHandler;
