/// <reference types="vitest" />
/// <reference types="jest-extended" />

import { JsonApiError } from "./jaypie-testkit.js";

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
  toBeArray(): R;
  toBeBoolean(): R;
  toBeFalse(): R;
  toBeFunction(): R;
  toBeNumber(): R;
  toBeObject(): R;
  toBeString(): R;
  toBeTrue(): R;
  toThrowJaypieError(): R;
}

declare module "vitest" {
  interface Assertion<T = unknown> extends CustomMatchers<T> {
    not: Assertion<T>;
  }
  interface AsymmetricMatchersContaining extends CustomMatchers {
    not: AsymmetricMatchersContaining;
  }
}
