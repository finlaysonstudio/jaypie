---
title: "@jaypie/express"
---

Express.js handlers, CORS, and route utilities.

## Overview

`@jaypie/express` provides Express.js integration for the Jaypie library, including:

- Express handler wrapper with lifecycle management
- CORS configuration
- Route utilities
- Request/response helpers

## Installation

```bash
npm install @jaypie/express
```

## Key Features

### Express Handler

Wraps Express.js routes with Jaypie's handler lifecycle:

```javascript
import { expressHandler } from "@jaypie/express";

app.get("/api/users", expressHandler(async (req, res) => {
  // Handler logic
  return { users: [] };
}));
```

### Lifecycle Phases

The `expressHandler` extends the base handler lifecycle with an additional `locals` phase:

1. **Validate** - Request validation
2. **Locals** - Populate `req.locals` with static values or function results
3. **Setup** - Resource initialization
4. **Handler** - Business logic
5. **Teardown** - Cleanup (always runs)

### Request Logging

Every request is logged in summary form. Two options control what the summary
carries, and both apply to `expressStreamHandler` as well:

```javascript
app.post(
  "/webhook/github",
  expressHandler(handleWebhook, {
    logBody: false,
    sensitiveHeaders: ["x-hub-signature-256"],
  }),
);
```

`sensitiveHeaders` adds to the always-redacted defaults
(`EXPRESS.HEADER.SENSITIVE`: `authorization`, `cookie`, `set-cookie`) and matches
without regard to case. `logBody: false` omits the body, for a route whose
payload is third-party data the log should not carry. Without either option the
handler logs exactly what it always has.

### CORS Support

Built-in CORS configuration for Express applications.

### Supertest Integration

Supports testing mode for use with supertest:

```javascript
import { mock } from "@jaypie/testkit";
import request from "supertest";

const app = mock.expressHandler(handler);
await request(app).get("/api/users").expect(200);
```

## API Documentation

_API documentation will be generated from TypeScript definitions._

## Related Packages

- [@jaypie/core](./core) - Core utilities
- [@jaypie/lambda](./lambda) - AWS Lambda integration
- [@jaypie/testkit](./testkit) - Testing utilities
