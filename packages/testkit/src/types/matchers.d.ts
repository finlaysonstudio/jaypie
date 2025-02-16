/// <reference types="vitest" />

import { JsonApiError } from "./jaypie-testkit.js";

declare module "vitest" {
  interface CustomMatchers<R = unknown> {
    toBeCalledAboveTrace(): R;
    toBeCalledWithInitialParams(...params: unknown[]): R;
    toBeClass(): R;
    toBeJaypieError(): R;
    toMatchBase64(): R;
    toMatchJwt(): R;
    toMatchMongoId(): R;
    toMatchSignedCookie(): R;
    toMatchSchema(schema: unknown): R;
    toMatchUuid(): R;
    toMatchUuid4(): R;
    toMatchUuid5(): R;
    toThrowBadGatewayError(): R;
    toThrowBadRequestError(): R;
    toThrowConfigurationError(): R;
    toThrowError(expected?: Error | typeof Error | string): R;
    toThrowForbiddenError(): R;
    toThrowGatewayTimeoutError(): R;
    toThrowInternalError(): R;
    toThrowJaypieError(expected?: JsonApiError): R;
    toThrowNotFoundError(): R;
    toThrowUnauthorizedError(): R;
    toThrowUnavailableError(): R;
  }

  // interface Assertion<T = unknown> extends CustomMatchers<T> {}
  // interface AsymmetricMatchersContaining extends CustomMatchers {}
  type Assertion<T = unknown> = CustomMatchers<T>;
  type AsymmetricMatchersContaining = CustomMatchers;
}

export {};
