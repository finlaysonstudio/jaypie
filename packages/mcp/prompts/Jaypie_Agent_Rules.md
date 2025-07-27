---
trigger: always_on
description: Baseline rules in Jaypie repositories. Required reading.
---

# Jaypie's Agent Rules

This repository uses Jaypie, an opinionated event-driven fullstack library.

## Errors

Jaypie providers errors that will be handled properly when thrown (e.g., presenting the correct status code).

`import { BadGatewayError, BadRequestError, ConfigurationError, ForbiddenError, GatewayTimeoutError, GoneError, IllogicalError, InternalError, MethodNotAllowedError, NotFoundError, NotImplementedError, RejectedError, TeapotError, UnauthorizedError, UnavailableError, UnhandledError, UnreachableCodeError } from "jaypie";`

ConfigurationError is a special InternalError 500 that is also thrown when types are incorrect.

Though supported, rely on default error messages when throwing.
Custom error messages should be logged not thrown

<Bad>
throw new NotFoundError("Item not found");
</Bad>
<Good>
log.error("Item not found");
throw new NotFoundError();
</Good>

Error messages may be returned to the user especially in express.

## Logging

`import { log } from "jaypie";`
`log` has methods `trace`, `debug`, `info`, `warn`, `error`, `fatal`, and `var`.
Only `trace` and `var` should be used in "happy paths".
`debug` should be used when execution deviates from the happy path.
`info` should rarely be used.
`var` expects a _single_ key-value pair like `log.var({ key: "value" });`.
Do _not_ pass multiple keys to `var`.

## Testing

`@jaypie/testkit` is a testing library used with vitest providing custom matchers and mocks for the main Jaypie library.
Always use the testkit to mock Jaypie.
Always create a manual mock for a models package.
Always mock network calls and external commands.
Jaypie relies heavily on mocking to confirm expected behavior and prevent behavior drift.

See [Jaypie_Mocks_and_Testkit.md](./Jaypie_Mocks_and_Testkit.md) for more context.

### Configuration

Mocks and matchers are usually configured at the subpackage-level in `testSetup.js` (legacy path) or `vitest.setup.[js|ts]` (modern path).
The subpackage `[vite|vitest].config[js|ts]` will reference the setup file.
All jaypie functions are mocked with `vi.mock("jaypie", async () => vi.importActual("@jaypie/testkit/mock"));`

vitest.setup.ts
```typescript
import { matchers as jaypieMatchers } from "@jaypie/testkit";
import * as extendedMatchers from "jest-extended";
import { expect , vi} from "vitest";

expect.extend(extendedMatchers);
expect.extend(jaypieMatchers);

vi.mock("jaypie", async () => vi.importActual("@jaypie/testkit/mock"));
```

### Errors

Use matchers to test errors.
`expect(fn).toThrowBadGatewayError();`
`await expect(async() => fn()).toThrowBadGatewayError();`
Do not use `.rejects`

### Matchers

toBeCalledAboveTrace, toBeCalledWithInitialParams, toBeClass, toBeJaypieError, toMatchBase64, toMatchJwt, toMatchMongoId, toMatchSchema, toMatchSignedCookie, toMatchUuid4, toMatchUuid5, toMatchUuid, toThrowBadGatewayError, toThrowBadRequestError, toThrowConfigurationError, toThrowForbiddenError, toThrowGatewayTimeoutError, toThrowInternalError, toThrowJaypieError, toThrowNotFoundError, toThrowUnauthorizedError, toThrowUnavailableError,

### Order of Tests

Tests are named `./__tests__/<subject>.spec.<js|ts>`.
Each file should have one top-level `describe` block.
Organize tests in one of seven second-level describe block sections in this order:

1. Base Cases - it is the type we expect ("It is a Function"). For functions, the simplest possible call works and returns not undefined ("It Works"). For objects, the expected shape.
2. Error Conditions - any error handling the code performs
3. Security - any security checks the code performs
4. Observability - any logging the code performs
5. Happy Paths - The most common use case
6. Features - Features in addition to the happy path
7. Specific Scenarios - Special cases
Omit describe blocks for sections that are not applicable or empty.
Whenever possible, especially when refactoring, write the test first so the user can confirm the expected behavior passes/fails.

### Test Coverage

Aim for complete coverage of all happy paths, features, and error conditions.
Whenever possible, confirm mocked functions are called.
Confirm calls to log above debug in Observability. Do not confirm calls to debug, var, or trace.

## Linting

Use double quotes, trailing commas, and semicolons.
Do not delete `// eslint-disable-next-line no-shadow` comments; add when shadowing variables, especially `error` in catch blocks.

### Beyond Lint

Whenever a hard-coded value like `site: "datadoghq.com"` is used, define a constant at the top of the file, `const DATADOG_SITE = "datadoghq.com"`, and reference that throughout.
Alphabetize as much as possible.
