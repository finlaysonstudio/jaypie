---
sidebar_position: 2
---

# @jaypie/express


**Prerequisites:** `npm install jaypie` or `npm install @jaypie/express`

## Overview

`@jaypie/express` provides Express handler wrappers with lifecycle management, automatic error formatting, and response handling.

## Installation

```bash
npm install jaypie
# or
npm install @jaypie/express
```

## Quick Reference

### Exports

| Export | Purpose |
|--------|---------|
| `expressHandler` | Standard request handler wrapper |
| `expressStreamHandler` | SSE/streaming handler wrapper |
| `cors` | CORS middleware |
| `createExpressStream` | SSE stream helper |

### Response Mapping

| Return Value | HTTP Status |
|--------------|-------------|
| `object` | 200 |
| `null` / `undefined` | 204 |
| `true` | 201 |
| `false` | 204 |
| Thrown error | Error status |

## expressHandler

### Basic Usage

```typescript
import { expressHandler } from "jaypie";

export default expressHandler(async (req, res) => {
  return { data: "result" };
});
// Returns: 200 { data: "result" }
```

### With Options

```typescript
import { expressHandler, NotFoundError } from "jaypie";

export default expressHandler(
  async (req, res) => {
    const user = await db.users.findById(req.params.id);
    if (!user) throw NotFoundError();
    return { data: user };
  },
  {
    name: "getUser",
    secrets: ["MONGODB_URI"],
    validate: [(req) => req.params.id],
    setup: [async () => await connectDb()],
    teardown: [async () => await disconnectDb()],
  }
);
```

### Options Reference

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Handler name for logging |
| `secrets` | `string[]` | Secrets to load from AWS Secrets Manager |
| `validate` | `Function[]` | Validation functions (throw or return false to reject) |
| `setup` | `Function[]` | Setup functions (run before handler) |
| `teardown` | `Function[]` | Teardown functions (always run) |
| `unavailable` | `boolean` | Return 503 immediately |
| `throw` | `boolean` | Re-throw errors instead of formatting |

### Validation

```typescript
expressHandler(handler, {
  validate: [
    // Return false for 400 Bad Request
    (req) => req.body.email,

    // Throw specific error
    (req) => {
      if (!req.headers.authorization) {
        throw UnauthorizedError();
      }
    },
  ],
});
```

### Using req.locals

Share data between lifecycle functions:

```typescript
expressHandler(
  async (req, res) => {
    // Access data from setup
    return { user: req.locals.user };
  },
  {
    setup: [
      async (req) => {
        req.locals.user = await loadUser(req.headers.authorization);
      },
    ],
  }
);
```

## expressStreamHandler

For Server-Sent Events (SSE) responses:

```typescript
import { expressStreamHandler, createExpressStream } from "jaypie";

export default expressStreamHandler(async (req, res, context) => {
  const stream = createExpressStream(context);

  stream.write("Starting...\n");

  for (const item of items) {
    await processItem(item);
    stream.write(`Processed: ${item.id}\n`);
  }

  stream.end();
});
```

### With LLM Streaming

```typescript
import { expressStreamHandler, createExpressStream } from "jaypie";
import Llm from "@jaypie/llm";

export default expressStreamHandler(async (req, res, context) => {
  const stream = createExpressStream(context);

  for await (const chunk of Llm.stream(req.body.prompt)) {
    stream.write(chunk.content || "");
  }

  stream.end();
});
```

## cors

CORS middleware with environment-based configuration.

### Basic Usage

```typescript
import express from "express";
import { cors } from "jaypie";

const app = express();
app.use(cors());
```

### With Options

```typescript
app.use(cors({
  origin: ["https://example.com", "https://app.example.com"],
  credentials: true,
}));
```

### Environment Variable

Set allowed origins via environment variable:

```bash
CORS_ORIGIN=https://example.com,https://app.example.com
```

```typescript
app.use(cors());
// Reads from CORS_ORIGIN automatically
```

## Response Headers

Jaypie handlers automatically add response headers:

| Header | Value |
|--------|-------|
| `X-Powered-By` | `Jaypie` |
| `X-Project-Key` | `PROJECT_KEY` env var |
| `X-Project-Env` | `PROJECT_ENV` env var |
| `X-Invocation` | Unique invocation ID |

## Pre-built Routes

```typescript
import {
  badRequestRoute,
  forbiddenRoute,
  goneRoute,
  internalRoute,
  notFoundRoute,
  teapotRoute,
  unavailableRoute,
} from "@jaypie/express";

// Returns 404 Not Found
router.get("/missing", notFoundRoute);

// Returns 503 Service Unavailable
router.get("/maintenance", unavailableRoute);
```

## Testing

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("jaypie", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});

import myRoute from "./myRoute.js";

describe("My Route", () => {
  it("returns data", async () => {
    const req = { params: { id: "123" } };
    const res = {};
    const result = await myRoute(req, res);
    expect(result).toHaveProperty("data");
  });

  it("throws NotFoundError for missing resource", async () => {
    const req = { params: { id: "invalid" } };
    await expect(myRoute(req, {})).rejects.toThrowNotFoundError();
  });
});
```

## Router Pattern

```typescript
// routers/v1.router.ts
import { Router } from "express";
import usersRoute from "../routes/users.route.js";
import healthRoute from "../routes/health.route.js";

const router = Router();

router.get("/health", healthRoute);
router.get("/users/:id", usersRoute);

export default router;
```

```typescript
// app.ts
import express from "express";
import { cors } from "jaypie";
import v1Router from "./routers/v1.router.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/v1", v1Router);

export default app;
```

## Related

- [Handler Lifecycle](/docs/core/handler-lifecycle) - Lifecycle phases
- [Error Handling](/docs/core/error-handling) - Error formatting
- [Express on Lambda](/docs/guides/express-lambda) - Deployment guide
- [Testing](/docs/guides/testing) - Testing handlers
