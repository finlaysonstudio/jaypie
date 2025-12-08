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

// Define a more specific type for ProjectError with _type field
type ProjectErrorInstance = InstanceType<typeof ProjectError>;
type JaypieErrorWithType = ProjectErrorInstance & { _type: string };

//
//
// Main
//

type ReceivedFunction = () => unknown | Promise<unknown>;
type ErrorConstructor = new () => ProjectErrorInstance;

function isErrorConstructor(value: unknown): value is ErrorConstructor {
  return typeof value === "function" && "prototype" in value;
}

const toThrowJaypieError = async (
  received: ReceivedFunction,
  expected?:
    | ProjectErrorInstance
    | (() => ProjectErrorInstance)
    | ErrorConstructor,
): Promise<MatcherResult> => {
  const isAsync =
    received.constructor.name === "AsyncFunction" ||
    received.constructor.name === "Promise";

  let expectedError: ProjectErrorInstance | undefined = undefined;

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
      // Cast to the specific type with _type property
      const jaypieError = error as JaypieErrorWithType;

      // If expected is also a JaypieError, check if the error matches
      if (expectedError && isJaypieError(expectedError)) {
        const expectedJaypieError = expectedError as JaypieErrorWithType;
        // If the error does not match, fail the test
        if (jaypieError._type !== expectedJaypieError._type) {
          return {
            pass: false,
            message: () =>
              `Expected function to throw "${expectedJaypieError._type}", but it threw "${jaypieError._type}"`,
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
