/// <reference types="vitest" />

import { JsonApiError } from "../types.js";

interface CustomMatchers<R = unknown> {
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
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
} 