/// <reference types="vitest" />
/// <reference types="jest-extended" />

import { JsonApiError } from "./jaypie-testkit.js";

// Make sure this is exported so it can be used by consumers
export interface CustomMatchers<R = unknown> {
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

declare global {
  namespace Vi {
    interface Assertion<T = unknown> extends CustomMatchers<T> {
      not: Assertion<T>;
    }
    interface AsymmetricMatchersContaining extends CustomMatchers {
      not: AsymmetricMatchersContaining;
    }
  }
}

// This is needed for module augmentation to work properly
declare module "vitest" {
  interface Assertion<T = unknown> extends CustomMatchers<T> {
    not: Assertion<T>;
  }
  interface AsymmetricMatchersContaining extends CustomMatchers {
    not: AsymmetricMatchersContaining;
  }
}

// Export an empty object to make TypeScript treat this as a module
export {};
