---
description: Express.js handler for AWS Lambda with API Gateway support
related: handlers, lambda, aws, cdk, services
---

# Express Integration

Jaypie's `@jaypie/express` package enables running Express.js applications on AWS Lambda with API Gateway (v1 REST API) or Function URL (v2) events.

## Package Overview

```typescript
import {
  cors,
  EXPRESS,
  expressHandler,
  expressStreamHandler,
  createLambdaHandler,
  createLambdaStreamHandler,
} from "@jaypie/express";
```

Access through the main `jaypie` package:

```typescript
import { EXPRESS, expressHandler, cors } from "jaypie";
```

## Express Handler

Wrap Express routes with Jaypie lifecycle management:

```typescript
import express from "express";
import { expressHandler } from "jaypie";

const app = express();

app.get("/api/users", expressHandler(async (req, res) => {
  // Handler with Jaypie lifecycle (logging, error handling)
  return { users: [] };
}));
```

### Handler Options

```typescript
expressHandler(handler, {
  locals: {},        // Values passed to res.locals
  name: "handler",   // Handler name for logging
  setup: async (req, res) => {},    // Pre-handler setup
  teardown: async (req, res) => {}, // Post-handler cleanup
  unavailable: false, // Return 503 immediately if true
  validate: async (req, res) => {}, // Validation before handler
});
```

## Lambda Adapter

Convert Express apps to Lambda handlers:

```typescript
import express from "express";
import { createLambdaHandler } from "@jaypie/express";

const app = express();
app.get("/", (req, res) => res.json({ status: "ok" }));

export const handler = createLambdaHandler(app);
```

### Streaming Handler

For Lambda response streaming (requires Function URL with streaming enabled):

```typescript
import { createLambdaStreamHandler } from "@jaypie/express";

export const handler = createLambdaStreamHandler(app);
```

## Event Format Support

The adapter supports both API Gateway formats:

| Format | Detection | Query Parameters |
|--------|-----------|------------------|
| API Gateway v1 (REST API) | `httpMethod` in event | Uses `multiValueQueryStringParameters` |
| Function URL / HTTP API v2 | `requestContext.http` | Parses `rawQueryString` |

### Query Parameter Handling

Both formats properly handle:

- **Multi-value parameters**: `?status=A&status=B` → `req.query.status = ["A", "B"]`
- **Bracket notation**: `?tags[]=js&tags[]=ts` → `req.query.tags = ["js", "ts"]`
- **Single values**: `?page=1` → `req.query.page = "1"` (string, not array)

## CORS Helper

```typescript
import { cors } from "jaypie";

app.use(cors());
app.use(cors({ origin: "https://example.com" }));
app.use(cors({ origin: ["https://a.com", "https://b.com"] }));
```

## EXPRESS Constants

```typescript
import { EXPRESS } from "jaypie";

EXPRESS.HEADER.POWERED_BY    // "x-powered-by"
EXPRESS.HEADER.PROJECT_KEY   // "x-project-key"
EXPRESS.HEADER.REQUEST_ID    // "x-request-id"
EXPRESS.PROJECT.EXPRESS      // "@jaypie/express"
```

## Request Properties

The Lambda adapter provides Express-compatible request properties:

| Property | Description |
|----------|-------------|
| `req.method` | HTTP method |
| `req.url` | Full URL with query string |
| `req.path` | URL path without query string |
| `req.query` | Parsed query parameters (with array support) |
| `req.headers` | Normalized headers (lowercase keys) |
| `req.body` | Parsed body (via body-parser middleware) |
| `req.params` | Route parameters (set by Express router) |
| `req._lambdaContext` | Original Lambda context |
| `req._lambdaEvent` | Original Lambda event |

## CDK Integration

Deploy with `@jaypie/constructs`:

```typescript
import { JaypieLambda } from "@jaypie/constructs";

new JaypieLambda(this, "Api", {
  entry: "src/lambda.ts",
  handler: "handler",
  environment: {
    PROJECT_ENV: "production",
  },
});
```

## Local Testing

The package includes Docker/SAM CLI setups for local testing in `packages/express/docker/`. See that directory's documentation for details.
