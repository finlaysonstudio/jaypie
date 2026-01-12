---
sidebar_position: 3
---

# Testing

**Use this page when:** writing tests for Jaypie applications, setting up test configuration, or using custom matchers.

**Prerequisites:**
- `npm install -D @jaypie/testkit vitest`

## Overview

Jaypie provides `@jaypie/testkit` with mock factories for all packages and custom Vitest matchers.
Tests use a 7-section organization pattern for comprehensive coverage.

## Quick Reference

### Test Organization

| Section | Purpose | Example |
|---------|---------|---------|
| Base Cases | Function exists, basic behavior | Returns expected type |
| Error Conditions | Error handling | Throws on invalid input |
| Security | Auth, permissions | Rejects unauthorized |
| Observability | Logging behavior | No logs above trace |
| Happy Paths | Primary success flows | Creates resource |
| Features | Specific features | Pagination works |
| Specific Scenarios | Edge cases | Empty list handling |

### Custom Matchers

| Matcher | Purpose |
|---------|---------|
| `toThrowJaypieError()` | Any Jaypie error |
| `toThrowBadRequestError()` | 400 error |
| `toThrowNotFoundError()` | 404 error |
| `toBeClass()` | Value is a class |
| `toBeMockFunction()` | Value is a mock |
| `toMatchUuid()` | Valid UUID format |
| `toMatchMongoId()` | Valid MongoDB ObjectId |

## Setup

### Vitest Configuration

**vitest.config.ts:**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["@jaypie/testkit/testSetup"],
  },
});
```

### Manual Matcher Extension

```typescript
import { expect } from "vitest";
import { matchers } from "@jaypie/testkit";

expect.extend(matchers);
```

## Mocking Jaypie

### Full Package Mock

```typescript
import { describe, it, vi } from "vitest";

vi.mock("jaypie", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});

import { expressHandler } from "jaypie";

describe("Handler", () => {
  it("executes handler function", async () => {
    const handler = expressHandler(async () => ({ data: "test" }));
    const result = await handler({}, {});
    expect(result).toEqual({ data: "test" });
  });
});
```

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

## Testing Handlers

### Express Handler

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("jaypie", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});

import getUserRoute from "./getUser.route.js";

describe("Get User Route", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof getUserRoute).toBe("function");
    });
  });

  // Error Conditions
  describe("Error Conditions", () => {
    it("throws NotFoundError for missing user", async () => {
      const req = { params: { id: "invalid" } };
      await expect(getUserRoute(req, {})).rejects.toThrowNotFoundError();
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    it("returns user data", async () => {
      const req = { params: { id: "valid-id" } };
      const result = await getUserRoute(req, {});
      expect(result).toHaveProperty("data");
    });
  });
});
```

### Lambda Handler

```typescript
vi.mock("jaypie", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});

import { handler } from "./index.js";

describe("Lambda Handler", () => {
  it("processes event", async () => {
    const event = { Records: [{ body: JSON.stringify({ id: "123" }) }] };
    const result = await handler(event, {});
    expect(result).toEqual({ processed: true });
  });
});
```

## Testing Logs

### Spy on Logs

```typescript
import { log } from "jaypie";
import { spyLog, restoreLog } from "@jaypie/testkit";

describe("Logging", () => {
  beforeEach(() => {
    spyLog(log);
  });

  afterEach(() => {
    restoreLog(log);
  });

  it("logs at trace level only on happy path", async () => {
    await successfulOperation();

    expect(log.trace).toHaveBeenCalled();
    expect(log.debug).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("logs error on failure", async () => {
    await expect(failingOperation()).rejects.toThrow();
    expect(log.error).toHaveBeenCalled();
  });
});
```

### Observability Section Pattern

```typescript
describe("Observability", () => {
  beforeEach(() => {
    spyLog(log);
  });

  afterEach(() => {
    restoreLog(log);
  });

  it("does not log above trace on success", async () => {
    await handler();
    expect(log.debug).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });
});
```

## Testing Errors

### Error Type Assertions

```typescript
it("throws BadRequestError for invalid input", () => {
  expect(() => validateInput(null)).toThrowBadRequestError();
});

it("throws any Jaypie error", () => {
  expect(() => riskyOperation()).toThrowJaypieError();
});
```

### Async Error Assertions

```typescript
it("rejects with NotFoundError", async () => {
  await expect(getUser("invalid")).rejects.toThrowNotFoundError();
});
```

## Testing with Mocked Dependencies

### Database Mock

```typescript
import { vi } from "vitest";

vi.mock("./db.js", () => ({
  db: {
    users: {
      findById: vi.fn(),
    },
  },
}));

import { db } from "./db.js";
import getUserRoute from "./getUser.route.js";

describe("Get User", () => {
  it("returns user from database", async () => {
    db.users.findById.mockResolvedValue({ id: "123", name: "Test" });

    const result = await getUserRoute({ params: { id: "123" } }, {});

    expect(db.users.findById).toHaveBeenCalledWith("123");
    expect(result.data.name).toBe("Test");
  });
});
```

### External Service Mock

```typescript
vi.mock("./externalApi.js", () => ({
  externalApi: {
    call: vi.fn(),
  },
}));

import { externalApi } from "./externalApi.js";

describe("External Integration", () => {
  it("handles external service failure", async () => {
    externalApi.call.mockRejectedValue(new Error("Service down"));

    await expect(processWithExternalService()).rejects.toThrowBadGatewayError();
  });
});
```

## Format Matchers

```typescript
import { uuid } from "jaypie";

it("generates valid UUID", () => {
  const id = uuid();
  expect(id).toMatchUuid();
});

it("validates MongoDB ObjectId", () => {
  const id = "507f1f77bcf86cd799439011";
  expect(id).toMatchMongoId();
});

it("validates JWT format", () => {
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
  expect(token).toMatchJwt();
});

it("validates Base64", () => {
  const encoded = "SGVsbG8gV29ybGQ=";
  expect(encoded).toMatchBase64();
});
```

## Test Organization Template

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { log } from "jaypie";
import { spyLog, restoreLog } from "@jaypie/testkit";

vi.mock("jaypie", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});

import myFunction from "./myFunction.js";

describe("My Function", () => {
  beforeEach(() => {
    spyLog(log);
  });

  afterEach(() => {
    restoreLog(log);
  });

  // 1. Base Cases
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof myFunction).toBe("function");
    });

    it("returns expected type", async () => {
      const result = await myFunction();
      expect(typeof result).toBe("object");
    });
  });

  // 2. Error Conditions
  describe("Error Conditions", () => {
    it("throws on invalid input", async () => {
      await expect(myFunction(null)).rejects.toThrowBadRequestError();
    });
  });

  // 3. Security
  describe("Security", () => {
    it("rejects unauthorized requests", async () => {
      await expect(myFunction({ auth: null })).rejects.toThrowUnauthorizedError();
    });
  });

  // 4. Observability
  describe("Observability", () => {
    it("does not log above trace on success", async () => {
      await myFunction({ valid: true });
      expect(log.debug).not.toHaveBeenCalled();
    });
  });

  // 5. Happy Paths
  describe("Happy Paths", () => {
    it("processes valid input", async () => {
      const result = await myFunction({ data: "test" });
      expect(result).toHaveProperty("processed", true);
    });
  });

  // 6. Features
  describe("Features", () => {
    it("supports pagination", async () => {
      const result = await myFunction({ page: 2, limit: 10 });
      expect(result.page).toBe(2);
    });
  });

  // 7. Specific Scenarios
  describe("Specific Scenarios", () => {
    it("handles empty results", async () => {
      const result = await myFunction({ filter: "none" });
      expect(result.data).toEqual([]);
    });
  });
});
```

## Related

- [Error Handling](/docs/core/error-handling) - Error types to test
- [Logging](/docs/core/logging) - Log testing patterns
- [@jaypie/testkit](/docs/packages/testkit) - Full testkit reference
