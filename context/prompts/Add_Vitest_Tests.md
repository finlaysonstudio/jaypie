# Add Tests

Adds unit tests for a JavaScript or TypeScript file.

## Requirements

- Use **Vitest** for all test files.
- Create a new test file in a sibling `__tests__` directory (e.g. `../__tests__/myFunction.test.js`).
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
