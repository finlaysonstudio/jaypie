/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createMockFunction,
  createMockReturnedFunction,
  createMockResolvedFunction,
  createMockWrappedFunction,
} from "./utils";
import { BadRequestError } from "@jaypie/core";
import * as core from "./core"; // TODO: Remove this, use real things?
import * as original from "@jaypie/express";

// Constants for mock values
const TAG = "EXPRESS";
const HTTP = {
  CODE: { OK: 200, CREATED: 201, NO_CONTENT: 204, INTERNAL_ERROR: 500 },
};

// Add Express route functions
export const badRequestRoute = createMockWrappedFunction(
  original.badRequestRoute,
  { error: `_MOCK_BAD_REQUEST_ROUTE_[${TAG}]` },
);

export const echoRoute = createMockWrappedFunction(
  original.echoRoute,
  (req) => req,
);

export const forbiddenRoute = createMockWrappedFunction(
  original.forbiddenRoute,
  { error: `_MOCK_FORBIDDEN_ROUTE_[${TAG}]` },
);

export const goneRoute = createMockWrappedFunction(original.goneRoute, {
  error: `_MOCK_GONE_ROUTE_[${TAG}]`,
});

export const methodNotAllowedRoute = createMockWrappedFunction(
  original.methodNotAllowedRoute,
  { error: `_MOCK_METHOD_NOT_ALLOWED_ROUTE_[${TAG}]` },
);

export const methodNotAllowedRoute = createMockWrappedFunction(
  original.methodNotAllowedRoute,
  { error: `_MOCK_METHOD_NOT_ALLOWED_ROUTE_[${TAG}]` },
);

export const noContentRoute = createMockWrappedFunction(
  original.noContentRoute,
  { status: 204 },
);

export const notFoundRoute = createMockWrappedFunction(original.notFoundRoute, {
  error: `_MOCK_NOT_FOUND_ROUTE_[${TAG}]`,
});

export const notImplementedRoute = createMockWrappedFunction(
  original.notImplementedRoute,
  { error: `_MOCK_NOT_IMPLEMENTED_ROUTE_[${TAG}]` },
);

export const expressHttpCodeHandler = createMockWrappedFunction(
  original.expressHttpCodeHandler,
  (...args) => {
    const [req, res, next] = args;
    return res.status(200).send();
  },
);

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

export const expressHandler = createMockFunction<
  (
    handlerOrProps: ExpressHandlerParameter,
    propsOrHandler?: ExpressHandlerParameter,
  ) => (req: any, res: any, ...extra: any[]) => Promise<any>
>((handlerOrProps, propsOrHandler) => {
  let handler: ExpressHandlerFunction;
  let props: ExpressHandlerOptions = {};

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
    throw new core.BadRequestError("handler must be a function");
  }

  // Add locals setup if needed
  if (
    props.locals &&
    typeof props.locals === "object" &&
    !Array.isArray(props.locals)
  ) {
    const keys = Object.keys(props.locals);
    if (!props.setup) props.setup = [];
    props.setup = Array.isArray(props.setup) ? props.setup : [props.setup];

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

  // Create the jaypieHandler wrapper that mimics the behavior expected
  const jaypieFunction = async (...args: any[]) => {
    const [req = {}, res = {}, ...extra] = args;

    // Handle validation
    if (props.validate) {
      const validateArray = Array.isArray(props.validate)
        ? props.validate
        : [props.validate];

      for (const validator of validateArray) {
        if (typeof validator === "function") {
          const valid = await validator(req, res, ...extra);
          if (valid === false) {
            throw new BadRequestError("Validation failed");
          }
        }
      }
    }

    // Handle setup
    if (props.setup) {
      const setupArray = Array.isArray(props.setup)
        ? props.setup
        : [props.setup];

      for (const setupFn of setupArray) {
        if (typeof setupFn === "function") {
          await setupFn(req, res, ...extra);
        }
      }
    }

    // Execute the handler
    let result;
    let thrownError;

    try {
      result = await handler(req, res, ...extra);
    } catch (error) {
      thrownError = error;
    }

    // Handle teardown
    if (props.teardown) {
      const teardownArray = Array.isArray(props.teardown)
        ? props.teardown
        : [props.teardown];

      for (const teardownFn of teardownArray) {
        if (typeof teardownFn === "function") {
          try {
            await teardownFn(req, res, ...extra);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
          }
        }
      }
    }

    if (thrownError) {
      throw thrownError;
    }

    return result;
  };

  return async (req = {}, res = {}, ...extra) => {
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
    } catch (error) {
      // In the mock context, if status is a function we are in a "supertest"
      if (
        supertestMode &&
        typeof (res as { status: Function }).status === "function"
      ) {
        // In theory jaypieFunction has handled all errors
        const errorStatus = (error as any).status || HTTP.CODE.INTERNAL_ERROR;
        let errorResponse;
        if (typeof (error as WithJsonFunction).json === "function") {
          errorResponse = (error as WithJsonFunction).json();
        } else {
          // This should never happen
          const unhandledError = new UnhandledError("Unhandled error");
          errorResponse = {
            error: {
              name: unhandledError.name,
              message: unhandledError.message,
            },
          };
        }
        (res as any).status(errorStatus).json(errorResponse);
        return;
      } else {
        // else, res.status is not a function, throw the error
        throw error;
      }
    }

    if (
      supertestMode &&
      typeof (res as { status: Function }).status === "function"
    ) {
      if (response) {
        if (typeof response === "object") {
          if (typeof (response as WithJsonFunction).json === "function") {
            (res as any).json((response as WithJsonFunction).json());
          } else {
            (res as any).status(status).json(response);
          }
        } else if (typeof response === "string") {
          try {
            (res as any).status(status).json(JSON.parse(response));
          } catch (error) {
            (res as any).status(status).send(response);
          }
        } else if (response === true) {
          (res as any).status(HTTP.CODE.CREATED).send();
        } else {
          (res as any).status(status).send(response);
        }
      } else {
        (res as any).status(HTTP.CODE.NO_CONTENT).send();
      }
    } else {
      return response;
    }
  };
});
