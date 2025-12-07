---
description: Complete guide to using Jaypie Express features including expressHandler, CORS, lifecycle hooks, and pre-built routes
globs: packages/express/**
---

# Jaypie Express Package

Jaypie provides Express utilities through `@jaypie/express` (also available via `jaypie`). The primary export is `expressHandler`, a wrapper that adds error handling, logging, lifecycle hooks, and response formatting to Express route handlers.

## Installation

```bash
npm install jaypie
# or
npm install @jaypie/express
```

## expressHandler

The core of Jaypie Express. Wraps route handlers with error handling, logging, and lifecycle management.

### Basic Usage

```typescript
import { expressHandler } from "jaypie";
import type { Request, Response } from "express";

const myRoute = expressHandler(async (req: Request, res: Response) => {
  return { message: "Hello, World!" };
});

// Use in Express
app.get("/hello", myRoute);
```

### Return Value Handling

expressHandler automatically formats responses:

| Return Value | HTTP Status | Response |
|--------------|-------------|----------|
| Object | 200 | JSON body |
| Array | 200 | JSON body |
| String (JSON) | 200 | Parsed JSON |
| String (other) | 200 | Text body |
| `true` | 201 Created | Empty |
| `null`, `undefined`, `false` | 204 No Content | Empty |
| Object with `.json()` method | 200 | Result of `.json()` |

### Options

```typescript
import { expressHandler } from "jaypie";
import type { ExpressHandlerOptions } from "jaypie";

const options: ExpressHandlerOptions = {
  name: "myHandler",        // Handler name for logging
  chaos: "low",             // Chaos testing level
  unavailable: false,       // Return 503 if true
  setup: [],                // Setup function(s)
  teardown: [],             // Teardown function(s)
  validate: [],             // Validation function(s)
  locals: {},               // Values to set on req.locals
};

const handler = expressHandler(async (req, res) => {
  return { success: true };
}, options);

// Alternative: options first
const handler2 = expressHandler(options, async (req, res) => {
  return { success: true };
});
```

## Lifecycle Hooks

### Setup Functions

Run before the main handler. Use for initialization, authentication checks, or setting up request context.

```typescript
import { expressHandler } from "jaypie";
import type { JaypieHandlerSetup } from "jaypie";

const authenticateUser: JaypieHandlerSetup = async (req, res) => {
  const token = req.headers.authorization;
  // Validate token, throw UnauthorizedError if invalid
};

const loadTenant: JaypieHandlerSetup = async (req, res) => {
  req.locals.tenant = await getTenant(req.params.tenantId);
};

const handler = expressHandler(
  async (req, res) => {
    // req.locals.tenant is available here
    return { tenant: req.locals.tenant };
  },
  {
    setup: [authenticateUser, loadTenant],
  }
);
```

### Teardown Functions

Run after the main handler completes (success or error). Use for cleanup.

```typescript
import type { JaypieHandlerTeardown } from "jaypie";

const closeConnection: JaypieHandlerTeardown = async (req, res) => {
  await req.locals.dbConnection?.close();
};

const handler = expressHandler(
  async (req, res) => {
    req.locals.dbConnection = await openConnection();
    return await doWork(req.locals.dbConnection);
  },
  {
    teardown: closeConnection,
  }
);
```

### Validation Functions

Run before the main handler. Return `true` to continue or `false`/throw to reject.

```typescript
import { ForbiddenError } from "jaypie";
import type { JaypieHandlerValidate } from "jaypie";

const requireAdmin: JaypieHandlerValidate = (req, res) => {
  if (!req.locals.user?.isAdmin) {
    throw new ForbiddenError();
  }
  return true;
};

const validateBody: JaypieHandlerValidate = (req, res) => {
  return req.body?.email && req.body?.name;
};

const handler = expressHandler(
  async (req, res) => {
    // Only runs if user is admin and body is valid
    return { success: true };
  },
  {
    validate: [requireAdmin, validateBody],
  }
);
```

### Locals

Set values on `req.locals`. Values can be static or functions that receive `(req, res)`.

```typescript
import type { ExpressHandlerLocals } from "jaypie";

const getUser: ExpressHandlerLocals = async (req, res) => {
  return await User.findById(req.params.userId);
};

const handler = expressHandler(
  async (req, res) => {
    // Access via req.locals
    console.log(req.locals.apiVersion); // "v1"
    console.log(req.locals.user);       // User object
    return req.locals.user;
  },
  {
    locals: {
      apiVersion: "v1",          // Static value
      user: getUser,             // Function called during setup
    },
  }
);
```

## CORS Helper

Configure CORS middleware with Jaypie conventions.

```typescript
import { cors } from "jaypie";
import type { CorsConfig } from "jaypie";

// Default: uses BASE_URL or PROJECT_BASE_URL env vars
app.use(cors());

// Wildcard origin
app.use(cors({ origin: "*" }));

// Specific origin
app.use(cors({ origin: "https://example.com" }));

// Custom configuration
const corsConfig: CorsConfig = {
  origin: "https://api.example.com",
  // Additional cors options
};
app.use(cors(corsConfig));
```

Environment variables:
- `BASE_URL` or `PROJECT_BASE_URL`: Default allowed origin
- `PROJECT_ENV=sandbox` or `PROJECT_SANDBOX_MODE=true`: Allows localhost

## Pre-built Routes

Ready-to-use route handlers for common responses.

```typescript
import {
  badRequestRoute,       // 400 Bad Request
  echoRoute,             // 200 with request echo
  forbiddenRoute,        // 403 Forbidden
  goneRoute,             // 410 Gone
  methodNotAllowedRoute, // 405 Method Not Allowed
  noContentRoute,        // 204 No Content
  notFoundRoute,         // 404 Not Found
  notImplementedRoute,   // 501 Not Implemented
} from "jaypie";

// Use as catch-all or placeholder routes
app.all("/deprecated/*", goneRoute);
app.use("*", notFoundRoute);

// Echo route for debugging
app.get("/debug/echo", echoRoute);
```

## HTTP Code Handler

Create custom HTTP status code handlers.

```typescript
import { expressHttpCodeHandler, HTTP } from "jaypie";

// Returns 200 OK with empty body
const okRoute = expressHttpCodeHandler(HTTP.CODE.OK);

// Returns 202 Accepted
const acceptedRoute = expressHttpCodeHandler(202, { name: "accepted" });

app.post("/jobs", acceptedRoute);
```

## Error Handling

Throw Jaypie errors for proper HTTP responses.

```typescript
import {
  expressHandler,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  InternalError,
  log,
} from "jaypie";

const handler = expressHandler(async (req, res) => {
  const item = await findItem(req.params.id);

  if (!item) {
    log.warn("Item not found");
    throw new NotFoundError();
  }

  if (!canAccess(req.user, item)) {
    throw new ForbiddenError();
  }

  return item;
});
```

Errors return JSON:API compliant error responses:

```json
{
  "errors": [{
    "status": 404,
    "title": "Not Found",
    "detail": "The requested resource was not found"
  }]
}
```

## TypeScript Types

All lifecycle function types are exported for type safety:

```typescript
import type {
  ExpressHandlerOptions,
  ExpressHandlerLocals,
  JaypieHandlerSetup,
  JaypieHandlerTeardown,
  JaypieHandlerValidate,
  CorsConfig,
} from "jaypie";
```

## Complete Example

```typescript
import express from "express";
import {
  cors,
  expressHandler,
  notFoundRoute,
  NotFoundError,
  ForbiddenError,
  log,
} from "jaypie";
import type {
  JaypieHandlerSetup,
  JaypieHandlerValidate,
  ExpressHandlerLocals,
} from "jaypie";

const app = express();
app.use(express.json());
app.use(cors());

// Lifecycle functions
const authenticate: JaypieHandlerSetup = async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) throw new UnauthorizedError();
  req.locals.user = await verifyToken(token);
};

const requireOwner: JaypieHandlerValidate = (req, res) => {
  return req.locals.resource?.ownerId === req.locals.user?.id;
};

const loadResource: ExpressHandlerLocals = async (req, res) => {
  const resource = await Resource.findById(req.params.id);
  if (!resource) throw new NotFoundError();
  return resource;
};

// Route handler
const updateResource = expressHandler(
  async (req, res) => {
    const { resource, user } = req.locals;

    resource.name = req.body.name;
    resource.updatedBy = user.id;
    await resource.save();

    log.trace("Resource updated");
    return resource;
  },
  {
    name: "updateResource",
    setup: authenticate,
    validate: requireOwner,
    locals: {
      resource: loadResource,
    },
  }
);

app.put("/resources/:id", updateResource);
app.use("*", notFoundRoute);

export default app;
```

## Response Headers

expressHandler automatically sets:
- `X-Powered-By: @jaypie/express`
- `X-Project-Handler: {name}` (if name option provided)
- `X-Project-Invocation: {uuid}` (request tracking ID)

## Datadog Integration

When Datadog environment variables are configured, expressHandler automatically submits metrics for each request including status code and path.
