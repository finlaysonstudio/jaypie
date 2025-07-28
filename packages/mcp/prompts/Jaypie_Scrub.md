---
description: House style beyond linting to keep the repository clean and organized
---

# Jaypie Scrub File 🧽

Repository style rules beyond linting

## 🚒 Errors

Jaypie offers a number of HTTP and special-use errors not limited to:
`import { BadGatewayError, BadRequestError, ConfigurationError, ForbiddenError, InternalError, NotFoundError, TooManyRequestsError, UnauthorizedError } from "jaypie";`

### Prefer to Throw Jaypie Errors

* BadGatewayError when an external provider errors
* InternalError for default 500 errors
* ConfigurationError is a 500 variant when the problem is traceable to the coding or configuration of the system (incorrect type, incompatible options)

<Bad>
if (!item) {
  log.error("Item not found");
  return {
    statusCode: 404,
    body: JSON.stringify({ error: "Item not found" }),
  };
}
</Bad>
<Good>
log.error("Item not found");
throw new NotFoundError();
</Good>

### Throw Jaypie Errors to Return HTTP Errors in Express

Inside a Jaypie `expressHandler`, thrown Jaypie errors will return the correct status to the client.
Never try to alter `res` or return an error status code.

### Avoid Custom Error Strings

Though supported, rely on default error messages when throwing.
Custom error messages should be logged.

<Bad>
throw new NotFoundError("Item not found");
</Bad>
<Good>
log.error("Item not found");
throw new NotFoundError();
</Good>

## 🧹 Linting

Use double quotes, trailing commas, and semicolons.
Do not delete `// eslint-disable-next-line no-shadow` comments; add when shadowing variables, especially `error` in catch blocks.

## 📢 Logging

### Levels

* Only use `log.trace` in the happy path
* Use `log.debug` when straying from the happy path
* Use `log.warn`, `log.error` as needed
* Avoid the use of `info`

### Logging Variables

* Log variables with `log.var({ item })`
* Only use single-key objects
* The key can be changed for clarity
* When logging large arrays, objects, and strings, consider logging abridged/truncated value or summary heuristics like length

### Do Not Mix Strings and Objects

<Bad>
log.trace("Looking up item", { item: item.id });
</Bad>
<Good>
log.trace(`Looking up item ${item.id}`);
# OR
log.trace(`Looking up item`);
log.var({ item: item.id });
</Good>

### Separate Variables

Do not combine into a single call:

<Bad>
log.debug({ userId: String(user.id), groupId: String(user.group) });
</Bad>
<Good>
log.var({ userId: user.id });
log.var({ groupId: user.group }); // Jaypie will coerce strings
</Good>

### Logging in Catch Statements

* Log the highest level first
* Use warn for errors that are part of normal operations like items not found, unauthorized users
* Use error for things that should not happen like database connections failing
* Follow up with lower-level debug and var logs as needed

### Prefixing

Using a prefix in square brackets helps identify functions and libraries.
`log.trace("[newRoute] Starting route");`

## 📛 Naming Things

### Pluralization

* Prefer singular
* Objects should be singular
* A model is singular. `Model.User`
* Arrays should be plural

## 🧪 Testing

Aim for complete coverage of all happy paths, features, and error conditions.
Whenever possible, confirm mocked functions are called.

### Errors

Jaypie Testkit includes custom matchers for errors: toBeJaypieError, toThrowBadGatewayError, toThrowBadRequestError, toThrowConfigurationError, toThrowForbiddenError, toThrowGatewayTimeoutError, toThrowInternalError, toThrowJaypieError, toThrowNotFoundError, toThrowUnauthorizedError, toThrowUnavailableError,
`expect(fn).toThrowBadGatewayError();`
`await expect(async() => fn()).toThrowBadGatewayError();`
Do not use `.rejects`

### Function Calls

* Always test a function was called before testing specific values
```
expect(fn).toBeCalled();
expect(fn).toBeCalledWith(12);
```
Avoid overly specific tests on mock values and strings, especially log string.
Test key values that need to be passed through the application.
Use asymmetric matchers for mock values and strings.

### Mocks

* Assume `jaypie` is mocked by `@jaypie/testkit/mock`
* Both of these should be mocked in the subpackage's `testSetup.js` or `vitest.setup.ts`

### No Test Code in Implementations

Do not check for test conditions, environment variables, or mocks outside the test logic.
Production code should never have special handling for test cases.
All code should be structured to be fully mockable.
Appropriate use of mocks should allow special handling to be dictated in the test file.

### Observability

* The primary happy path should check `log.not.toBeCalledAboveTrace()`
* Check `expect(log.warn).toBeCalled();` for `warn` and `error` on error cases
* Do not confirm calls to debug, var, or trace.

### Organization

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

## 🍱 Miscellaneous

Alphabetize as much as possible.
Whenever a hard-coded value like `site: "datadoghq.com"` is used, define a constant at the top of the file, `const DATADOG_SITE = "datadoghq.com"`, and reference that throughout.