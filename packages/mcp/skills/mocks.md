---
description: Mock patterns via @jaypie/testkit
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
  const { mockJaypie } = await import("@jaypie/testkit");
  return mockJaypie(vi);
});
```

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
  const { mockJaypie } = await import("@jaypie/testkit");
  return mockJaypie(vi);
});

// Mocked: log, getSecret, sendMessage, etc.
```

### Logger

```typescript
vi.mock("@jaypie/logger", async () => {
  const { mockLogger } = await import("@jaypie/testkit");
  return mockLogger(vi);
});
```

### AWS

```typescript
vi.mock("@jaypie/aws", async () => {
  const { mockAws } = await import("@jaypie/testkit");
  return mockAws(vi);
});
```

### Mongoose

```typescript
vi.mock("@jaypie/mongoose", async () => {
  const { mockMongoose } = await import("@jaypie/testkit");
  return mockMongoose(vi);
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

When adding exports to packages, update testkit:

```typescript
// packages/testkit/src/mocks/mockJaypie.ts
export function mockJaypie(vi) {
  return {
    log: mockLog(vi),
    getSecret: vi.fn().mockResolvedValue("mock"),
    // Add new exports here
    newFunction: vi.fn(),
  };
}
```

## See Also

- `skill("tests")` - Testing patterns
- `skill("errors")` - Error testing
