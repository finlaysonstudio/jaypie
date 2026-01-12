# Introduction

Complete-stack approach to multi-environment cloud application patterns. Aligns infrastructure, execution, and observability.

**Stack:** AWS/CDK, Datadog, TypeScript

**Runtime:** Node.js 20, 22, 24, 25

## Installation

```bash
npm install jaypie
```

Optional peer dependencies:

```bash
npm install @jaypie/llm        # LLM provider integrations
npm install @jaypie/mongoose   # MongoDB utilities
npm install @jaypie/constructs # CDK constructs
```

## Handler Pattern

### Basic Usage

```typescript
import { expressHandler, log } from "jaypie";

export default expressHandler(
  async (req, res) => {
    log.info("Processing");
    return { data: "result" };
  },
  {
    secrets: ["API_KEY"],
    validate: [(req) => req.body.id],
    setup: [() => initDb()],
    teardown: [() => closeDb()],
  }
);
```

### Handler Options

| Option | Type | Description |
|--------|------|-------------|
| `secrets` | `string[]` | AWS Secrets Manager names to load into `process.env` |
| `validate` | `Function[]` | Run before handler. Throw or return false to reject. |
| `setup` | `Function[]` | Run after validation, before handler. |
| `teardown` | `Function[]` | Always runs, even on error. |
| `unavailable` | `boolean` | Return 503 immediately. |
| `name` | `string` | Handler name for logging. |
| `throw` | `boolean` | Re-throw errors instead of returning error response. |

### Lifecycle Flow

Handlers execute in this sequence:

1. **Logger initialization** - Re-init logger, tag with `invoke` and `handler` name
2. **Secrets loading** - If `secrets` provided, load via `loadEnvSecrets`
3. **Validate** - Run validation functions (throw or return false to reject)
4. **Setup** - Run setup functions
5. **Handler** - Execute main handler logic
6. **Teardown** - Run teardown functions (always runs, even on error)
7. **Response** - Return result or error body

### Streaming Handlers

For Server-Sent Events (SSE) responses:

```typescript
import { lambdaStreamHandler } from "jaypie";

export const handler = awslambda.streamifyResponse(
  lambdaStreamHandler(async (event, context) => {
    context.responseStream.write("event: data\ndata: {}\n\n");
  }, {
    contentType: "text/event-stream",
  })
);
```

Express streaming:

```typescript
import { expressStreamHandler } from "jaypie";

export default expressStreamHandler(async (req, res, context) => {
  context.responseStream.write("event: message\ndata: hello\n\n");
});
```

## Error Handling

**Never throw vanilla `Error`. Always use Jaypie error classes.**

### Usage

```typescript
import { BadRequestError, NotFoundError, isJaypieError } from "jaypie";

// Throws 400 with JSON:API body - both forms work
throw BadRequestError("Missing required field");
throw new BadRequestError("Missing required field");

// Throws 404
throw NotFoundError("User not found");

// Type guard for safe property access
if (isJaypieError(error)) {
  return res.status(error.status).json(error.body());
}
```

### Error Classes

| Error | Status | Use Case |
|-------|--------|----------|
| `BadRequestError` | 400 | Invalid input |
| `UnauthorizedError` | 401 | Authentication required |
| `ForbiddenError` | 403 | Permission denied |
| `NotFoundError` | 404 | Resource not found |
| `MethodNotAllowedError` | 405 | HTTP method not supported |
| `GoneError` | 410 | Resource no longer available |
| `TeapotError` | 418 | Easter egg |
| `TooManyRequestsError` | 429 | Rate limited |
| `InternalError` | 500 | Generic server error |
| `ConfigurationError` | 500 | Application misconfiguration |
| `NotImplementedError` | 400 | Feature not implemented |
| `BadGatewayError` | 502 | Upstream service error |
| `UnavailableError` | 503 | Service unavailable |
| `GatewayTimeoutError` | 504 | Upstream timeout |
| `RejectedError` | 403 | Request rejected before processing |

### Dynamic Error Creation

```typescript
import { jaypieErrorFromStatus } from "jaypie";

const error = jaypieErrorFromStatus(404, "User not found");
```

## Utilities

### Type Coercion

```typescript
import { force } from "jaypie";

// Parse with safe defaults
const count = force.number(process.env.COUNT);      // 0 if invalid
const enabled = force.boolean("false");             // false
const items = force.array(singleItem);              // [singleItem]
const config = force.object(maybeConfig, "data");   // { data: maybeConfig } or {}
const name = force.string(value, "default");        // "default" if undefined
const positive = force.positive(value);             // 0 if negative
```

### Environment Checks

```typescript
import { isProductionEnv, isLocalEnv, isNodeTestEnv } from "jaypie";

if (isProductionEnv()) {
  // PROJECT_ENV === "production" OR PROJECT_PRODUCTION === "true"
}

if (isLocalEnv()) {
  // Development/local environment
}

if (isNodeTestEnv()) {
  // NODE_ENV === "test"
}
```

### Other Utilities

```typescript
import { uuid, sleep, cloneDeep } from "jaypie";

const id = uuid();                    // UUID v4
await sleep(1000);                    // Promise-based delay (ms)
const copy = cloneDeep(original);     // Deep clone
```

## Logging

### Basic Usage

```typescript
import { log } from "jaypie";

log.trace("Verbose tracing");
log.debug("Debug output");
log.info("Informational");
log.warn("Warning");
log.error("Error");
log.fatal("Critical error");
```

### Variable Logging

Structured logging for key-value pairs:

```typescript
log.debug.var({ userId: "123" });
// Output: { log: "debug", message: "123", var: "userId", data: "123", dataType: "string" }
```

### Request Tagging

```typescript
// Tag all subsequent logs
log.tag({ requestId: "abc-123" });

// Create child logger with additional context
const userLog = log.with({ userId: "456" });
userLog.info("User action");
```

### Lambda Initialization

Reset logger between Lambda invocations:

```typescript
log.init();  // Clears tags, resets state
```

## AWS Integration

### Secrets Resolution

The `getEnvSecret` function checks environment variables in order:

1. `SECRET_{name}` - Explicit secret reference (fetches from Secrets Manager)
2. `{name}_SECRET` - Alternative secret reference (fetches from Secrets Manager)
3. `{name}` - Direct value (returns as-is)

```typescript
import { getEnvSecret, getSecret, loadEnvSecrets } from "jaypie";

// Resolves using pattern above
const apiKey = await getEnvSecret("API_KEY");

// Direct fetch by AWS secret name
const dbUri = await getSecret("prod/mongodb-uri");

// Load multiple secrets into process.env
await loadEnvSecrets("API_KEY", "DB_PASSWORD");
```

### SQS Messaging

```typescript
import { sendMessage, getMessages, getSingletonMessage } from "jaypie";

// Send message (uses CDK_ENV_QUEUE_URL by default)
await sendMessage({ userId: "123", action: "created" });

// Parse SQS/SNS event into message bodies
const messages = getMessages(event);

// Get exactly one message or throw BadGatewayError
const message = getSingletonMessage(event);
```

## LLM Integration

Requires `@jaypie/llm` peer dependency.

### Basic Usage

```typescript
import Llm from "@jaypie/llm";

// Auto-detect provider from model
const response = await Llm.operate("Hello", { model: "claude-sonnet-4" });

// Or instantiate with provider
const llm = new Llm("openai", { model: "gpt-4o" });
const result = await llm.operate("What is 2+2?");
```

### With Tools

```typescript
import Llm, { Toolkit } from "@jaypie/llm";

const toolkit = new Toolkit([
  {
    name: "get_weather",
    description: "Get current weather for a city",
    parameters: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
    },
    call: async ({ city }) => `Weather in ${city}: sunny, 72F`,
  },
]);

const response = await Llm.operate("What's the weather in NYC?", {
  model: "claude-sonnet-4",
  tools: toolkit,
});
```

### Streaming

```typescript
for await (const chunk of Llm.stream("Tell me a story")) {
  process.stdout.write(chunk.content || "");
}
```

## Testing

Requires `@jaypie/testkit` dev dependency.

### Setup

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ["@jaypie/testkit/testSetup"],
  },
});
```

Or manually extend matchers:

```typescript
import { expect } from "vitest";
import { matchers } from "@jaypie/testkit";

expect.extend(matchers);
```

### Mocking Jaypie

```typescript
import { vi } from "vitest";

// Mock entire jaypie package
vi.mock("jaypie", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});

// Or mock specific packages
vi.mock("@jaypie/express", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return { expressHandler: testkit.expressHandler };
});
```

### Custom Matchers

```typescript
// Error matchers
expect(() => fn()).toThrowJaypieError();
expect(() => fn()).toThrowBadRequestError();
expect(() => fn()).toThrowNotFoundError();

// Type matchers
expect(MyClass).toBeClass();
expect(mockFn).toBeMockFunction();

// Format matchers
expect(value).toMatchUuid();
expect(value).toMatchJwt();
expect(value).toMatchBase64();
expect(value).toMatchMongoId();

// Schema matchers
import { jsonApiSchema } from "@jaypie/testkit";
expect(response).toMatchSchema(jsonApiSchema);
```

### Log Spying

```typescript
import { log } from "jaypie";
import { spyLog, restoreLog } from "@jaypie/testkit";

beforeEach(() => {
  spyLog(log);
});

afterEach(() => {
  restoreLog(log);
});

it("logs correctly", () => {
  myFunction();
  expect(log.info).toHaveBeenCalledWith("expected message");
});
```

## CDK Constructs

Requires `@jaypie/constructs` dependency.

```typescript
import { JaypieLambda, JaypieDistribution } from "@jaypie/constructs";

const fn = new JaypieLambda(this, "Api", {
  code: "dist",
  handler: "index.handler",
  secrets: ["MONGODB_URI"],
});

new JaypieDistribution(this, "Dist", {
  handler: fn,
  host: "api.example.com",
  zone: "example.com",
});
```

Constructs apply Datadog layers, tags, and log forwarding automatically.

## Code Guidelines

### Function Parameters

Use object parameters:

```typescript
// Preferred: object parameters
function createUser({ name, email, role }) { ... }

// Allowed: single required + config object
function fetchUser(userId, { includeProfile, cache } = {}) { ... }

// Never: ordered parameters
function badFunction(name, email, role, active) { ... }  // Don't do this
```

### Alphabetization

Alphabetize imports, object keys, and any lists where order doesn't matter:

```typescript
import { BadRequestError, log, NotFoundError, uuid } from "jaypie";

const config = {
  apiKey: "...",
  database: "...",
  timeout: 5000,
};
```

## Packages

### Core

| Package | Exports |
|---------|---------|
| `jaypie` | Re-exports aws, datadog, errors, express, kit, lambda, logger |
| `@jaypie/kit` | `force`, `uuid`, `sleep`, `jaypieHandler`, `JAYPIE`, `HTTP` |
| `@jaypie/errors` | Error classes, `isJaypieError`, `jaypieErrorFromStatus` |
| `@jaypie/logger` | `log` with trace ID support |

### Handlers

| Package | Exports |
|---------|---------|
| `@jaypie/express` | `expressHandler`, `expressStreamHandler`, `cors` |
| `@jaypie/lambda` | `lambdaHandler`, `lambdaStreamHandler` |

### Infrastructure

| Package | Exports |
|---------|---------|
| `@jaypie/constructs` | `JaypieLambda`, `JaypieDistribution`, `JaypieEnvSecret`, `CDK` |

### Integrations

| Package | Exports |
|---------|---------|
| `@jaypie/aws` | `getSecret`, `getEnvSecret`, `sendMessage`, `getMessages`, `loadEnvSecrets` |
| `@jaypie/datadog` | `submitMetric`, `DATADOG` |
| `@jaypie/llm` | `Llm`, `Toolkit`, providers: Anthropic, OpenAI, Gemini, OpenRouter |
| `@jaypie/mongoose` | `connectMongo`, `disconnect` |

### Testing

| Package | Exports |
|---------|---------|
| `@jaypie/testkit` | Mock factories, custom matchers, `spyLog`, `restoreLog` |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `PROJECT_ENV` | Environment: local, sandbox, production |
| `PROJECT_KEY` | Project identifier for logging |
| `LOG_LEVEL` | trace, debug, info, warn, error |
| `LOG_FORMAT` | json, text |
| `SECRET_*` | Pattern for secrets: `SECRET_MONGODB_URI` fetches from Secrets Manager |
| `CDK_ENV_QUEUE_URL` | Default SQS queue URL |
| `ANTHROPIC_API_KEY` | Anthropic API key for LLM |
| `OPENAI_API_KEY` | OpenAI API key for LLM |

## Links

- [API Reference](/docs/api/kit)
- [GitHub](https://github.com/finlaysonstudio/jaypie)
- [npm](https://www.npmjs.com/package/jaypie)
