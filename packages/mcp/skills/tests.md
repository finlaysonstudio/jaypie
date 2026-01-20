---
description: Testing patterns with Vitest
---

# Testing Patterns

Jaypie uses Vitest for testing with specific patterns and mocks.

## Setup

### vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      reporter: ["text", "json", "html"],
    },
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

### vitest.setup.ts

```typescript
import { vi } from "vitest";

vi.mock("jaypie", async () => {
  const { mockJaypie } = await import("@jaypie/testkit");
  return mockJaypie(vi);
});
```

## Test Structure

### File Organization

```
src/
├── services/
│   └── user.ts
└── __tests__/
    └── user.spec.ts

# Or co-located:
src/
└── services/
    ├── user.ts
    └── user.spec.ts
```

### Test File Pattern

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

describe("UserService", () => {
  describe("getUser", () => {
    it("returns user when found", async () => {
      // Arrange
      const mockUser = { id: "123", name: "John" };
      vi.mocked(User.findById).mockResolvedValue(mockUser);

      // Act
      const result = await getUser("123");

      // Assert
      expect(result).toEqual(mockUser);
    });
  });
});
```

## Running Tests

```bash
# Run all tests (non-watch mode)
npm test

# Run specific package
npm test -w packages/my-package

# Watch mode (development)
npx vitest

# With coverage
npm test -- --coverage
```

**Important**: Always use `npm test` or `vitest run`, not bare `vitest` which runs in watch mode.

## Mocking

### Module Mocks

```typescript
vi.mock("./user-service.js", () => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
}));

// Access mocked functions
import { getUser } from "./user-service.js";

vi.mocked(getUser).mockResolvedValue({ id: "123" });
```

### Jaypie Mocks

```typescript
import { log, getSecret } from "jaypie";

it("logs the operation", async () => {
  await myFunction();
  expect(log.info).toHaveBeenCalledWith("Operation started");
});

it("uses secrets", async () => {
  vi.mocked(getSecret).mockResolvedValue("test-key");
  await myFunction();
  expect(getSecret).toHaveBeenCalledWith("api-key");
});
```

## Testing Errors

```typescript
import { NotFoundError } from "jaypie";

it("throws NotFoundError when user missing", async () => {
  vi.mocked(User.findById).mockResolvedValue(null);

  await expect(getUser("invalid")).rejects.toThrow(NotFoundError);
});

it("includes error context", async () => {
  vi.mocked(User.findById).mockResolvedValue(null);

  try {
    await getUser("invalid");
    expect.fail("Should have thrown");
  } catch (error) {
    expect(error.context.userId).toBe("invalid");
  }
});
```

## Async Testing

```typescript
it("handles async operations", async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

it("handles promises", () => {
  return expect(asyncFunction()).resolves.toBeDefined();
});

it("handles rejections", () => {
  return expect(failingFunction()).rejects.toThrow();
});
```

## Before/After Hooks

```typescript
describe("UserService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  beforeAll(async () => {
    // One-time setup
  });

  afterAll(async () => {
    // One-time cleanup
  });
});
```

## Snapshot Testing

```typescript
it("renders expected output", () => {
  const result = buildConfig({ env: "production" });
  expect(result).toMatchSnapshot();
});
```

## Test Coverage

Aim for meaningful coverage, not 100%:

- Test business logic thoroughly
- Test error paths
- Skip trivial getters/setters
- Skip generated code

## See Also

- `skill("mocks")` - Mock patterns
- `skill("errors")` - Error testing
