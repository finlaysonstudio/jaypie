// Import and re-export all matcher types
import { JsonApiError } from "./jaypie-testkit.js";

// Make sure this is exported so it can be used by consumers
export interface CustomMatchers<R = unknown> {
  // Custom Jaypie matchers
  toBeCalledAboveTrace(): R;
  toBeCalledWithInitialParams(...params: unknown[]): R;
  toBeClass(): R;
  toBeJaypieError(): R;
  toBeMockFunction(): R;
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

  // Absorbed jest-extended matchers
  toBeArray(): R;
  toBeArrayOfSize(size: number): R;
  toBeBoolean(): R;
  toBeEmpty(): R;
  toBeFalse(): R;
  toBeFunction(): R;
  toBeNumber(): R;
  toBeObject(): R;
  toBeString(): R;
  toBeTrue(): R;
  toContainAllKeys(keys: string[]): R;
  toContainKeys(keys: string[]): R;
  toEndWith(suffix: string): R;
  toInclude(substring: unknown): R;
  toStartWith(prefix: string): R;
}

// Export combined interface that includes both custom matchers and jest-extended matchers
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface JaypieMatchers<R = unknown> extends CustomMatchers<R> {}
