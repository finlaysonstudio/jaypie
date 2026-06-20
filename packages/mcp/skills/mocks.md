---
description: Mock patterns via @jaypie/testkit
related: tests, errors
---

# Testing Mocks

`@jaypie/testkit` provides mocks for Jaypie packages in tests.

## Installation

```bash
npm install -D @jaypie/testkit
```

## Setup

In your test setup file:

```typescript
// vitest.setup.ts
import { vi } from "vitest";

vi.mock("jaypie", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});
```

`@jaypie/testkit/mock` re-exports a vitest mock for every `jaypie` export as a
flat namespace, so returning it directly mocks the whole package.

Configure in vitest.config.ts:

```typescript
export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

## Available Mocks

### Main Package (jaypie)

```typescript
vi.mock("jaypie", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});

// Mocked: log, getSecret, sendMessage, etc.
```

### Sub-Packages

To mock an individual `@jaypie/*` package, return the relevant mocks from the
same flat `@jaypie/testkit/mock` namespace:

```typescript
vi.mock("@jaypie/express", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return { expressHandler: testkit.expressHandler };
});
```

## Using Mocks in Tests

### Verify Logging

```typescript
import { log } from "jaypie";

it("logs the operation", async () => {
  await myFunction();

  expect(log.info).toHaveBeenCalledWith(
    "Operation completed",
    expect.objectContaining({ userId: "123" })
  );
});
```

### Mock Secret Values

```typescript
import { getSecret } from "jaypie";

beforeEach(() => {
  vi.mocked(getSecret).mockResolvedValue("mock-api-key");
});

it("uses the API key", async () => {
  const result = await myFunction();

  expect(getSecret).toHaveBeenCalledWith("api-key-name");
  expect(result.authenticated).toBe(true);
});
```

### Mock Errors

```typescript
import { getSecret } from "jaypie";
import { ConfigurationError } from "jaypie";

it("handles missing secrets", async () => {
  vi.mocked(getSecret).mockRejectedValue(
    new ConfigurationError("Secret not found")
  );

  await expect(myFunction()).rejects.toThrow(ConfigurationError);
});
```

## Mock Matchers

### toBeJaypieError

```typescript
import { matchers } from "@jaypie/testkit";

expect.extend(matchers);

it("throws a Jaypie error", async () => {
  await expect(myFunction()).rejects.toBeJaypieError();
});
```

### toBeValidSchema

```typescript
it("returns valid schema", () => {
  const result = buildSchema();
  expect(result).toBeValidSchema();
});
```

## Per-Test Mock Reset

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});
```

## Export Verification

When adding exports to a Jaypie package, add a matching mock to testkit so the
auto-mock stays complete:

```typescript
// packages/testkit/src/mock/<package>.ts
import { createMockFunction } from "./utils";

export const newFunction = createMockFunction((x) => x);
```

Then re-export it from `src/mock/index.ts` (named export and default object) and
bump the testkit patch version. Missing mocks surface as failures in testkit's
`mock/__tests__/index.spec.ts` "all exports from original" check.

## See Also

- **`skill("errors")`** - Error types used in mock assertions
- **`skill("tests")`** - Testing patterns with Vitest

