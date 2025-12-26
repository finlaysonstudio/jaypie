# @jaypie/lambda

AWS Lambda handler wrappers with Jaypie lifecycle management for standard and streaming responses.

## Purpose

Provides `lambdaHandler` and `lambdaStreamHandler` wrappers that integrate AWS Lambda functions with Jaypie's handler lifecycle, including:

- Setup/teardown lifecycle hooks
- Validation functions
- Automatic secrets loading
- Structured error handling
- Request tracing via logger tags

## Structure

```
src/
├── index.ts                    # Exports handlers and types
├── lambdaHandler.ts            # Standard Lambda handler wrapper
├── lambdaStreamHandler.ts      # Response streaming handler wrapper
└── __tests__/
    ├── index.spec.ts
    ├── lambdaHandler.spec.ts
    └── lambdaStreamHandler.spec.ts
```

## Exports

### Functions

| Export | Description |
|--------|-------------|
| `lambdaHandler` | Wraps standard Lambda functions with lifecycle management |
| `lambdaStreamHandler` | Wraps streaming Lambda functions (for `awslambda.streamifyResponse`) |

### Types

| Export | Description |
|--------|-------------|
| `LambdaContext` | AWS Lambda context with optional `awsRequestId` |
| `LambdaHandlerFunction` | Standard handler function signature |
| `LambdaHandlerOptions` | Options for standard handler (chaos, name, secrets, setup, teardown, throw, unavailable, validate) |
| `LambdaStreamContext` | Streaming Lambda context |
| `LambdaStreamHandlerOptions` | Options for streaming handler (adds `contentType`) |
| `StreamHandlerContext` | Extended context with `responseStream` |
| `ResponseStream` | Stream writer interface (`write`, `end`, `setContentType`) |
| `AwsStreamingHandler` | Raw AWS streaming handler signature |

## Usage

### Standard Handler

```typescript
import { lambdaHandler } from "@jaypie/lambda";

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

### Streaming Handler

```typescript
import { lambdaStreamHandler } from "@jaypie/lambda";

export const handler = awslambda.streamifyResponse(
  lambdaStreamHandler(async (event, context) => {
    context.responseStream.write("event: data\ndata: {}\n\n");
  }, {
    contentType: "text/event-stream",
  })
);
```

### Parameter Order Flexibility

Both handlers accept parameters in either order:

```typescript
// Handler first (preferred)
lambdaHandler(myFunction, { name: "test" });

// Options first (also valid)
lambdaHandler({ name: "test" }, myFunction);
```

## Handler Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `chaos` | `string` | - | Chaos testing mode |
| `contentType` | `string` | `"text/event-stream"` | Content type (streaming only) |
| `name` | `string` | function name | Handler name for logging |
| `secrets` | `string[]` | `[]` | AWS secrets to load into `process.env` |
| `setup` | `Function[]` | `[]` | Functions to run before handler |
| `teardown` | `Function[]` | `[]` | Functions to run after handler (always runs) |
| `throw` | `boolean` | `false` | Re-throw errors instead of returning error response |
| `unavailable` | `boolean` | `false` | Return 503 Unavailable immediately |
| `validate` | `Function[]` | `[]` | Validation functions to run before handler |

## Dependencies

### Peer Dependencies

- `@jaypie/aws` - For `loadEnvSecrets`
- `@jaypie/errors` - For `ConfigurationError`, `UnhandledError`
- `@jaypie/kit` - For `jaypieHandler`, `JAYPIE` constants
- `@jaypie/logger` - For structured logging

## Integration

### Re-exported by `jaypie`

All exports are re-exported by the main `jaypie` package:

```typescript
import { lambdaHandler, lambdaStreamHandler } from "jaypie";
```

### Mocked by `@jaypie/testkit`

The package is available in testkit's `original.lambda`:

```typescript
import { original } from "@jaypie/testkit";
const { lambdaHandler } = original.lambda;
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

- **Jaypie errors** (`isProjectError: true`): Returns error body, logs at debug level
- **Unhandled errors**: Wrapped in `UnhandledError`, logs at fatal level
- **Streaming errors**: Written as SSE `event: error` to stream
- **With `throw: true`**: Re-throws error instead of returning error response

## Commands

```bash
npm run build -w packages/lambda      # Build package
npm run test -w packages/lambda       # Run tests
npm run typecheck -w packages/lambda  # Type check
npm run lint -w packages/lambda       # Lint
```
