import {
  BadGatewayError,
  BadRequestError,
  ConfigurationError,
  ForbiddenError,
  GatewayTimeoutError,
  InternalError,
  isJaypieError,
  NotFoundError,
  ProjectError,
  UnauthorizedError,
  UnavailableError,
} from "@jaypie/core";
import { MatcherResult } from "../types/jaypie-testkit";

//
//
// Main
//

type ReceivedFunction = () => unknown | Promise<unknown>;
type ErrorConstructor = new () => ProjectError;

function isErrorConstructor(value: unknown): value is ErrorConstructor {
  return typeof value === "function" && "prototype" in value;
}

const toThrowJaypieError = async (
  received: ReceivedFunction,
  expected?: ProjectError | (() => ProjectError) | ErrorConstructor,
): Promise<MatcherResult> => {
  const isAsync =
    received.constructor.name === "AsyncFunction" ||
    received.constructor.name === "Promise";

  let expectedError: ProjectError | undefined = undefined;

  // Handle constructor, function, or instance
  if (typeof expected === "function") {
    if (isErrorConstructor(expected)) {
      // It's a constructor
      expectedError = new expected();
    } else {
      // It's a regular function
      expectedError = expected();
    }
  } else if (expected) {
    // It's an instance
    expectedError = expected;
  }

  try {
    const result = received();

    if (isAsync) {
      await result;
    }

    // If no error is thrown, fail the test
    return {
      pass: false,
      message: () =>
        "Expected function to throw a JaypieError, but it did not throw.",
    };
  } catch (error) {
    if (isJaypieError(error)) {
      // If expected is also a JaypieError, check if the error matches
      if (expectedError && isJaypieError(expectedError)) {
        // If the error does not match, fail the test
        if (error._type !== expectedError._type) {
          return {
            pass: false,
            message: () =>
              `Expected function to throw "${expectedError._type}", but it threw "${error._type}"`,
          };
        }
      }
      return {
        pass: true,
        message: () =>
          `Expected function not to throw a JaypieError, but it threw ${error}`,
      };
    }

    return {
      pass: false,
      message: () =>
        `Expected function to throw a JaypieError, but it threw ${error}`,
    };
  }
};

//
//
// Convenience Methods
//

const toThrowBadGatewayError = (received: ReceivedFunction) =>
  toThrowJaypieError(received, BadGatewayError);
const toThrowBadRequestError = (received: ReceivedFunction) =>
  toThrowJaypieError(received, BadRequestError);
const toThrowConfigurationError = (received: ReceivedFunction) =>
  toThrowJaypieError(received, ConfigurationError);
const toThrowForbiddenError = (received: ReceivedFunction) =>
  toThrowJaypieError(received, ForbiddenError);
const toThrowGatewayTimeoutError = (received: ReceivedFunction) =>
  toThrowJaypieError(received, GatewayTimeoutError);
const toThrowInternalError = (received: ReceivedFunction) =>
  toThrowJaypieError(received, InternalError);
const toThrowNotFoundError = (received: ReceivedFunction) =>
  toThrowJaypieError(received, NotFoundError);
const toThrowUnauthorizedError = (received: ReceivedFunction) =>
  toThrowJaypieError(received, UnauthorizedError);
const toThrowUnavailableError = (received: ReceivedFunction) =>
  toThrowJaypieError(received, UnavailableError);

//
//
// Export
//

export default toThrowJaypieError;

export {
  toThrowBadGatewayError,
  toThrowBadRequestError,
  toThrowConfigurationError,
  toThrowForbiddenError,
  toThrowGatewayTimeoutError,
  toThrowInternalError,
  toThrowNotFoundError,
  toThrowUnauthorizedError,
  toThrowUnavailableError,
}; 