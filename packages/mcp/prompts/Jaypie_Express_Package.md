---
description: Complete guide to using Jaypie Express features including expressHandler, CORS, lifecycle hooks, and pre-built routes
globs: packages/express/**
---

# Jaypie Express Package

Jaypie provides Express utilities through `@jaypie/express` (also available via `jaypie`). The main export is `expressHandler`, a function that wraps Express route handlers to add error handling, logging, lifecycle hooks, and automatic response formatting.

## Installation

```bash
npm install jaypie
# or
npm install @jaypie/express
```

## expressHandler

Wraps Express route handlers with error handling, logging, and lifecycle management.

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

expressHandler automatically formats responses based on return values:

| Return Value | HTTP Status | Response |
|--------------|-------------|----------|
| Object | 200 | JSON body |
| Array | 200 | JSON body |
| String (JSON) | 200 | Parsed JSON |
| String (other) | 200 | Text body |
| Number | 200 | Sent via `res.send()` |
| `true` | 201 Created | Empty |
| `null`, `undefined`, `false` | 204 No Content | Empty |
| Object with `.json()` method | 200 | Result of `.json()` |

**Note:** If you call `res.json()`, `res.send()`, or `res.end()` directly in your handler, expressHandler will log a warning but respect your call. Prefer using return values instead.

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

Lifecycle hooks execute in this order:
1. Setup functions (in array order)
2. Locals functions (in object key order, after all setup)
3. Validate functions (in array order)
4. Main handler
5. Teardown functions (always run, even on error)

### Setup Functions

Run before validation and the main handler. Use for initialization, authentication checks, or setting up request context.

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

Run after the main handler completes. Teardown functions execute regardless of success or error, making them suitable for cleanup operations.

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

Set values on `req.locals`. Values can be static or functions that receive `(req, res)`. Locals functions are called AFTER setup functions.

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
      user: getUser,             // Function called after setup
    },
  }
);
```

## CORS Helper

Configures CORS middleware using the `cors` npm package with automatic origin validation.

```typescript
import { cors } from "jaypie";
import type { CorsConfig } from "jaypie";

// Default: uses BASE_URL or PROJECT_BASE_URL env vars
app.use(cors());

// Wildcard origin
app.use(cors({ origin: "*" }));

// Specific origin
app.use(cors({ origin: "https://example.com" }));

// Multiple origins
app.use(cors({ origin: ["https://example.com", "https://app.example.com"] }));

// Custom configuration
const corsConfig: CorsConfig = {
  origin: "https://api.example.com",
  overrides: {
    // Additional options passed to the cors package
    credentials: true,
  },
};
app.use(cors(corsConfig));
```

Environment variables:
- `BASE_URL` or `PROJECT_BASE_URL`: Default allowed origins
- `PROJECT_ENV=sandbox` or `PROJECT_SANDBOX_MODE=true`: Allows localhost origins (including ports)

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
  UnauthorizedError,
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

expressHandler automatically sets these headers:
- `X-Powered-By: @jaypie/express` (always set, overrides Express default)
- `X-Project-Handler: {name}` (when name option is provided)
- `X-Project-Invocation: {uuid}` (request tracking ID, always set)
- `X-Project-Environment: {env}` (when PROJECT_ENV is set)
- `X-Project-Key: {key}` (when PROJECT_KEY is set)
- `X-Project-Version: {version}` (when PROJECT_VERSION is set or version option provided)

## Datadog Integration

When Datadog environment variables are configured, expressHandler automatically submits metrics for each request including status code and path.

## Server Creation

Use `createServer` to quickly set up an Express server with standard Jaypie middleware.

### Basic Server Usage

```typescript
import express from "express";
import { createServer, expressHandler } from "jaypie";

const app = express();

app.get("/", expressHandler(async (req, res) => {
  return { message: "Hello World" };
}));

const { server, port } = await createServer(app);
console.log(`Server running on port ${port}`);
```

### Server Options

```typescript
import { createServer } from "jaypie";
import type { CreateServerOptions } from "jaypie";

const options: CreateServerOptions = {
  port: 3000,              // Port to listen on (default: PORT env var or 8080)
  cors: { origin: "*" },   // CORS config (false to disable)
  jsonLimit: "10mb",       // JSON body parser limit (default: "1mb")
  middleware: [myMiddleware], // Additional middleware to apply
};

const { server, port } = await createServer(app, options);
```

### Server Result

```typescript
import type { ServerResult } from "jaypie";

// { server: Server, port: number }
```

## Streaming Responses

Use `expressStreamHandler` for Server-Sent Events (SSE) streaming responses. Ideal for real-time updates, LLM streaming, and long-running operations.

### Basic Streaming Usage

```typescript
import { expressStreamHandler } from "jaypie";
import type { Request, Response } from "express";

const streamRoute = expressStreamHandler(async (req: Request, res: Response) => {
  // Write SSE events directly to response
  res.write("event: message\ndata: {\"text\": \"Hello\"}\n\n");
  res.write("event: message\ndata: {\"text\": \"World\"}\n\n");
  // Handler automatically ends the stream
});

app.get("/stream", streamRoute);
```

### Streaming with LLM

```typescript
import { expressStreamHandler, Llm, createExpressStream } from "jaypie";

const llmStreamRoute = expressStreamHandler(async (req: Request, res: Response) => {
  const llm = new Llm("anthropic");
  const stream = llm.stream(req.body.prompt);

  // createExpressStream pipes LLM chunks as SSE events
  await createExpressStream(stream, res);
});

app.post("/chat", llmStreamRoute);
```

### Stream Handler Options

`expressStreamHandler` supports the same lifecycle options as `expressHandler`:

```typescript
import { expressStreamHandler } from "jaypie";
import type { ExpressStreamHandlerOptions } from "jaypie";

const options: ExpressStreamHandlerOptions = {
  name: "myStreamHandler",      // Handler name for logging
  contentType: "text/event-stream", // Default SSE content type
  chaos: "low",                 // Chaos testing level
  secrets: ["API_KEY"],         // Secrets to load
  setup: [],                    // Setup function(s)
  teardown: [],                 // Teardown function(s)
  validate: [],                 // Validation function(s)
  locals: {},                   // Values to set on req.locals
  unavailable: false,           // Return 503 if true
};

const handler = expressStreamHandler(async (req, res) => {
  // Streaming logic
}, options);
```

### SSE Headers

`expressStreamHandler` automatically sets SSE headers:
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`
- `X-Accel-Buffering: no` (disables nginx buffering)

### Error Handling in Streams

Errors are formatted as SSE error events:

```typescript
// Jaypie errors and unhandled errors are written as:
// event: error
// data: {"errors":[{"status":500,"title":"Internal Error"}]}
```

### TypeScript Types

```typescript
import type {
  ExpressStreamHandlerOptions,
  ExpressStreamHandlerLocals,
  JaypieStreamHandlerSetup,
  JaypieStreamHandlerTeardown,
  JaypieStreamHandlerValidate,
} from "jaypie";
```

## Lambda Handlers

Create Lambda handlers from Express apps using `createLambdaHandler` and `createLambdaStreamHandler`. These functions wrap Express applications to run directly on AWS Lambda Function URLs without requiring a separate Lambda adapter library.

### Buffered Handler

Use `createLambdaHandler` for standard Lambda responses where the entire response is buffered before sending.

```typescript
import express from "express";
import { createLambdaHandler, expressHandler } from "jaypie";

const app = express();

app.get("/", expressHandler(async (req, res) => {
  return { message: "Hello from Lambda!" };
}));

// Export for Lambda Function URL
export const handler = createLambdaHandler(app);
```

### Streaming Handler

Use `createLambdaStreamHandler` for Lambda response streaming, ideal for Server-Sent Events (SSE) and real-time updates.

```typescript
import express from "express";
import { createLambdaStreamHandler, expressStreamHandler } from "jaypie";

const app = express();

app.get("/stream", expressStreamHandler(async (req, res) => {
  res.write("event: message\ndata: {\"text\": \"Hello\"}\n\n");
  res.write("event: message\ndata: {\"text\": \"World\"}\n\n");
}));

// Export for Lambda Function URL with streaming
export const handler = createLambdaStreamHandler(app);
```

### Combined Usage

A typical Lambda Express application with both buffered and streaming endpoints:

```typescript
import express from "express";
import {
  createLambdaHandler,
  createLambdaStreamHandler,
  expressHandler,
  expressStreamHandler,
  cors,
} from "jaypie";

const app = express();
app.use(express.json());
app.use(cors());

// Standard buffered route
app.get("/api/data", expressHandler(async (req, res) => {
  return { data: "buffered response" };
}));

// SSE streaming route
app.get("/api/stream", expressStreamHandler(async (req, res) => {
  for (let i = 0; i < 5; i++) {
    res.write(`event: update\ndata: {"count": ${i}}\n\n`);
  }
}));

// Choose handler based on your needs
// For buffered: export const handler = createLambdaHandler(app);
// For streaming: export const handler = createLambdaStreamHandler(app);
export const handler = createLambdaHandler(app);
```

### Lambda Context Access

Both handlers expose Lambda context on the request object:

```typescript
app.get("/", expressHandler(async (req, res) => {
  // Access Lambda context directly on request
  const awsRequestId = (req as any)._lambdaContext?.awsRequestId;
  return { requestId: awsRequestId };
}));
```

### TypeScript Types

```typescript
import type {
  LambdaHandler,
  LambdaStreamHandler,
  LambdaContext,
  FunctionUrlEvent,
  LambdaResponse,
} from "jaypie";
```

## Invoke UUID Detection

Use `getCurrentInvokeUuid` to get the current request ID. Automatically detects the environment (Lambda, Lambda Web Adapter, or local development).

### Basic Usage

```typescript
import { getCurrentInvokeUuid } from "jaypie";

const handler = expressHandler(async (req, res) => {
  const invokeUuid = getCurrentInvokeUuid(req);
  // Returns AWS request ID in Lambda, or generates a local UUID
  return { requestId: invokeUuid };
});
```

### Environment Detection

The function adapts to different runtime environments:

1. **Lambda (native)**: Uses `awsRequestId` from Lambda context
2. **Lambda Web Adapter**: Extracts from `x-amzn-request-id` header or `_X_AMZN_TRACE_ID` env var
3. **Local development**: Generates a UUID for consistent tracing

### Lambda Web Adapter Headers

When running Express behind AWS Lambda Web Adapter, the function extracts the request ID from:
- `x-amzn-request-id` header (set by Lambda Web Adapter)
- `_X_AMZN_TRACE_ID` environment variable (X-Ray trace ID, set by Lambda runtime)
