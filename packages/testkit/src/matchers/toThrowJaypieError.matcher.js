import {
  BadGatewayError,
  BadRequestError,
  ConfigurationError,
  ForbiddenError,
  GatewayTimeoutError,
  InternalError,
  isJaypieError,
  NotFoundError,
  UnauthorizedError,
  UnavailableError,
} from "@jaypie/core";

//
//
// Main
//

const toThrowJaypieError = async (received, expected) => {
  const isAsync =
    received.constructor.name === "AsyncFunction" ||
    received.constructor.name === "Promise";

  // If expected is a function, call it
  if (typeof expected === "function") {
    expected = expected();
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
      if (isJaypieError(expected)) {
        // If the error does not match, fail the test
        if (error._type !== expected._type) {
          return {
            pass: false,
            message: () =>
              `Expected function to throw "${expected._type}", but it threw "${error._type}"`,
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

const toThrowBadGatewayError = (received) =>
  toThrowJaypieError(received, BadGatewayError);
const toThrowBadRequestError = (received) =>
  toThrowJaypieError(received, BadRequestError);
const toThrowConfigurationError = (received) =>
  toThrowJaypieError(received, ConfigurationError);
const toThrowForbiddenError = (received) =>
  toThrowJaypieError(received, ForbiddenError);
const toThrowGatewayTimeoutError = (received) =>
  toThrowJaypieError(received, GatewayTimeoutError);
const toThrowInternalError = (received) =>
  toThrowJaypieError(received, InternalError);
const toThrowNotFoundError = (received) =>
  toThrowJaypieError(received, NotFoundError);
const toThrowUnauthorizedError = (received) =>
  toThrowJaypieError(received, UnauthorizedError);
const toThrowUnavailableError = (received) =>
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
