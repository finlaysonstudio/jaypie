/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import {
  createMockError,
  createMockFunction,
  createMockResolvedFunction,
  createMockReturnedFunction,
  createMockWrappedFunction,
  createMockWrappedObject,
} from "./utils";
import { beforeAll } from "vitest";
import { spyLog } from "../mockLog.module.js";
import { log } from "@jaypie/core";
import * as original from "@jaypie/core";

// Constants for mock values
const TAG = "CORE";

export const BadGatewayError: typeof original.BadGatewayError = createMockError(
  original.BadGatewayError,
);
export const BadRequestError: typeof original.BadRequestError = createMockError(
  original.BadRequestError,
);
export const ConfigurationError: typeof original.ConfigurationError =
  createMockError(original.ConfigurationError);
export const CorsError: typeof original.CorsError = createMockError(
  original.CorsError,
);
export const ForbiddenError: typeof original.ForbiddenError = createMockError(
  original.ForbiddenError,
);
export const GatewayTimeoutError: typeof original.GatewayTimeoutError =
  createMockError(original.GatewayTimeoutError);
export const GoneError: typeof original.GoneError = createMockError(
  original.GoneError,
);
export const IllogicalError: typeof original.IllogicalError = createMockError(
  original.IllogicalError,
);
export const InternalError: typeof original.InternalError = createMockError(
  original.InternalError,
);
export const MethodNotAllowedError: typeof original.MethodNotAllowedError =
  createMockError(original.MethodNotAllowedError);
export const MultiError: typeof original.MultiError = createMockError(
  original.MultiError,
);
export const NotFoundError: typeof original.NotFoundError = createMockError(
  original.NotFoundError,
);
export const NotImplementedError: typeof original.NotImplementedError =
  createMockError(original.NotImplementedError);
export const ProjectError: typeof original.ProjectError = createMockError(
  original.ProjectError,
);
export const ProjectMultiError: typeof original.ProjectMultiError =
  createMockError(original.ProjectMultiError);
export const RejectedError: typeof original.RejectedError = createMockError(
  original.RejectedError,
);
export const TeapotError: typeof original.TeapotError = createMockError(
  original.TeapotError,
);
export const TooManyRequestsError: typeof original.TooManyRequestsError =
  createMockError(original.TooManyRequestsError);
export const UnauthorizedError: typeof original.UnauthorizedError =
  createMockError(original.UnauthorizedError);
export const UnavailableError: typeof original.UnavailableError =
  createMockError(original.UnavailableError);
export const UnhandledError: typeof original.UnhandledError = createMockError(
  original.UnhandledError,
);
export const UnreachableCodeError: typeof original.UnreachableCodeError =
  createMockError(original.UnreachableCodeError);

// Mock core functions
export const validate: typeof original.validate = createMockWrappedObject(
  original.validate,
  {
    fallback: false,
    throws: true,
  },
);

beforeAll(async () => {
  spyLog(log);
});
export { log };

// Add missing core functions
export const cloneDeep = createMockWrappedFunction(original.cloneDeep, {
  throws: true,
});

export const envBoolean = createMockReturnedFunction(true);

export const envsKey = createMockWrappedFunction(
  original.envsKey as (...args: unknown[]) => unknown,
  `_MOCK_ENVS_KEY_[${TAG}]`,
);

export const errorFromStatusCode = createMockFunction<
  (statusCode: number, message?: string) => Error
>((statusCode, message = `Mock error for status code ${statusCode}`) => {
  try {
    // Try to mimic original implementation
    switch (statusCode) {
      case 400:
        return new BadRequestError(message);
      case 401:
        return new UnauthorizedError(message);
      case 403:
        return new ForbiddenError(message);
      case 404:
        return new NotFoundError(message);
      case 405:
        return new MethodNotAllowedError(message);
      case 410:
        return new GoneError(message);
      case 418:
        return new TeapotError(message);
      case 500:
        return new InternalError(message);
      case 501:
        return new NotImplementedError(message);
      case 502:
        return new BadGatewayError(message);
      case 503:
        return new UnavailableError(message);
      case 504:
        return new GatewayTimeoutError(message);
      default:
        return new Error(message);
    }
  } catch (error) {
    return new Error(`_MOCK_ERROR_FROM_STATUS_CODE_[${TAG}][${statusCode}]`);
  }
});

export const formatError = createMockWrappedFunction(
  original.formatError as (...args: unknown[]) => unknown,
  `_MOCK_FORMAT_ERROR_[${TAG}]`,
);

// Alias for errorFromStatusCode (exported from @jaypie/errors as jaypieErrorFromStatus)
export const jaypieErrorFromStatus = errorFromStatusCode;

export const getHeaderFrom = createMockWrappedFunction(
  original.getHeaderFrom as (...args: unknown[]) => unknown,
  `_MOCK_GET_HEADER_FROM_[${TAG}]`,
);

export const getObjectKeyCaseInsensitive = createMockWrappedFunction(
  original.getObjectKeyCaseInsensitive as (...args: unknown[]) => unknown,
  `_MOCK_GET_OBJECT_KEY_CASE_INSENSITIVE_[${TAG}]`,
);

export const isClass = createMockWrappedFunction(
  original.isClass,
  `_MOCK_IS_CLASS_[${TAG}]`,
);

export const isJaypieError = createMockWrappedFunction(
  original.isJaypieError,
  false,
);

// Optional/Required validation functions
export const optional: typeof original.optional = createMockWrappedObject(
  original.optional,
  {
    fallback: true,
    throws: true,
  },
);

export const required: typeof original.required = createMockWrappedObject(
  original.required,
  {
    fallback: true,
    throws: true,
  },
);

export const resolveValue = createMockWrappedFunction(
  original.resolveValue,
  `_MOCK_RESOLVE_VALUE_[${TAG}]`,
);

export const safeParseFloat = createMockWrappedFunction(
  original.safeParseFloat as (...args: unknown[]) => unknown,
  `_MOCK_SAFE_PARSE_FLOAT_[${TAG}]`,
);

export const placeholders = createMockWrappedFunction(
  original.placeholders as (...args: unknown[]) => unknown,
  `_MOCK_PLACEHOLDERS_[${TAG}]`,
);

// Add force utilities to help with jaypieHandler implementation
export const force = createMockWrappedObject(original.force);

export const jaypieHandler = createMockFunction<
  (
    handler: Function,
    options?: {
      setup?: Function | Function[];
      teardown?: Function | Function[];
      unavailable?: boolean;
      validate?: Function | Function[];
    },
  ) => Function
>((handler, options = {}) => {
  return async (...args: any[]) => {
    let result;
    let thrownError;

    // Destructure options with defaults
    const {
      setup = [],
      teardown = [],
      unavailable = original.force.boolean(process.env.PROJECT_UNAVAILABLE),
      validate = [],
    } = options;

    // Check if service is unavailable
    if (unavailable) throw new UnavailableError("Service unavailable");

    // Run validation functions
    const validateFunctions = original.force.array(validate);
    for (const validator of validateFunctions) {
      if (typeof validator === "function") {
        const valid = await validator(...args);
        if (valid === false) {
          throw new BadRequestError("Validation failed");
        }
      }
    }

    try {
      // Run setup functions
      const setupFunctions = original.force.array(setup);
      for (const setupFunction of setupFunctions) {
        if (typeof setupFunction === "function") {
          await setupFunction(...args);
        }
      }

      // Execute the handler
      result = await handler(...args);
    } catch (error) {
      thrownError = error;
    }

    // Run teardown functions (always run even if there was an error)
    const teardownFunctions = original.force.array(teardown);
    for (const teardownFunction of teardownFunctions) {
      if (typeof teardownFunction === "function") {
        try {
          await teardownFunction(...args);
        } catch (error) {
          // Swallow teardown errors, but log them
          console.error(error);
        }
      }
    }

    // If there was an error in the handler, throw it after teardown
    if (thrownError) {
      throw thrownError;
    }

    return result;
  };
});

export const sleep = createMockResolvedFunction(true);

export const uuid = createMockWrappedFunction(
  original.uuid as (...args: unknown[]) => unknown,
  `00000000-0000-0000-0000-000000000000`,
);

export const ERROR = original.ERROR;
export const HTTP = original.HTTP;
export const JAYPIE = original.JAYPIE;
export const PROJECT = original.PROJECT;
export const VALIDATE = original.VALIDATE;
