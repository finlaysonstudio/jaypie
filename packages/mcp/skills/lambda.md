---
description: AWS Lambda handler wrappers with lifecycle management
related: handlers, express, aws, cdk, services
---

# Lambda Handler

Jaypie's `@jaypie/lambda` package wraps AWS Lambda functions with lifecycle management, secrets loading, validation, and structured error handling.

## Package Overview

```typescript
import {
  lambdaHandler,
  lambdaStreamHandler,
} from "@jaypie/lambda";
```

Access through the main `jaypie` package:

```typescript
import { lambdaHandler, lambdaStreamHandler } from "jaypie";
```

## Standard Handler

```typescript
import { lambdaHandler } from "jaypie";

export const handler = lambdaHandler(
  async (event, context) => {
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  },
  {
    name: "myHandler",
    secrets: ["MY_SECRET"],
    validate: [(event) => { /* validation */ }],
    setup: [async () => { /* initialization */ }],
    teardown: [async () => { /* cleanup */ }],
  }
);
```

## Streaming Handler

For Lambda response streaming (requires Function URL with streaming enabled):

```typescript
import { lambdaStreamHandler } from "jaypie";

export const handler = lambdaStreamHandler(async (event, context) => {
  context.responseStream.write("event: data\ndata: {}\n\n");
});
```

### Stream Formats

```typescript
// SSE format (default) - text/event-stream
export const sseHandler = lambdaStreamHandler(myHandler, { format: "sse" });

// NLJSON format - application/x-ndjson
export const nljsonHandler = lambdaStreamHandler(myHandler, { format: "nljson" });
```

## Handler Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `chaos` | `string` | - | Chaos testing mode |
| `contentType` | `string` | Based on format | Content type (streaming only) |
| `format` | `"sse"` \| `"nljson"` | `"sse"` | Stream format (streaming only) |
| `name` | `string` | function name | Handler name for logging |
| `secrets` | `string[]` | `[]` | AWS secrets to load into `process.env` |
| `setup` | `Function[]` | `[]` | Functions to run before handler |
| `teardown` | `Function[]` | `[]` | Functions to run after handler (always runs) |
| `throw` | `boolean` | `false` | Re-throw errors instead of returning error response |
| `unavailable` | `boolean` | `false` | Return 503 Unavailable immediately |
| `validate` | `Function[]` | `[]` | Validation functions to run before handler |

## Parameter Order Flexibility

Both handlers accept parameters in either order:

```typescript
// Handler first (preferred)
lambdaHandler(myFunction, { name: "test" });

// Options first (also valid)
lambdaHandler({ name: "test" }, myFunction);
```

## Lifecycle Flow

1. **Logger initialization** - Re-init logger, tag with `invoke` and `handler`
2. **Secrets loading** - If `secrets` provided, load via `loadEnvSecrets`
3. **Validate** - Run validation functions
4. **Setup** - Run setup functions
5. **Handler** - Execute main handler logic
6. **Teardown** - Run teardown functions (always runs)
7. **Response** - Return result or error body

## Error Handling

| Error Type | Behavior |
|------------|----------|
| Jaypie errors (`isProjectError: true`) | Returns error body, logs at debug level |
| Unhandled errors | Wrapped in `UnhandledError`, logs at fatal level |
| With `throw: true` | Re-throws error instead of returning error response |

### Streaming Error Formats

- **SSE**: `event: error\ndata: {...}\n\n`
- **NLJSON**: `{"error":{...}}\n`

## Types

```typescript
import type {
  LambdaContext,
  LambdaHandlerFunction,
  LambdaHandlerOptions,
  LambdaStreamContext,
  LambdaStreamHandlerOptions,
  ResponseStream,
  StreamFormat,
} from "jaypie";
```

## Express vs Lambda

| Use Case | Package |
|----------|---------|
| Express app on Lambda | `@jaypie/express` with `createLambdaHandler` |
| Direct Lambda handler | `@jaypie/lambda` with `lambdaHandler` |
| Response streaming | Either package has stream support |

## Testing

```typescript
import { original } from "@jaypie/testkit";

// Access original (unmocked) handlers
const { lambdaHandler, lambdaStreamHandler } = original.lambda;
```

## CDK Integration

Deploy with `@jaypie/constructs`:

```typescript
import { JaypieLambda } from "@jaypie/constructs";

new JaypieLambda(this, "Handler", {
  entry: "src/handler.ts",
  handler: "handler",
  secrets: ["MY_SECRET"],
});
```
