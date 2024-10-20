# Jaypie Testkit 🐦‍⬛🫒

Test utilities built for Jaypie

## 📋 Usage

### Installation

```bash
npm install --save-dev @jaypie/testkit
```

### Example

#### Mocking Jaypie

The testkit provides a complete mock for Jaypie including:

* Log spying (`expect(log.warn).toHaveBeenCalled()`)
* Default responses for runtime-only functions (`connect`, `sendMessage`, `submitMetric`)
* No automatic error handling for handlers (which is good in production but obfuscates tests)
* Most non-utility functions are mocked to allow simple testing

```javascript
vi.mock("jaypie", async () => vi.importActual("@jaypie/testkit/mock"));
```

#### Error Spying
  
```javascript
import { ConfigurationError } from "@jaypie/core";

vi.mock("jaypie", async () => vi.importActual("@jaypie/testkit/mock"));

test("ConfigurationError", () => {
  try {
    throw new ConfigurationError("Sorpresa!");
  } catch (error) {
    expect(error).toBeJaypieError();
    expect(ConfigurationError).toHaveBeenCalled();
  }
});
```

#### Log Spying

```javascript
import { log } from "jaypie";

vi.mock("jaypie", async () => vi.importActual("@jaypie/testkit/mock"));

afterEach(() => {
  vi.clearAllMocks();
});

test("log", () => {
  expect(vi.isMockFunction(log.warn)).toBe(true);
  expect(log.warn).not.toHaveBeenCalled();
  log.warn("Danger");
  expect(log.warn).toHaveBeenCalled();
  expect(log.error).not.toHaveBeenCalled();
});
```

👺 Logging Conventions:

* Only use `log.trace` or `log.var` during "happy path"
* Use `log.debug` for edge cases
* Now you can add an "observability" test that will fail as soon as new code triggers an unexpected edge condition

```javascript
describe("Observability", () => {
  it("Does not log above trace", async () => {
    // Arrange
    // TODO: "happy path" setup
    // Act
    await myNewFunction(); // TODO: add any "happy path" parameters
    // Assert
    expect(log).not.toBeCalledAboveTrace();
    // or individually:
    expect(log.debug).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
    expect(log.fatal).not.toHaveBeenCalled();
  });
});
```

> 👺 Follow the "arrange, act, assert" pattern

#### Test Matchers

testSetup.js

```javascript
import { matchers as jaypieMatchers } from "@jaypie/testkit";
import * as extendedMatchers from "jest-extended";
import { expect } from "vitest";

expect.extend(extendedMatchers);
expect.extend(jaypieMatchers);
```

test.spec.js

```javascript
import { ConfigurationError } from "@jaypie/core";

const error = new ConfigurationError();
const json = error.json();
expect(error).toBeJaypieError();
expect(json).toBeJaypieError();
```

## 📖 Reference

```
import { 
  LOG,
  jsonApiErrorSchema,
  jsonApiSchema,
  matchers,
  mockLogFactory,
  restoreLog,
  spyLog,
} from '@jaypie/testkit'
```

### `LOG`

`LOG` constant provided by `@jaypie/core` for convenience

```javascript
import { log } from "@jaypie/core";
import { LOG } from "@jaypie/testkit";

const libLogger = log.lib({ level: LOG.LEVEL.WARN, lib: "myLib" });
```

### `jsonApiErrorSchema`

A [JSON Schema](https://json-schema.org/) validator for the [JSON:API](https://jsonapi.org/) error schema. Powers the `toBeJaypieError` matcher (via `toMatchSchema`).

### `jsonApiSchema`

A [JSON Schema](https://json-schema.org/) validator for the [JSON:API](https://jsonapi.org/) data schema.

### `matchers`

```javascript
export default {
  toBeCalledAboveTrace,
  toBeCalledWithInitialParams,
  toBeClass,
  toBeJaypieError,
  toBeValidSchema: jsonSchemaMatchers.toBeValidSchema,
  toMatchBase64,
  toMatchJwt,
  toMatchMongoId,
  toMatchSchema: jsonSchemaMatchers.toMatchSchema,
  toMatchSignedCookie,
  toMatchUuid4,
  toMatchUuid5,
  toMatchUuid,
  toThrowBadGatewayError,
  toThrowBadRequestError,
  toThrowConfigurationError,
  toThrowForbiddenError,
  toThrowGatewayTimeoutError,
  toThrowInternalError,
  toThrowJaypieError,
  toThrowNotFoundError,
  toThrowUnauthorizedError,
  toThrowUnavailableError,
};
```

testSetup.js

```javascript
import { matchers as jaypieMatchers } from "@jaypie/testkit";
import * as extendedMatchers from "jest-extended";
import { expect } from "vitest";

expect.extend(extendedMatchers);
expect.extend(jaypieMatchers);
```

#### `expect(subject).toBeCalledAboveTrace()`

```javascript
import { log } from "@jaypie/core";

log.trace("Hello, World!");
expect(log).not.toBeCalledAboveTrace();

log.warn("Look out, World!");
expect(log).toBeCalledAboveTrace();
```

#### `expect(subject).toBeJaypieError()`

Validates instance objects:

```javascript
try {
  throw new Error("Sorpresa!");
} catch (error) {
  expect(error).not.toBeJaypieError();
}
```

Validates plain old JSON:

```javascript
expect({ errors: [ { status, title, detail } ] }).toBeJaypieError();
```

Jaypie errors, which are `ProjectErrors`, all have a `.json()` to convert

#### `expect(subject).toBeValidSchema()`

```javascript
import { jsonApiErrorSchema, jsonApiSchema } from "@jaypie/testkit";

expect(jsonApiErrorSchema).toBeValidSchema();
expect(jsonApiSchema).toBeValidSchema();
expect({ project: "mayhem" }).not.toBeValidSchema();
```

From `jest-json-schema` [toBeValidSchema.js](https://github.com/americanexpress/jest-json-schema/blob/main/matchers/toBeValidSchema.js) (not documented in README)

#### `expect(subject).toMatchSchema(schema)`

```javascript
import { jsonApiErrorSchema, jsonApiSchema } from "@jaypie/testkit";
import { ConfigurationError } from "@jaypie/core";

const error = new ConfigurationError();
const json = error.json();
expect(json).toMatchSchema(jsonApiErrorSchema);
expect(json).not.toMatchSchema(jsonApiSchema);
```

From `jest-json-schema`; see [README](https://github.com/americanexpress/jest-json-schema?tab=readme-ov-file#tomatchschemaschema)


#### `expect(subject).toMatch*()` Regular Expression Matchers

Note: these regular expressions matchers so not verify the value is value, only that it matches the pattern (it "looks like" something). For example, `expect("123e4567-e89b-12d3-a456-426614174000").toMatchUuid()` will pass because the string matches a UUID pattern, even though it is not a valid UUID. 

* `toMatchBase64`
* `toMatchJwt`
* `toMatchMongoId`
* `toMatchSignedCookie`
* `toMatchUuid4`
* `toMatchUuid5`
* `toMatchUuid`

#### `expect(subject).toThrowJaypieError()`

```javascript
import { ConfigurationError } from "@jaypie/core";

const error = new ConfigurationError();
expect(() => {
  throw error;
}).toThrowJaypieError();
```

Do not forget to `await expect` when passing `async` functions:

```javascript
import { ConfigurationError } from "@jaypie/core";

const error = new ConfigurationError();
await expect(async () => {
  throw error;
}).toThrowJaypieError();

// Breaks and causes a false-positive because `expect` did not `await`
// expect(async () => {}).toThrowJaypieError();
// > Error: Expected function to throw a JaypieError, but it did not throw.
```

### `mockLogFactory()`

Creates a mock of the `log` provided by `@jaypie/core`.

```javascript
import { mockLogFactory } from "@jaypie/testkit";

const log = mockLogFactory();
log.warn("Danger");
expect(log.warn).toHaveBeenCalled();
expect(log.error).not.toHaveBeenCalled();
```

### `restoreLog(log)`

Restores the `log` provided by `@jaypie/core`, commonly performed `afterEach` with `spyLog` in `beforeEach`. See example with `spyLog`.

### `spyLog(log)`

Spies on the `log` provided by `@jaypie/core`, commonly performed `beforeEach` with `restoreLog` in `afterEach`. Not necessary when mocking the entire Jaypie module.

```javascript
import { restoreLog, spyLog } from "@jaypie/testkit";
import { log } from "@jaypie/core";

beforeEach(() => {
  spyLog(log);
});
afterEach(() => {
  restoreLog(log);
  vi.clearAllMocks();
});

test("log", () => {
  log.warn("Danger");
  expect(log.warn).toHaveBeenCalled();
  expect(log.error).not.toHaveBeenCalled();
});
```

### `sqsTestRecords(message, message, ...)` or `sqsTestRecords([...])`

Generates an event object for testing SQS Lambda functions with as many messages as provided. Note, test will accept more than ten messages, but AWS will only send ten at a time.

```javascript
import { sqsTestRecords } from "@jaypie/testkit";

const event = sqsTestRecords(
  { MessageId: "1", Body: "Hello, World!" },
  { MessageId: "2", Body: "Goodbye, World!" }
);
```

## 🌠 Wishlist

* matcher toBeHttpStatus
* matcher toBeJaypieAny
* matcher toBeJaypieData
* matcher toBeJaypieDataObject
* matcher toBeJaypieDataArray
* ...@knowdev/jest

## 📝 Changelog

| Date       | Version | Summary        |
| ---------- | ------- | -------------- |
|  9/15/2024 |  1.0.29 | All errors exported as mocks |
|  9/14/2024 |  1.0.28 | Matchers `toThrowBadGatewayError`, `toThrowGatewayTimeoutError`, `toThrowUnavailableError` |
|  9/13/2024 |  1.0.27 | Matcher `toBeCalledAboveTrace` |
|  7/16/2024 |  1.0.21 | Export Jaypie mock as default |
|  3/20/2024 |   1.0.2 | Export `LOG`   |
|  3/16/2024 |   1.0.0 | Artists ship   |
|  3/15/2024 |   0.1.0 | Initial deploy |
|  3/15/2024 |   0.0.1 | Initial commit |

## 📜 License

[MIT License](./LICENSE.txt). Published by Finlayson Studio
