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
import { log } from "@jaypie/logger";
import * as errors from "@jaypie/errors";
import * as kit from "@jaypie/kit";

// Constants for mock values
const TAG = "CORE";

// JaypieError is the base class - export it directly from errors
export const JaypieError = errors.JaypieError;

export const BadGatewayError: typeof errors.BadGatewayError = createMockError(
  errors.BadGatewayError,
);
export const BadRequestError: typeof errors.BadRequestError = createMockError(
  errors.BadRequestError,
);
export const ConfigurationError: typeof errors.ConfigurationError =
  createMockError(errors.ConfigurationError);
export const CorsError: typeof errors.CorsError = createMockError(
  errors.CorsError,
);
export const ForbiddenError: typeof errors.ForbiddenError = createMockError(
  errors.ForbiddenError,
);
export const GatewayTimeoutError: typeof errors.GatewayTimeoutError =
  createMockError(errors.GatewayTimeoutError);
export const GoneError: typeof errors.GoneError = createMockError(
  errors.GoneError,
);
export const IllogicalError: typeof errors.IllogicalError = createMockError(
  errors.IllogicalError,
);
export const InternalError: typeof errors.InternalError = createMockError(
  errors.InternalError,
);
export const MethodNotAllowedError: typeof errors.MethodNotAllowedError =
  createMockError(errors.MethodNotAllowedError);
// Backwards compatibility aliases
export const MultiError: typeof errors.InternalError = createMockError(
  errors.InternalError,
);
export const NotFoundError: typeof errors.NotFoundError = createMockError(
  errors.NotFoundError,
);
export const NotImplementedError: typeof errors.NotImplementedError =
  createMockError(errors.NotImplementedError);
export const ProjectError: typeof errors.InternalError = createMockError(
  errors.InternalError,
);
export const ProjectMultiError: typeof errors.InternalError = createMockError(
  errors.InternalError,
);
export const RejectedError: typeof errors.RejectedError = createMockError(
  errors.RejectedError,
);
export const TeapotError: typeof errors.TeapotError = createMockError(
  errors.TeapotError,
);
export const TooManyRequestsError: typeof errors.TooManyRequestsError =
  createMockError(errors.TooManyRequestsError);
export const UnauthorizedError: typeof errors.UnauthorizedError =
  createMockError(errors.UnauthorizedError);
export const UnavailableError: typeof errors.UnavailableError = createMockError(
  errors.UnavailableError,
);
export const UnhandledError: typeof errors.UnhandledError = createMockError(
  errors.UnhandledError,
);
export const UnreachableCodeError: typeof errors.UnreachableCodeError =
  createMockError(errors.UnreachableCodeError);

beforeAll(async () => {
  spyLog(log);
});
export { log };

// Add missing core functions
export const cloneDeep = createMockWrappedFunction(kit.cloneDeep, {
  throws: true,
});

export const envBoolean = createMockReturnedFunction(true);

export const envsKey = createMockWrappedFunction(
  kit.envsKey as (...args: unknown[]) => unknown,
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
  kit.formatError as (...args: unknown[]) => unknown,
  `_MOCK_FORMAT_ERROR_[${TAG}]`,
);

// Alias for errorFromStatusCode (exported from @jaypie/errors as jaypieErrorFromStatus)
export const jaypieErrorFromStatus = errorFromStatusCode;

export const getHeaderFrom = createMockWrappedFunction(
  kit.getHeaderFrom as (...args: unknown[]) => unknown,
  `_MOCK_GET_HEADER_FROM_[${TAG}]`,
);

export const getObjectKeyCaseInsensitive = createMockWrappedFunction(
  kit.getObjectKeyCaseInsensitive as (...args: unknown[]) => unknown,
  `_MOCK_GET_OBJECT_KEY_CASE_INSENSITIVE_[${TAG}]`,
);

export const isClass = createMockWrappedFunction(
  kit.isClass,
  `_MOCK_IS_CLASS_[${TAG}]`,
);

export const isJaypieError = createMockWrappedFunction(
  errors.isJaypieError,
  false,
);

export const resolveValue = createMockWrappedFunction(
  kit.resolveValue,
  `_MOCK_RESOLVE_VALUE_[${TAG}]`,
);

export const safeParseFloat = createMockWrappedFunction(
  kit.safeParseFloat as (...args: unknown[]) => unknown,
  `_MOCK_SAFE_PARSE_FLOAT_[${TAG}]`,
);

export const placeholders = createMockWrappedFunction(
  kit.placeholders as (...args: unknown[]) => unknown,
  `_MOCK_PLACEHOLDERS_[${TAG}]`,
);

// Add force utilities to help with jaypieHandler implementation
export const force = createMockWrappedObject(kit.force);

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
      unavailable = kit.force.boolean(process.env.PROJECT_UNAVAILABLE),
      validate = [],
    } = options;

    // Check if service is unavailable
    if (unavailable) throw new UnavailableError("Service unavailable");

    // Run validation functions
    const validateFunctions = kit.force.array(validate);
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
      const setupFunctions = kit.force.array(setup);
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
    const teardownFunctions = kit.force.array(teardown);
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
  () => "00000000-0000-0000-0000-000000000000",
  `00000000-0000-0000-0000-000000000000`,
);

export const HTTP = kit.HTTP;
export const JAYPIE = kit.JAYPIE;
export const PROJECT = kit.PROJECT;
