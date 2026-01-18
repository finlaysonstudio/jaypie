---
sidebar_position: 3
---

# Logging


**Prerequisites:** `npm install jaypie` (includes `@jaypie/logger`)

## Overview

Jaypie provides structured logging with request-scoped trace IDs.
Logs are JSON-formatted for Datadog ingestion.
Follow the log level conventions to maintain clean, actionable logs.

## Quick Reference

| Level | Use Case | Example |
|-------|----------|---------|
| `trace` | Happy path checkpoints | Entering function, completing step |
| `debug` | Unexpected but handled cases | Cache miss, retry attempt |
| `info` | Significant events (rare) | Server started, migration complete |
| `warn` | Concerning but recoverable | Deprecation, approaching limit |
| `error` | Failures requiring attention | External service down |
| `fatal` | Application cannot continue | Missing critical config |

## Basic Usage

```typescript
import { log } from "jaypie";

log.trace("Starting request processing");
log.debug("Cache miss, fetching from database");
log.info("Server started on port 3000");
log.warn("API rate limit at 80%");
log.error("External payment service unavailable");
log.fatal("Missing required MONGODB_URI");
```

## Variable Logging

Use `log.var()` for structured key-value logging:

```typescript
// Single key-value pair (preferred)
log.var({ userId: "abc-123" });

// Output:
// { "log": "trace", "message": "abc-123", "var": "userId", "data": "abc-123", "dataType": "string" }
```

Variable logging is available at all levels:

```typescript
log.trace.var({ requestId: "req-123" });
log.debug.var({ cacheHit: false });
log.error.var({ errorCode: "E001" });
```

### Variable Logging Rules

1. **Single key per call** - Log one variable at a time:

```typescript
// Good
log.var({ userId: "123" });
log.var({ orderId: "456" });

// Bad - multiple keys
log.var({ userId: "123", orderId: "456" });
```

2. **Don't log large structures** - Log summaries instead:

```typescript
// Good
log.var({ userCount: users.length });

// Bad - large array
log.var({ users: users });
```

3. **Separate strings from variables**:

```typescript
// Good
log.trace("[processOrder] starting");
log.var({ orderId: order.id });

// Bad - mixing string and variable
log.trace(`Processing order ${order.id}`);
```

## Log Level Guidelines

### Trace (Happy Path)

Use for normal execution flow. Should be the only level in successful requests:

```typescript
async function getUser(id) {
  log.trace("[getUser] fetching user");
  const user = await db.users.findById(id);
  log.trace("[getUser] user found");
  return user;
}
```

### Debug (Off Happy Path)

Use when something unexpected happens but is handled:

```typescript
async function getCachedUser(id) {
  const cached = cache.get(id);
  if (!cached) {
    log.debug("[getCachedUser] cache miss");
    return await fetchAndCacheUser(id);
  }
  return cached;
}
```

### Info (Rarely Used)

Reserve for significant application events:

```typescript
// Server lifecycle
log.info("Server started");

// Major state changes
log.info("Database migration complete");
```

### Warn (Concerning Situations)

Use for recoverable issues that need attention:

```typescript
if (apiCallsThisHour > limit * 0.8) {
  log.warn("Approaching API rate limit");
  log.var({ usage: apiCallsThisHour });
}
```

### Error (Failures)

Use for failures that need investigation:

```typescript
try {
  await externalService.call();
} catch (error) {
  log.error("External service call failed");
  log.var({ service: "payment" });
  throw BadGatewayError();
}
```

### Fatal (Application Cannot Continue)

Use when the application must stop:

```typescript
if (!process.env.MONGODB_URI) {
  log.fatal("Missing required MONGODB_URI");
  process.exit(1);
}
```

## Request Tagging

Tag all subsequent logs with context:

```typescript
import { log } from "jaypie";

// Tag logs for this request
log.tag({ requestId: "req-abc-123" });
log.tag({ userId: "user-456" });

// All subsequent logs include these tags
log.trace("Processing request");
// Output includes: { requestId: "req-abc-123", userId: "user-456", ... }
```

## Child Loggers

Create loggers with additional context:

```typescript
const userLog = log.with({ userId: user.id });

userLog.trace("User action started");
userLog.trace("User action completed");
// Both logs include userId
```

## Lambda Initialization

Reset logger state between Lambda invocations:

```typescript
import { lambdaHandler, log } from "jaypie";

export const handler = lambdaHandler(async (event) => {
  // log.init() called automatically by handler
  log.trace("Processing event");
});
```

For manual initialization:

```typescript
log.init(); // Clears tags, resets state
```

## Environment Configuration

| Variable | Values | Default |
|----------|--------|---------|
| `LOG_LEVEL` | trace, debug, info, warn, error, fatal | info |
| `LOG_FORMAT` | json, text | json |

```bash
LOG_LEVEL=debug npm start
```

## Function Prefix Convention

Use bracketed function names in log messages:

```typescript
async function processOrder(orderId) {
  log.trace("[processOrder] starting");
  log.var({ orderId });

  const order = await fetchOrder(orderId);
  log.trace("[processOrder] order fetched");

  await validateOrder(order);
  log.trace("[processOrder] order validated");

  return order;
}
```

## Testing Logs

Use `@jaypie/testkit` for log assertions:

```typescript
import { log } from "jaypie";
import { spyLog, restoreLog } from "@jaypie/testkit";

beforeEach(() => {
  spyLog(log);
});

afterEach(() => {
  restoreLog(log);
});

it("logs at trace level on happy path", async () => {
  await processOrder("order-123");

  // Verify no logs above trace
  expect(log.debug).not.toHaveBeenCalled();
  expect(log.warn).not.toHaveBeenCalled();
  expect(log.error).not.toHaveBeenCalled();
});

it("logs error on failure", async () => {
  await expect(processOrder("invalid")).rejects.toThrow();
  expect(log.error).toHaveBeenCalled();
});
```

## Related

- [Error Handling](/docs/core/error-handling) - Error types and when to log errors
- [Handler Lifecycle](/docs/core/handler-lifecycle) - Automatic log initialization
- [@jaypie/logger](/docs/packages/logger) - Full API reference
- [Testing](/docs/guides/testing) - Testing log output
