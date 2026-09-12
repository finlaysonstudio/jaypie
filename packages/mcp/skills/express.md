---
description: Express.js handler for AWS Lambda with API Gateway support
related: aws, cdk, cors, handlers, lambda, services, streaming
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
  fabric: false,     // Wrap return with fabricApiResponse before res.json (default false)
  locals: {},        // Values passed to res.locals
  logBody: true,     // Include the request body in the request log
  name: "handler",   // Handler name for logging
  scrub: true,       // Withhold error detail from the client, the log, or both
  secrets: [],       // AWS Secrets names to load into process.env
  sensitiveHeaders: [], // Header names redacted in addition to the defaults
  setup: async (req, res) => {},    // Pre-handler setup
  teardown: async (req, res) => {}, // Post-handler cleanup
  unavailable: false, // Return 503 immediately if true
  validate: async (req, res) => {}, // Validation before handler
});
```

### Request Logging

`expressHandler` logs a summary of every request. Two options control what that
summary carries; both also apply to `expressStreamHandler`.

```typescript
app.post(
  "/webhook/github",
  expressHandler(handleGitHubWebhook, {
    logBody: false,
    sensitiveHeaders: ["x-hub-signature-256"],
  }),
);
```

- `sensitiveHeaders` is **additive**. `EXPRESS.HEADER.SENSITIVE`
  (`authorization`, `cookie`, `set-cookie`) is always redacted; these names are
  redacted as well. Matching is case-insensitive.
- `logBody: false` omits the body entirely, for a route whose payload is
  third-party data the log should not carry.

Reach for these on inbound webhook routes, where the provider sends a signature
header and a body neither of which belongs in the log.

### fabricApiResponse and `{ fabric: true }`

Return plain domain objects and opt into the canonical Jaypie API envelope:

```typescript
import { expressHandler, fabricApiResponse } from "jaypie";

// Handler option — wraps the return value automatically
app.get(
  "/ping",
  expressHandler(async (req) => ping(req.query), { fabric: true }),
);

// Standalone helper — same rules as `{ fabric: true }`
fabricApiResponse({ id: "1" });        // { data: { id: "1" } }
fabricApiResponse([{ id: "1" }]);      // { data: [{ id: "1" }] }
fabricApiResponse({ data: {...} });    // passthrough
fabricApiResponse({ errors: [...] });  // passthrough
fabricApiResponse(null);               // { data: null }
```

Wrap rules: only `{ data }` alone or `{ errors }` alone pass through. Anything else (including `{ data, other }`) gets wrapped as `{ data: value }`.

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

`createLambdaStreamHandler` wraps with `awslambda.streamifyResponse` only when the Lambda runtime global exists. Elsewhere (unit tests, local servers) it returns the unwrapped `(event, responseStream, context)` handler, so importing the streaming entry point never throws. Without `awslambda.HttpResponseStream`, the body writes straight to the provided stream with no status/headers prelude.

### Options

Both factories accept an optional second argument:

| Option | Default | Effect |
|--------|---------|--------|
| `name` | `"createLambdaHandler"` / `"createLambdaStreamHandler"` | Label on unhandled adapter error output (`[name] Unhandled error:`) |

```typescript
export const handler = createLambdaStreamHandler(app, { name: "streamApi" });
```

Lifecycle options such as `format`, `secrets`, `setup`, and `validate` belong on each route's `expressHandler` / `expressStreamHandler`, not the adapter.

### Cookies

Both adapters emit every `Set-Cookie` value separately, so cookie-session auth (multiple cookies per response, chunked session cookies) works unchanged:

```typescript
app.get("/callback", (req, res) => {
  res.cookie("appSession", token, { path: "/" });
  res.clearCookie("auth_verification", { path: "/" });
  res.json({ ok: true });
});
```

`createLambdaHandler` returns them in `cookies` on the v2 response payload. `createLambdaStreamHandler` passes them as `metadata.cookies` in the response-streaming prelude. Neither folds them into a single comma-separated `set-cookie` header, which would be unparseable because expiry dates contain commas.

### Deferred headers (`on-headers`)

Both adapters commit headers through `writeHead`, resolved at call time, so `on-headers` listeners fire exactly once before the first body byte:

```typescript
app.get("/callback", (req, res) => {
  onHeaders(res, () => res.cookie("appSession", token, { path: "/" }));
  res.redirect("/");
});
```

Libraries that defer header or cookie writes this way work unchanged: `express-openid-connect` (session cookie), `express-session`, `morgan`, `compression`. `res.flushHeaders()` and `res._implicitHeader()` both route through the same path.

### LLM Observability auto-flush

`createLambdaHandler` and `createLambdaStreamHandler` call `flushLlmObs()` from `@jaypie/datadog` in their `finally` block, so buffered Datadog LLM Obs spans flush before the Lambda freezes — even when the Express app errors. No-op unless `DD_LLMOBS_ENABLED` is truthy; never affects the response. No per-handler flush code is required.

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
import { EXPRESS } from "@jaypie/express";

EXPRESS.HEADER.SENSITIVE  // ["authorization", "cookie", "set-cookie"]
EXPRESS.PATH.ANY          // RegExp matching every path in Express 4 and 5
EXPRESS.PATH.ID           // "/:id"
EXPRESS.PATH.ROOT         // RegExp matching the root path
```

Header *names* live on `HTTP.HEADER` in `@jaypie/kit`
(`HTTP.HEADER.POWERED_BY`, `HTTP.HEADER.PROJECT_KEY`,
`HTTP.HEADER.REQUEST_ID`), not on `EXPRESS`.

## Request Properties

The Lambda adapter provides Express-compatible request properties:

| Property | Description |
|----------|-------------|
| `req.method` | HTTP method |
| `req.url` | Full URL with query string |
| `req.path` | URL path without query string |
| `req.query` | Parsed query parameters (with array support) |
| `req.headers` | Normalized headers (lowercase keys) |
| `req.body` | Pre-parsed body (JSON auto-parsed, text as string; no middleware needed) |
| `req.params` | Route parameters (set by Express router) |
| `req._lambdaContext` | Original Lambda context |
| `req._lambdaEvent` | Original Lambda event |

## Session Report

`expressHandler` and `expressStreamHandler` automatically call `log.report()` with request metadata before the session's `log.teardown()` (see `skill("logs")`):

```typescript
{
  method: "GET",
  path: "/workflows/:id/messages", // UUID segments normalized to :id
  query: "limit=10",
  contentType: "",
  contentLength: 0,
  status: "200",
  parameters: { id: "123e4567-e89b-12d3-a456-426614174000" }, // req.params, only when non-empty
}
```

`parameters` mirrors Express's `req.params` so the original route parameter values survive path normalization for aggregation.

## CDK Integration

Deploy with `@jaypie/constructs`:

```typescript
import { JaypieLambda } from "@jaypie/constructs";

new JaypieLambda(this, "Api", {
  code: "../api/dist",
  handler: "index.handler",
  environment: {
    PROJECT_ENV: "production",
  },
});
```

## Local Testing

The package includes Docker/SAM CLI setups for local testing in `packages/express/docker/`. See that directory's documentation for details.

## Lambda ESM Bundling

When deploying Express to Lambda with ESM, use esbuild with `.mjs` output.

### Config File Approach

Create `esbuild.config.mjs`:

```javascript
import { build } from "esbuild";
import { builtinModules } from "module";

await build({
  entryPoints: ["index.ts"],
  bundle: true,
  minify: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile: "dist/index.mjs",
  external: [
    "@aws-sdk/*",
    ...builtinModules,
    ...builtinModules.map(m => `node:${m}`),
  ],
  banner: {
    js: `import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname } from "path";
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);`,
  },
});
```

Add to package.json:

```json
{
  "scripts": {
    "build": "node esbuild.config.mjs"
  }
}
```

### Why .mjs?

Node.js always treats `.mjs` files as ESM, regardless of `package.json`. No need to emit extra files.

### Why createRequire banner?

Some dependencies use `require()` even when bundled. The banner provides CommonJS shims for `require`, `__filename`, and `__dirname`.

### CDK Integration

Reference the `.mjs` file in your CDK stack:

```typescript
new JaypieLambda(this, "Api", {
  code: "../api/dist",     // Pre-built bundle
  handler: "index.handler", // Lambda finds index.mjs automatically
});
```

## See Also

- **`skill("streaming")`** - Full guide to `expressStreamHandler` and `createLambdaStreamHandler`
