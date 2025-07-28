---
description: Jaypie projects rely heavily on mocking the entire jaypie package, often in setup files, as well as manual mocks. Recommended when creating new tests or addressing failures.
---

# Jaypie Mocks and Testkit

Adds unit tests for a JavaScript or TypeScript file.

## Requirements

- Use **Vitest** for all test files.
- Create a new test file as a sibling to the implementation, not a separate directory or tree
- Use **ECMAScript module syntax** (`import/export`), not CommonJS.
- Import the function under test using a relative path and include the `.js` extension.
- Use `describe` blocks for each function and `it` blocks for each behavior.
- Include tests for:
  - Normal/expected input
  - Edge cases
  - Error handling (if applicable)
- Ensure all tests are deterministic and do not rely on randomness or network calls unless mocked.

## File Style Rules

- Use double quotes.
- Use ES6+ syntax.
- Do not modify the original file.
- Do not include any setup or installation instructions.

## Jaypie Testkit
`@jaypie/testkit` is the testing library.
`matchers` are exported and extend expect in the test setup.
All jaypie functions can be mocked with `vi.mock("jaypie", async () => vi.importActual("@jaypie/testkit/mock"));`
### Classes
Mocked jaypie classes should mocked members for each mocked implementation.
```
Llm.operate.mockResolvedValue("Bueno");
const llm = new Llm();
const response = llm.operate();
expect(response).toBeString("Bueno");
expect(Llm.operate).toHaveBeenCalled()
```
### Errors
Use matchers to test errors.
`expect(fn).toThrowBadGatewayError();`
`await expect(async() => fn()).toThrowBadGatewayError();`
Do not use `.rejects`
### Express
Most express functions are wrapped in `expressHandler` which is mocked.
Test express functions directly with a `req` object.
Handle cases where the `req` object is undefined or incomplete.
supertest is also available to test http responses.
### Logging
`log` is mocked by `@jaypie/testkit/mock` or separately using `spyLog` and `restoreLog` in `@jaypie/testkit`.
Use matchers on `log` functions and `toBeCalledAboveTrace` on `log` itself.
`expect(log).not.toBeCalledAboveTrace();`
`expect(log.warn).toBeCalled();`
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

## Configuration

### Typical Package

`package.json`
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest watch",
}
```

`vitest.config.ts`
```typescript
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

`vitest.setup.ts`
```typescript
// This file left intentionally blank
```

* `vitest.setup.ts` can be used to extend the jest matchers, for example, or setting up other mocks
```typescript
import * as extendedMatchers from "jest-extended";
import { expect } from "vitest";

expect.extend(extendedMatchers);
```
* Before creating a `vitest.setup.ts`, check if `testSetup.js` exists.

## NPM Workspaces (monorepos)

* Configure sub-packages following the above
* Usually only sub-packages have `vitest.config.ts` and `vitest.setup.ts`
* Configure the root package as follows, iterating for each `<package>` below

`package.json`
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest watch",
  "test:<package>": "npm run test --workspace packages/<package>"
  "test:<package>:watch": "npm run test:watch --workspace packages/<package>"
}
```

`vitest.workspace.ts`
```typescript
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/<package>",
]);
```