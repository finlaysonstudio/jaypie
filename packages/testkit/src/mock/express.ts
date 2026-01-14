/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import {
  createMockFunction,
  createMockResolvedFunction,
  createMockReturnedFunction,
  createMockWrappedFunction,
} from "./utils";
import { BadRequestError, UnhandledError } from "@jaypie/errors";
import { force, jaypieHandler } from "./core";
import * as original from "@jaypie/express";

// Constants for mock values
const TAG = "EXPRESS";
const HTTP = {
  CODE: { OK: 200, CREATED: 201, NO_CONTENT: 204, INTERNAL_ERROR: 500 },
};

// Re-export Lambda adapter classes directly (these are not mocked)
export const createLambdaHandler = createMockWrappedFunction(
  original.createLambdaHandler as (...args: unknown[]) => unknown,
);
export const createLambdaStreamHandler = createMockWrappedFunction(
  original.createLambdaStreamHandler as (...args: unknown[]) => unknown,
);
export const getCurrentInvoke = createMockReturnedFunction<{
  context: unknown;
  event: unknown;
}>({ context: undefined, event: undefined });
export const LambdaRequest = original.LambdaRequest;
export const LambdaResponseBuffered = original.LambdaResponseBuffered;
export const LambdaResponseStreaming = original.LambdaResponseStreaming;

export const EXPRESS = original.EXPRESS;

// Add Express route functions
export const badRequestRoute = createMockWrappedFunction(
  original.badRequestRoute as (...args: unknown[]) => unknown,
  { error: `_MOCK_BAD_REQUEST_ROUTE_[${TAG}]` },
);

export const echoRoute = createMockWrappedFunction(
  original.echoRoute as (...args: unknown[]) => unknown,
  (req: unknown) => req,
);

export const forbiddenRoute = createMockWrappedFunction(
  original.forbiddenRoute as (...args: unknown[]) => unknown,
  { error: `_MOCK_FORBIDDEN_ROUTE_[${TAG}]` },
);

export const goneRoute = createMockWrappedFunction(
  original.goneRoute as (...args: unknown[]) => unknown,
  {
    error: `_MOCK_GONE_ROUTE_[${TAG}]`,
  },
);

export const methodNotAllowedRoute = createMockWrappedFunction(
  original.methodNotAllowedRoute as (...args: unknown[]) => unknown,
  { error: `_MOCK_METHOD_NOT_ALLOWED_ROUTE_[${TAG}]` },
);

export const noContentRoute = createMockWrappedFunction(
  original.noContentRoute as (...args: unknown[]) => unknown,
  { status: 204 },
);

export const notFoundRoute = createMockWrappedFunction(
  original.notFoundRoute as (...args: unknown[]) => unknown,
  {
    error: `_MOCK_NOT_FOUND_ROUTE_[${TAG}]`,
  },
);

export const notImplementedRoute = createMockWrappedFunction(
  original.notImplementedRoute as any,
  { error: `_MOCK_NOT_IMPLEMENTED_ROUTE_[${TAG}]` },
);

export const expressHttpCodeHandler = createMockWrappedFunction(
  original.expressHttpCodeHandler as any,
  (...args: any[]) => {
    const [, res] = args;
    return res.status(200).send();
  },
);

export const cors = createMockWrappedFunction(original.cors as any);

export const createServer = createMockResolvedFunction<{
  port: number;
  server: { close: () => void };
}>({ port: 8080, server: { close: () => {} } });

export const getCurrentInvokeUuid = createMockReturnedFunction<
  string | undefined
>("mock-invoke-uuid-12345678");

// Type definitions needed for the expressHandler
interface WithJsonFunction {
  json: () => any;
}

export interface ExpressHandlerFunction {
  (req: any, res: any, ...extra: any[]): Promise<any> | any;
}

export interface ExpressHandlerOptions {
  locals?: Record<string, any>;
  setup?: any[] | Function;
  teardown?: any[] | Function;
  unavailable?: boolean;
  validate?: any[] | Function;
}

type ExpressHandlerParameter = ExpressHandlerFunction | ExpressHandlerOptions;

export interface ExpressStreamHandlerOptions {
  locals?: Record<string, any>;
  setup?: any[] | Function;
  teardown?: any[] | Function;
  unavailable?: boolean;
  validate?: any[] | Function;
  contentType?: string;
}

export type ExpressStreamHandlerFunction = (
  req: any,
  res: any,
  ...extra: any[]
) => Promise<void>;

type ExpressStreamHandlerParameter =
  | ExpressStreamHandlerFunction
  | ExpressStreamHandlerOptions;

export const expressStreamHandler = createMockFunction<
  (
    handlerOrProps: ExpressStreamHandlerParameter,
    propsOrHandler?: ExpressStreamHandlerParameter,
  ) => (req: any, res: any, ...extra: any[]) => Promise<void>
>((handlerOrProps, propsOrHandler) => {
  let handler: ExpressStreamHandlerFunction;
  let props: ExpressStreamHandlerOptions;

  if (
    typeof handlerOrProps === "object" &&
    typeof propsOrHandler === "function"
  ) {
    handler = propsOrHandler;
    props = handlerOrProps;
  } else if (typeof handlerOrProps === "function") {
    handler = handlerOrProps;
    props = (propsOrHandler || {}) as ExpressStreamHandlerOptions;
  } else {
    throw new BadRequestError("handler must be a function");
  }

  return async (req = {}, res: any = {}, ...extra: unknown[]) => {
    // Set SSE headers if res has setHeader method
    if (typeof res.setHeader === "function") {
      res.setHeader("Content-Type", props.contentType || "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
      }
    }

    try {
      await handler(req, res, ...extra);
    } finally {
      // End the response if possible
      if (typeof res.end === "function") {
        try {
          res.end();
        } catch {
          // Response may already be ended
        }
      }
    }
  };
});

export const expressHandler = createMockFunction<
  (
    handlerOrProps: ExpressHandlerParameter,
    propsOrHandler?: ExpressHandlerParameter,
  ) => (req: any, res: any, ...extra: any[]) => Promise<any>
>((handlerOrProps, propsOrHandler) => {
  let handler: ExpressHandlerFunction;
  let props: ExpressHandlerOptions;

  if (
    typeof handlerOrProps === "object" &&
    typeof propsOrHandler === "function"
  ) {
    handler = propsOrHandler;
    props = handlerOrProps;
  } else if (typeof handlerOrProps === "function") {
    handler = handlerOrProps;
    props = (propsOrHandler || {}) as ExpressHandlerOptions;
  } else {
    throw new BadRequestError("handler must be a function");
  }

  // Add locals setup if needed
  if (
    props.locals &&
    typeof props.locals === "object" &&
    !Array.isArray(props.locals)
  ) {
    const keys = Object.keys(props.locals);
    if (!props.setup) props.setup = [];
    props.setup = force.array(props.setup);
    props.setup.unshift((req: { locals?: Record<string, unknown> }) => {
      if (!req || typeof req !== "object") {
        throw new BadRequestError("req must be an object");
      }
      // Set req.locals if it doesn't exist
      if (!req.locals) req.locals = {};
      if (typeof req.locals !== "object" || Array.isArray(req.locals)) {
        throw new BadRequestError("req.locals must be an object");
      }
      if (!req.locals._jaypie) req.locals._jaypie = {};
    });
    const localsSetup = async (
      localsReq: { locals: Record<string, unknown> },
      localsRes: unknown,
    ) => {
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        if (typeof props.locals![key] === "function") {
          localsReq.locals[key] = await props.locals![key](
            localsReq,
            localsRes,
          );
        } else {
          localsReq.locals[key] = props.locals![key];
        }
      }
    };
    props.setup.push(localsSetup);
  }
  if (props.locals && typeof props.locals !== "object") {
    throw new BadRequestError("props.locals must be an object");
  }
  if (props.locals && Array.isArray(props.locals)) {
    throw new BadRequestError("props.locals must be an object");
  }
  if (props.locals === null) {
    throw new BadRequestError("props.locals must be an object");
  }

  const jaypieFunction = jaypieHandler(handler, props);
  return async (req = {}, res = {}, ...extra: unknown[]) => {
    const status = HTTP.CODE.OK;
    let response;
    let supertestMode = false;

    if (
      res &&
      typeof res === "object" &&
      "socket" in res &&
      res.constructor.name === "ServerResponse"
    ) {
      // Use the response object in supertest mode
      supertestMode = true;
    }

    try {
      response = await jaypieFunction(req, res, ...extra);
    } catch (error: any) {
      // In the mock context, if status is a function we are in a "supertest"
      if (supertestMode && typeof res.status === "function") {
        // In theory jaypieFunction has handled all errors
        const errorStatus = error?.status || HTTP.CODE.INTERNAL_ERROR;
        let errorResponse;
        if (typeof error?.json === "function") {
          errorResponse = error.json();
        } else {
          // This should never happen
          errorResponse = new UnhandledError().json();
        }
        res.status(errorStatus).json(errorResponse);
        return;
      } else {
        // else, res.status is not a function, throw the error
        throw error;
      }
    }

    if (supertestMode && typeof res.status === "function") {
      if (response) {
        if (typeof response === "object") {
          if (typeof (response as WithJsonFunction).json === "function") {
            res.json((response as WithJsonFunction).json());
          } else {
            res.status(status).json(response);
          }
        } else if (typeof response === "string") {
          try {
            res.status(status).json(JSON.parse(response));
          } catch {
            res.status(status).send(response);
          }
        } else if (response === true) {
          res.status(HTTP.CODE.CREATED).send();
        } else {
          res.status(status).send(response);
        }
      } else {
        res.status(HTTP.CODE.NO_CONTENT).send();
      }
    } else {
      return response;
    }
  };
});
