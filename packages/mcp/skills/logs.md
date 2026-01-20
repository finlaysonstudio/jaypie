---
description: Logging patterns and conventions
---

# Logging Patterns

Jaypie provides structured logging for observability.

## Basic Usage

```typescript
import { log } from "jaypie";

log.trace("Detailed debug info");
log.debug("Debug information");
log.info("Informational message");
log.warn("Warning message");
log.error("Error message");
log.fatal("Fatal error");
```

## Structured Logging

Always include context as the second argument:

```typescript
log.info("User logged in", {
  userId: user.id,
  email: user.email,
  method: "oauth",
});

log.error("Payment failed", {
  orderId: order.id,
  amount: order.total,
  error: error.message,
});
```

## Log Levels

| Level | Use For |
|-------|---------|
| trace | Very detailed debugging (loops, iterations) |
| debug | Development debugging |
| info | Normal operations, business events |
| warn | Unexpected but handled situations |
| error | Errors that need attention |
| fatal | Application cannot continue |

## Setting Log Level

Via environment variable:

```bash
LOG_LEVEL=debug npm run dev
LOG_LEVEL=trace npm test
```

In production, typically `info` or `warn`.

## Request Context

Include request identifiers for tracing:

```typescript
log.info("Processing request", {
  requestId: req.id,
  path: req.path,
  userId: req.user?.id,
});
```

## Error Logging

Log errors with full context:

```typescript
try {
  await riskyOperation();
} catch (error) {
  log.error("Operation failed", {
    error: error.message,
    stack: error.stack,
    input: sanitizedInput,
  });
  throw error;
}
```

## Sensitive Data

Never log sensitive data:

```typescript
// BAD
log.info("User auth", { password: user.password });

// GOOD
log.info("User auth", { userId: user.id, hasPassword: !!user.password });
```

## Searching Logs

### Via MCP (Datadog)

```
# Search by requestId
datadog_logs --query "@requestId:abc-123"

# Search errors
datadog_logs --query "status:error" --from "now-1h"

# Search by user
datadog_logs --query "@userId:user-456"
```

### Via MCP (CloudWatch)

```
aws_logs_filter_log_events \
  --logGroupName "/aws/lambda/my-function" \
  --filterPattern "ERROR"
```

## Log Format

Jaypie logs are JSON-formatted for Datadog:

```json
{
  "level": "info",
  "message": "User logged in",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "userId": "user-123",
  "method": "oauth",
  "dd": {
    "trace_id": "abc123",
    "span_id": "def456"
  }
}
```

## Lambda Logging

Lambda handlers automatically add context:

```typescript
import { lambdaHandler } from "@jaypie/lambda";

export const handler = lambdaHandler(async (event) => {
  // Logs automatically include:
  // - requestId
  // - functionName
  // - cold_start indicator
  log.info("Processing", { customField: "value" });
});
```

## See Also

- `skill("debugging")` - Debugging techniques
- `skill("datadog")` - Datadog integration
- `skill("variables")` - Environment variables
