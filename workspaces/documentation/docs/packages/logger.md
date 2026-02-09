---
sidebar_position: 7
---

# @jaypie/logger


**Prerequisites:** `npm install jaypie` or `npm install @jaypie/logger`

## Overview

`@jaypie/logger` provides structured JSON logging with request-scoped trace IDs for Datadog integration.

## Installation

```bash
npm install jaypie
# or
npm install @jaypie/logger
```

## Quick Reference

### Log Levels

| Level | Method | Use Case |
|-------|--------|----------|
| trace | `log.trace()` | Happy path checkpoints |
| debug | `log.debug()` | Unexpected but handled |
| info | `log.info()` | Significant events (rare) |
| warn | `log.warn()` | Concerning situations |
| error | `log.error()` | Failures |
| fatal | `log.fatal()` | Cannot continue |

### Additional Methods

| Method | Purpose |
|--------|---------|
| `log.var()` | Structured key-value logging |
| `log.tag()` | Add context to all logs |
| `log.with()` | Create child logger |
| `log.init()` | Reset logger state |

## Basic Usage

```typescript
import { log } from "jaypie";

log.trace("Starting request");
log.debug("Cache miss");
log.info("Server started");
log.warn("Approaching limit");
log.error("Service failed");
log.fatal("Missing config");
```

## Variable Logging

Log structured key-value pairs:

```typescript
log.var({ userId: "123" });
// Output: { log: "trace", message: "123", var: "userId", data: "123" }
```

Available at all levels:

```typescript
log.trace.var({ requestId: "req-123" });
log.debug.var({ cacheHit: false });
log.error.var({ errorCode: "E001" });
```

### Rules

1. **Single key per call**:

```typescript
// Good
log.var({ userId: "123" });
log.var({ orderId: "456" });

// Bad
log.var({ userId: "123", orderId: "456" });
```

2. **Log summaries, not large objects**:

```typescript
// Good
log.var({ itemCount: items.length });

// Bad
log.var({ items: items });
```

## Request Tagging

Add context to all subsequent logs:

```typescript
log.tag({ requestId: "req-abc-123" });
log.tag({ userId: "user-456" });

log.trace("Processing");
// Includes: { requestId: "req-abc-123", userId: "user-456", ... }
```

## Child Loggers

Create loggers with additional context:

```typescript
const userLog = log.with({ userId: user.id });

userLog.trace("Action started");
userLog.trace("Action completed");
// Both include userId
```

## Logger Initialization

Reset state between Lambda invocations:

```typescript
log.init();
// Clears tags, resets trace ID
```

Handlers call `log.init()` automatically.

## Function Prefix Convention

Use bracketed function names:

```typescript
async function processOrder(orderId) {
  log.trace("[processOrder] starting");
  log.var({ orderId });

  await fetchOrder(orderId);
  log.trace("[processOrder] order fetched");

  return order;
}
```

## Configuration

| Variable | Values | Default |
|----------|--------|---------|
| `LOG_LEVEL` | trace, debug, info, warn, error, fatal | info |
| `LOG_FORMAT` | json, text | json |

```bash
LOG_LEVEL=debug npm start
```

## JSON Output

```typescript
log.info("Server started");
```

Outputs:

```json
{
  "log": "info",
  "message": "Server started",
  "invoke": "abc-123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Level Guidelines

### Trace

Normal execution flow:

```typescript
async function getUser(id) {
  log.trace("[getUser] fetching");
  const user = await db.findById(id);
  log.trace("[getUser] found");
  return user;
}
```

### Debug

Unexpected but handled:

```typescript
const cached = cache.get(id);
if (!cached) {
  log.debug("[getUser] cache miss");
  return await fetchUser(id);
}
```

### Info

Significant events (rare):

```typescript
log.info("Server started");
log.info("Migration complete");
```

### Warn

Concerning situations:

```typescript
if (usage > limit * 0.8) {
  log.warn("Approaching rate limit");
  log.var({ usage });
}
```

### Error

Failures:

```typescript
try {
  await externalApi.call();
} catch (error) {
  log.error("External API failed");
  log.var({ error: error.message });
  throw BadGatewayError();
}
```

### Fatal

Cannot continue:

```typescript
if (!process.env.MONGODB_URI) {
  log.fatal("Missing MONGODB_URI");
  process.exit(1);
}
```

## Testing

```typescript
import { log } from "jaypie";
import { spyLog, restoreLog } from "@jaypie/testkit";

beforeEach(() => {
  spyLog(log);
});

afterEach(() => {
  restoreLog(log);
});

it("logs at trace only", async () => {
  await successfulOperation();
  expect(log.trace).toHaveBeenCalled();
  expect(log.debug).not.toHaveBeenCalled();
});
```

## Related

- [Logging](/docs/core/logging) - Best practices
- [Testing](/docs/guides/testing) - Testing logs
- [Handler Lifecycle](/docs/core/handler-lifecycle) - Automatic initialization
