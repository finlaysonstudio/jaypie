Whenever I import @jaypie/testkit into new TypeScript projects and use the matchers I get warnings for my matchers like `toThrowBadRequestError` and `toBeCalledAboveTrace`. I also get warnings for `jest-extended` matchers like `toBeFunction` and `toBeObject`.

Usually I fix this by adding a types file like this

```typescript
/// <reference types="vitest" />
/// <reference types="jest-extended" />

export interface JsonApiError {
  errors: Array<{
    status: number;
    title: string;
    detail?: string;
  }>;
}

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
```

I don't want to do that, I want the matchers to just work.

This is how my vitest setup file usually looks:

```typescript
import { matchers as jaypieMatchers } from "@jaypie/testkit";
import * as extendedMatchers from "jest-extended";
import { expect } from "vitest";

expect.extend(extendedMatchers);
expect.extend(jaypieMatchers);
```
