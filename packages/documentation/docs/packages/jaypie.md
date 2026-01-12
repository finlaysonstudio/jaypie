---
sidebar_position: 1
---

# jaypie


**Prerequisites:** Node.js 20+

## Overview

The `jaypie` package is the main entry point for Jaypie applications.
It re-exports utilities from multiple Jaypie packages for convenient single-import access.

## Installation

```bash
npm install jaypie
```

## Quick Reference

### Re-exported Packages

| Package | Exports |
|---------|---------|
| `@jaypie/aws` | `getEnvSecret`, `getSecret`, `loadEnvSecrets`, `sendMessage`, `getMessages` |
| `@jaypie/datadog` | `submitMetric` |
| `@jaypie/errors` | All error classes, `isJaypieError`, `jaypieErrorFromStatus` |
| `@jaypie/express` | `expressHandler`, `expressStreamHandler`, `cors` |
| `@jaypie/kit` | `force`, `uuid`, `sleep`, `cloneDeep`, environment checks |
| `@jaypie/lambda` | `lambdaHandler`, `lambdaStreamHandler` |
| `@jaypie/logger` | `log` |

## Exports

### Error Classes

```typescript
import {
  BadGatewayError,
  BadRequestError,
  ConfigurationError,
  ForbiddenError,
  GatewayTimeoutError,
  GoneError,
  InternalError,
  MethodNotAllowedError,
  NotFoundError,
  NotImplementedError,
  RejectedError,
  TeapotError,
  TooManyRequestsError,
  UnavailableError,
  UnauthorizedError,
  isJaypieError,
  jaypieErrorFromStatus,
} from "jaypie";
```

### Handlers

```typescript
import {
  expressHandler,
  expressStreamHandler,
  lambdaHandler,
  lambdaStreamHandler,
  cors,
} from "jaypie";
```

### Logging

```typescript
import { log } from "jaypie";

log.trace("message");
log.debug("message");
log.info("message");
log.warn("message");
log.error("message");
log.fatal("message");
log.var({ key: value });
```

### Utilities

```typescript
import {
  cloneDeep,
  force,
  sleep,
  uuid,
} from "jaypie";

// Type coercion
force.array(value);
force.boolean(value);
force.number(value);
force.object(value);
force.positive(value);
force.string(value);

// UUID generation
const id = uuid();

// Async sleep
await sleep(1000);

// Deep clone
const copy = cloneDeep(original);
```

### Environment Checks

```typescript
import {
  isLocalEnv,
  isNodeTestEnv,
  isProductionEnv,
} from "jaypie";

if (isLocalEnv()) { /* PROJECT_ENV === "local" */ }
if (isProductionEnv()) { /* PROJECT_ENV === "production" */ }
if (isNodeTestEnv()) { /* NODE_ENV === "test" */ }
```

### AWS Integration

```typescript
import {
  getEnvSecret,
  getMessages,
  getSecret,
  getSingletonMessage,
  loadEnvSecrets,
  sendMessage,
} from "jaypie";

// Secrets
const secret = await getEnvSecret("API_KEY");
await loadEnvSecrets("API_KEY", "DB_URI");

// SQS
await sendMessage({ data: "payload" });
const messages = getMessages(sqsEvent);
```

### Datadog

```typescript
import { submitMetric } from "jaypie";

submitMetric("api.requests", 1, { endpoint: "/users" });
```

### Constants

```typescript
import { HTTP, JAYPIE } from "jaypie";

HTTP.CODE.OK;           // 200
HTTP.CODE.NOT_FOUND;    // 404
JAYPIE.LIB.EXPRESS;     // "@jaypie/express"
```

## Usage Examples

### Express Handler

```typescript
import { expressHandler, log, NotFoundError } from "jaypie";

export default expressHandler(
  async (req, res) => {
    log.trace("[getUser] fetching");
    const user = await db.users.findById(req.params.id);
    if (!user) throw NotFoundError();
    return { data: user };
  },
  {
    name: "getUser",
    secrets: ["MONGODB_URI"],
  }
);
```

### Lambda Handler

```typescript
import { lambdaHandler, log, getMessages } from "jaypie";

export const handler = lambdaHandler(
  async (event) => {
    const messages = getMessages(event);
    for (const msg of messages) {
      log.trace("[process] handling message");
      await processMessage(msg);
    }
    return { processed: messages.length };
  },
  {
    name: "processQueue",
  }
);
```

## Peer Dependencies

For additional functionality, install optional packages:

```bash
# LLM integration
npm install @jaypie/llm

# MongoDB connection
npm install @jaypie/mongoose

# CDK constructs
npm install @jaypie/constructs
```

## Related

- [Handler Lifecycle](/docs/core/handler-lifecycle) - Handler patterns
- [Error Handling](/docs/core/error-handling) - Error types
- [Logging](/docs/core/logging) - Logging best practices
- [@jaypie/kit](/docs/packages/kit) - Utility functions
