---
sidebar_position: 1
---

# Handler Lifecycle


**Prerequisites:** `npm install jaypie`

## Overview

Jaypie handlers follow a consistent lifecycle: validate, setup, execute, teardown.
This pattern applies to both `expressHandler` and `lambdaHandler`, ensuring consistent behavior across execution environments.

## Quick Reference

| Phase | Purpose | On Failure |
|-------|---------|------------|
| Validate | Check preconditions (auth, input) | Returns error response, skips remaining phases |
| Setup | Initialize resources (DB connections) | Returns error response, runs teardown |
| Execute | Main handler logic | Returns error response, runs teardown |
| Teardown | Cleanup (close connections) | Always runs, even on error |

## Lifecycle Phases

### 1. Logger Initialization

Before any lifecycle phase, the handler:
- Reinitializes the logger
- Tags logs with `invoke` ID (unique per invocation)
- Tags logs with `handler` name (if provided)

### 2. Secrets Loading

If `secrets` option is provided, loads secrets from AWS Secrets Manager into `process.env` before validation.

```typescript
expressHandler(handler, {
  secrets: ["MONGODB_URI", "API_KEY"],
});
// process.env.MONGODB_URI and process.env.API_KEY available in handler
```

### 3. Validate Phase

Validation functions run in order. Any function can reject the request by:
- Throwing an error (returns error response)
- Returning `false` (returns 400 Bad Request)

```typescript
expressHandler(handler, {
  validate: [
    (req) => req.headers.authorization, // falsy = 400
    (req) => {
      if (!req.body.id) throw BadRequestError("Missing id");
    },
  ],
});
```

### 4. Setup Phase

Setup functions run after validation passes. Use for resource initialization.

```typescript
expressHandler(handler, {
  setup: [
    async () => await connectDatabase(),
    async (req) => {
      req.locals.user = await loadUser(req.headers.authorization);
    },
  ],
});
```

### 5. Execute Phase

The main handler function runs after setup completes.

```typescript
expressHandler(async (req, res) => {
  // Main logic here
  return { data: result };
});
```

### 6. Teardown Phase

Teardown functions always run, even if earlier phases fail.

```typescript
expressHandler(handler, {
  teardown: [
    async () => await closeDatabase(),
  ],
});
```

## Handler Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | - | Handler name for logging |
| `secrets` | `string[]` | - | Secrets to load from AWS Secrets Manager |
| `setup` | `Function[]` | - | Functions to run before handler |
| `teardown` | `Function[]` | - | Functions to run after handler (always) |
| `unavailable` | `boolean` | `false` | Return 503 immediately |
| `validate` | `Function[]` | - | Validation functions |

## Response Handling

Handler return values are automatically converted to HTTP responses:

| Return Value | HTTP Status | Response Body |
|--------------|-------------|---------------|
| `object` | 200 | JSON object |
| `null` / `undefined` | 204 | No content |
| `true` | 201 | No content |
| `false` | 204 | No content |
| Thrown error | Error status | JSON:API error |

## Usage Examples

### Express Handler

```typescript
import { expressHandler, log, NotFoundError } from "jaypie";

export default expressHandler(
  async (req, res) => {
    log.trace("[getUser] fetching user");
    const user = await db.users.findById(req.params.id);
    if (!user) throw NotFoundError();
    return { data: user };
  },
  {
    name: "getUser",
    secrets: ["MONGODB_URI"],
    validate: [(req) => req.params.id],
    setup: [async () => await connectMongo()],
    teardown: [async () => await disconnectMongo()],
  }
);
```

### Lambda Handler

```typescript
import { lambdaHandler, log } from "jaypie";

export const handler = lambdaHandler(
  async (event, context) => {
    log.trace("[processEvent] processing");
    return { processed: true };
  },
  {
    name: "processEvent",
    secrets: ["API_KEY"],
  }
);
```

## Related

- [Error Handling](/docs/core/error-handling) - Jaypie error types and JSON:API format
- [Logging](/docs/core/logging) - Structured logging with trace IDs
- [@jaypie/express](/docs/packages/express) - Express handler reference
- [@jaypie/lambda](/docs/packages/lambda) - Lambda handler reference
