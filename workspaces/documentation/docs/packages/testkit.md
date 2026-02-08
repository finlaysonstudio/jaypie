---
sidebar_position: 9
---

# @jaypie/testkit


**Prerequisites:** `npm install -D @jaypie/testkit vitest`

## Overview

`@jaypie/testkit` provides mock factories for all Jaypie packages and custom Vitest matchers for testing.

## Installation

```bash
npm install -D @jaypie/testkit vitest
```

## Quick Reference

### Exports

| Export | Purpose |
|--------|---------|
| `matchers` | Vitest custom matchers |
| `spyLog` | Spy on log methods |
| `restoreLog` | Restore log methods |
| Mock factories | Via `@jaypie/testkit/mock` |

### Custom Matchers

| Category | Matchers |
|----------|----------|
| Errors | `toThrowJaypieError`, `toThrowBadRequestError`, `toThrowNotFoundError`, etc. |
| Types | `toBeClass`, `toBeMockFunction` |
| Formats | `toMatchUuid`, `toMatchMongoId`, `toMatchJwt`, `toMatchBase64` |
| Schema | `toMatchSchema` |

## Setup

### Automatic Setup

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ["@jaypie/testkit/testSetup"],
  },
});
```

### Manual Setup

```typescript
import { expect } from "vitest";
import { matchers } from "@jaypie/testkit";

expect.extend(matchers);
```

## Mocking Jaypie

### Full Package Mock

```typescript
import { vi } from "vitest";

vi.mock("jaypie", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});

import { expressHandler } from "jaypie";
```

The mock:
- `expressHandler` executes the handler function directly
- `lambdaHandler` executes the handler function directly
- `log` methods are no-ops (or spies with `spyLog`)
- Error classes work normally

### Partial Mock

```typescript
vi.mock("jaypie", async () => {
  const actual = await vi.importActual("jaypie");
  const testkit = await import("@jaypie/testkit/mock");
  return {
    ...actual,
    expressHandler: testkit.expressHandler,
  };
});
```

### Specific Package Mock

```typescript
vi.mock("@jaypie/express", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return { expressHandler: testkit.expressHandler };
});
```

## Error Matchers

### toThrowJaypieError

```typescript
it("throws any Jaypie error", () => {
  expect(() => fn()).toThrowJaypieError();
});
```

### Specific Error Matchers

```typescript
expect(() => fn()).toThrowBadRequestError();
expect(() => fn()).toThrowUnauthorizedError();
expect(() => fn()).toThrowForbiddenError();
expect(() => fn()).toThrowNotFoundError();
expect(() => fn()).toThrowInternalError();
expect(() => fn()).toThrowConfigurationError();
expect(() => fn()).toThrowBadGatewayError();
expect(() => fn()).toThrowUnavailableError();
```

### Async Errors

```typescript
await expect(asyncFn()).rejects.toThrowNotFoundError();
```

## Type Matchers

### toBeClass

```typescript
it("exports a class", () => {
  expect(MyClass).toBeClass();
});
```

### toBeMockFunction

```typescript
it("is a mock", () => {
  const fn = vi.fn();
  expect(fn).toBeMockFunction();
});
```

## Format Matchers

### toMatchUuid

```typescript
it("generates valid UUID", () => {
  expect(uuid()).toMatchUuid();
});
```

### toMatchMongoId

```typescript
it("is valid MongoDB ObjectId", () => {
  expect("507f1f77bcf86cd799439011").toMatchMongoId();
});
```

### toMatchJwt

```typescript
it("is valid JWT format", () => {
  expect(token).toMatchJwt();
});
```

### toMatchBase64

```typescript
it("is valid Base64", () => {
  expect("SGVsbG8=").toMatchBase64();
});
```

## Schema Matchers

### toMatchSchema

```typescript
import { jsonApiSchema } from "@jaypie/testkit";

it("returns JSON:API response", () => {
  expect(response).toMatchSchema(jsonApiSchema);
});
```

## Log Spying

### Setup and Teardown

```typescript
import { log } from "jaypie";
import { spyLog, restoreLog } from "@jaypie/testkit";

beforeEach(() => {
  spyLog(log);
});

afterEach(() => {
  restoreLog(log);
});
```

### Assertions

```typescript
it("logs trace on success", () => {
  await handler();
  expect(log.trace).toHaveBeenCalled();
});

it("does not log above trace", () => {
  await handler();
  expect(log.debug).not.toHaveBeenCalled();
  expect(log.warn).not.toHaveBeenCalled();
  expect(log.error).not.toHaveBeenCalled();
});

it("logs specific message", () => {
  await handler();
  expect(log.trace).toHaveBeenCalledWith("[handler] starting");
});
```

## Test Organization

Seven-section structure:

```typescript
describe("My Function", () => {
  // 1. Base Cases
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof myFn).toBe("function");
    });
  });

  // 2. Error Conditions
  describe("Error Conditions", () => {
    it("throws on invalid input", () => {
      expect(() => myFn(null)).toThrowBadRequestError();
    });
  });

  // 3. Security
  describe("Security", () => {
    it("rejects unauthorized", () => {
      expect(() => myFn({ auth: null })).toThrowUnauthorizedError();
    });
  });

  // 4. Observability
  describe("Observability", () => {
    beforeEach(() => spyLog(log));
    afterEach(() => restoreLog(log));

    it("logs trace only on success", async () => {
      await myFn();
      expect(log.debug).not.toHaveBeenCalled();
    });
  });

  // 5. Happy Paths
  describe("Happy Paths", () => {
    it("returns expected result", async () => {
      const result = await myFn({ valid: true });
      expect(result).toHaveProperty("success", true);
    });
  });

  // 6. Features
  describe("Features", () => {
    it("supports pagination", async () => {
      const result = await myFn({ page: 2 });
      expect(result.page).toBe(2);
    });
  });

  // 7. Specific Scenarios
  describe("Specific Scenarios", () => {
    it("handles empty results", async () => {
      const result = await myFn({ filter: "none" });
      expect(result.data).toEqual([]);
    });
  });
});
```

## Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["@jaypie/testkit/testSetup"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
```

## Related

- [Testing](/docs/guides/testing) - Testing guide
- [Error Handling](/docs/core/error-handling) - Error types
- [Logging](/docs/core/logging) - Log testing
