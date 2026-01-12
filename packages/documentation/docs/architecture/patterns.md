---
sidebar_position: 3
---

# Patterns and Anti-Patterns


**Prerequisites:** Familiarity with Jaypie basics

## Overview

This page documents Jaypie coding patterns to follow and anti-patterns to avoid.

## Error Handling

### Do: Use Jaypie Errors

```typescript
import { NotFoundError, BadRequestError } from "jaypie";

if (!user) throw NotFoundError("User not found");
if (!email) throw BadRequestError("Email required");
```

### Don't: Vanilla Errors

```typescript
// Bad
throw new Error("User not found");
throw new Error("Email required");
```

### Do: Log Then Throw

```typescript
import { BadGatewayError, log } from "jaypie";

try {
  await externalApi.call();
} catch (error) {
  log.error("External API failed");
  log.var({ error: error.message });
  throw BadGatewayError();
}
```

### Don't: Expose Internal Details

```typescript
// Bad - exposes stack trace
throw InternalError(error.message);
throw InternalError(`DB error: ${dbError.stack}`);
```

## Logging

### Do: Use Log Levels Correctly

```typescript
// Happy path = trace only
log.trace("[getUser] fetching");
const user = await db.findById(id);
log.trace("[getUser] found");

// Unexpected but handled = debug
if (!cached) {
  log.debug("[getUser] cache miss");
}

// Problems = warn/error
log.error("Payment service down");
```

### Don't: Log Everything as Info

```typescript
// Bad
log.info("Starting function");
log.info("Got user");
log.info("Returning result");
```

### Do: Single Key Per var()

```typescript
log.var({ userId: "123" });
log.var({ orderId: "456" });
```

### Don't: Multiple Keys

```typescript
// Bad
log.var({ userId: "123", orderId: "456", status: "active" });
```

### Do: Function Prefix

```typescript
log.trace("[processOrder] starting");
log.trace("[processOrder] validated");
log.trace("[processOrder] complete");
```

## Function Parameters

### Do: Object Parameters

```typescript
function createUser({ name, email, role }) {
  // ...
}

function fetchUser(userId, { includeProfile } = {}) {
  // Single required + options object OK
}
```

### Don't: Ordered Parameters

```typescript
// Bad
function createUser(name, email, role, active, createdBy) {
  // ...
}
```

## Imports and Organization

### Do: Alphabetize

```typescript
import { BadRequestError, log, NotFoundError, uuid } from "jaypie";

const config = {
  apiKey: process.env.API_KEY,
  database: process.env.DATABASE,
  timeout: 5000,
};
```

### Don't: Random Order

```typescript
// Bad
import { log, uuid, BadRequestError, NotFoundError } from "jaypie";
```

## Constants

### Do: Named Constants

```typescript
const DEFAULT_TIMEOUT = 5000;
const MAX_RETRIES = 3;
const API_VERSION = "v1";

function fetchData() {
  return fetch(url, { timeout: DEFAULT_TIMEOUT });
}
```

### Don't: Magic Numbers

```typescript
// Bad
function fetchData() {
  return fetch(url, { timeout: 5000 });
}
```

## Testing

### Do: Seven Sections

```typescript
describe("Function", () => {
  describe("Base Cases", () => { /* ... */ });
  describe("Error Conditions", () => { /* ... */ });
  describe("Security", () => { /* ... */ });
  describe("Observability", () => { /* ... */ });
  describe("Happy Paths", () => { /* ... */ });
  describe("Features", () => { /* ... */ });
  describe("Specific Scenarios", () => { /* ... */ });
});
```

### Do: Test Observability

```typescript
describe("Observability", () => {
  it("does not log above trace on success", async () => {
    await handler();
    expect(log.debug).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });
});
```

### Do: Sibling Test Files

```
src/
├── utils/
│   ├── helper.ts
│   └── helper.spec.ts    # Sibling, not in __tests__
```

### Don't: Separate Test Directory

```
// Bad
src/
├── utils/
│   └── helper.ts
__tests__/
└── utils/
    └── helper.spec.ts
```

## Handler Patterns

### Do: Use req.locals

```typescript
expressHandler(
  async (req) => {
    return { user: req.locals.user };
  },
  {
    setup: [
      async (req) => {
        req.locals.user = await loadUser(req);
      },
    ],
  }
);
```

### Do: Return Values (Not res.json)

```typescript
// Good
expressHandler(async (req) => {
  return { data: result };
});

// Bad
expressHandler(async (req, res) => {
  res.json({ data: result });
});
```

## Type Safety

### Do: Handle Optional Parameters

```typescript
function process(value?: string) {
  if (!value) {
    throw BadRequestError("Value required");
  }
  // Now value is string, not string | undefined
  return value.toUpperCase();
}
```

### Do: Use Type Guards

```typescript
if (isJaypieError(error)) {
  return res.status(error.status).json(error.body());
}
```

## Avoid Over-Engineering

### Do: Minimal Changes

```typescript
// User asked to add validation
function createUser({ email }) {
  if (!email.includes("@")) {
    throw BadRequestError("Invalid email");
  }
  // Just add validation, don't refactor everything
}
```

### Don't: Add Unnecessary Abstractions

```typescript
// Bad - user just asked to add validation
// Don't create EmailValidator class
// Don't add validation framework
// Don't refactor surrounding code
```

### Do: Delete Unused Code

```typescript
// If removing a feature, delete it completely
// Don't leave commented code
// Don't add backwards-compat shims
```

## Environment

### Do: Use Jaypie Environment Checks

```typescript
import { isProductionEnv, isLocalEnv } from "jaypie";

if (isProductionEnv()) {
  // Production behavior
}
```

### Don't: Direct NODE_ENV Checks

```typescript
// Bad
if (process.env.NODE_ENV === "production") {
  // ...
}
```

## Related

- [Error Handling](/docs/core/error-handling) - Error patterns
- [Logging](/docs/core/logging) - Logging patterns
- [Testing](/docs/guides/testing) - Testing patterns
- [Handler Lifecycle](/docs/core/handler-lifecycle) - Handler patterns
