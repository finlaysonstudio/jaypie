// Import and re-export all matcher types
/// <reference types="jest-extended" />

import { JsonApiError } from "./jaypie-testkit.js";
import "jest-extended";

// Make sure this is exported so it can be used by consumers
export interface CustomMatchers<R = unknown> {
  // Custom Jaypie matchers
  toBeCalledAboveTrace(): R;
  toBeCalledWithInitialParams(...params: unknown[]): R;
  toBeClass(): R;
  toBeJaypieError(): R;
  toMatchBase64(): R;
  toMatchJwt(): R;
  toMatchMongoId(): R;
  toMatchSignedCookie(): R;
  toMatchUuid(): R;
  toMatchUuid4(): R;
  toMatchUuid5(): R;
  toThrowBadGatewayError(): R;
  toThrowBadRequestError(): R;
  toThrowConfigurationError(): R;
  toThrowForbiddenError(): R;
  toThrowGatewayTimeoutError(): R;
  toThrowInternalError(): R;
  toThrowJaypieError(expected?: JsonApiError): R;
  toThrowNotFoundError(): R;
  toThrowUnauthorizedError(): R;
  toThrowUnavailableError(): R;

  // Include jest-extended matchers
  // These are already included via jest-extended reference
}

// Export combined interface that includes both custom matchers and jest-extended matchers
export interface JaypieMatchers<R = unknown> extends CustomMatchers<R> {}
