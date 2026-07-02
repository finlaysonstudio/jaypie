import "vitest";

declare module "vitest" {
  interface Assertion<T = unknown> {
    toBeArray(): T;
    toBeArrayOfSize(size: number): T;
    toBeBoolean(): T;
    toBeCalledAboveTrace(): T;
    toBeCalledWithInitialParams(params: unknown): T;
    toBeClass(): T;
    toBeEmpty(): T;
    toBeFalse(): T;
    toBeFunction(): T;
    toBeJaypieError(): T;
    toBeNumber(): T;
    toBeObject(): T;
    toBeString(): T;
    toBeTrue(): T;
    toContainAllKeys(keys: string[]): T;
    toContainKeys(keys: string[]): T;
    toEndWith(suffix: string): T;
    toInclude(substring: unknown): T;
    toStartWith(prefix: string): T;
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
