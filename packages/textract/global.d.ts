import "jest-extended";

declare module "vitest" {
  interface Assertion<T = unknown> {
    toBeCalledAboveTrace(): T;
    toBeCalledWithInitialParams(params: unknown): T;
    toBeClass(): T;
    toBeJaypieError(): T;
    toMatchBase64(): T;
    toMatchJwt(): T;
    toMatchMongoId(): T;
    toMatchSignedCookie(): T;
    toMatchSchema(schema: unknown): T;
    toMatchUuid(): T;
    toMatchUuid4(): T;
    toMatchUuid5(): T;
    toThrowBadGatewayError(): T;
    toThrowBadRequestError(): T;
    toThrowConfigurationError(): T;
    toThrowError(message?: string | RegExp): T;
    toThrowForbiddenError(): T;
    toThrowGatewayTimeoutError(): T;
    toThrowInternalError(): T;
    toThrowJaypieError(): T;
    toThrowNotFoundError(): T;
    toThrowUnauthorizedError(): T;
    toThrowUnavailableError(): T;
  }
}
