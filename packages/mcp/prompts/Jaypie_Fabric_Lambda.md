---
description: AWS Lambda integration with fabricService for event processing and callbacks
include: "**/lambda/**"
---

# Jaypie Fabric Lambda Adapter

The Lambda adapter (`@jaypie/fabric/lambda`) wraps Jaypie service handlers for use as AWS Lambda handlers, providing automatic event parsing, secrets management, and lifecycle hooks.

**See also:** [Jaypie_Fabric_Package.md](Jaypie_Fabric_Package.md) for core fabricService documentation.

## Installation

```bash
npm install @jaypie/fabric
```

## Quick Start

```typescript
import { fabricService } from "@jaypie/fabric";
import { fabricLambda } from "@jaypie/fabric/lambda";

const handler = fabricService({
  alias: "processOrder",
  input: { orderId: { type: String } },
  service: async ({ orderId }) => {
    return { orderId, status: "processed" };
  },
});

export const lambdaHandler = fabricLambda({ service: handler });
```

## fabricLambda

Wraps a fabricService for use as an AWS Lambda handler.

### Options

| Option | Type | Description |
|--------|------|-------------|
| `service` | `Service` | Required. The service handler to wrap |
| `chaos` | `string` | Chaos testing mode |
| `name` | `string` | Override handler name for logging (default: handler.alias) |
| `onComplete` | `OnCompleteCallback` | Called with handler's return value on success |
| `onError` | `OnErrorCallback` | Receives errors reported via `context.onError()` in service |
| `onFatal` | `OnFatalCallback` | Receives fatal errors (thrown or via `context.onFatal()`) |
| `onMessage` | `OnMessageCallback` | Receives messages from `context.sendMessage` |
| `secrets` | `string[]` | AWS secrets to load into process.env |
| `setup` | `LifecycleFunction[]` | Functions to run before handler |
| `teardown` | `LifecycleFunction[]` | Functions to run after handler (always runs) |
| `throw` | `boolean` | Re-throw errors instead of returning error response |
| `unavailable` | `boolean` | Return 503 Unavailable immediately |
| `validate` | `ValidatorFunction[]` | Validation functions to run before handler |

## Lifecycle Callbacks

Services can use context callbacks to report progress, errors, and completion:

```typescript
import { fabricService } from "@jaypie/fabric";
import { fabricLambda } from "@jaypie/fabric/lambda";

const handler = fabricService({
  alias: "evaluate",
  input: { jobId: { type: String } },
  service: async ({ jobId }, context) => {
    context?.sendMessage?.({ content: `Starting job ${jobId}` });

    // Handle recoverable errors without throwing
    try {
      await riskyOperation();
    } catch (err) {
      context?.onError?.(err); // Reports error but continues
    }

    // For fatal errors, either throw or call context.onFatal()
    if (criticalFailure) {
      context?.onFatal?.(new Error("Cannot continue"));
    }

    return { jobId, status: "complete" };
  },
});

export const lambdaHandler = fabricLambda({
  service: handler,
  onComplete: (response) => {
    console.log("Done:", JSON.stringify(response, null, 2));
  },
  onError: (error) => {
    // Recoverable errors reported via context.onError()
    console.error("Warning:", error);
  },
  onFatal: (error) => {
    // Fatal errors (thrown or via context.onFatal())
    console.error("Fatal:", error);
  },
  onMessage: (msg) => {
    console.log(`[${msg.level || "info"}] ${msg.content}`);
  },
});
```

**Error handling**: Services receive `context.onError()` and `context.onFatal()` callbacks to report errors without throwing. Any error that escapes the service (is thrown) is treated as fatal and routes to `onFatal`. If `onFatal` is not provided, thrown errors fall back to `onError`. Callback errors are swallowed to ensure failures never halt service execution.

## Secrets Management

Automatically loads AWS Secrets Manager values into `process.env`:

```typescript
export const lambdaHandler = fabricLambda({
  service: handler,
  secrets: ["ANTHROPIC_API_KEY", "DATABASE_URL"],
});
// Before handler runs, secrets are fetched and available as:
// process.env.ANTHROPIC_API_KEY
// process.env.DATABASE_URL
```

## Lifecycle Hooks

### setup

Functions to run before the handler:

```typescript
export const lambdaHandler = fabricLambda({
  service: handler,
  setup: [
    async () => {
      await initializeDatabase();
    },
    async () => {
      await warmCache();
    },
  ],
});
```

### teardown

Functions to run after the handler (always runs, even on error):

```typescript
export const lambdaHandler = fabricLambda({
  service: handler,
  teardown: [
    async () => {
      await closeConnections();
    },
  ],
});
```

### validate

Validation functions to run before handler. If any returns falsy or throws, handler is skipped:

```typescript
export const lambdaHandler = fabricLambda({
  service: handler,
  validate: [
    (event) => event.headers?.authorization !== undefined,
    async (event) => {
      const token = event.headers?.authorization;
      return await verifyToken(token);
    },
  ],
});
```

## Event Handling

The adapter uses `getMessages()` from `@jaypie/aws` to extract messages from various event types:

- **SQS Events**: Extracts message body from each record
- **SNS Events**: Extracts message from SNS notification
- **Direct Invocation**: Uses event body directly

### Single vs Multiple Messages

```typescript
// Single message returns single response
const result = await lambdaHandler(singleMessageEvent);
// result: { orderId: "123", status: "processed" }

// Multiple messages return array of responses
const results = await lambdaHandler(sqsBatchEvent);
// results: [
//   { orderId: "123", status: "processed" },
//   { orderId: "456", status: "processed" },
// ]
```

## Complete Example

```typescript
import { fabricService } from "@jaypie/fabric";
import { fabricLambda } from "@jaypie/fabric/lambda";
import log from "@jaypie/logger";

const processOrderHandler = fabricService({
  alias: "processOrder",
  description: "Process an incoming order",
  input: {
    orderId: { type: String, description: "Order ID to process" },
    priority: { type: [1, 2, 3], default: 2 },
    rush: { type: Boolean, default: false },
  },
  service: async ({ orderId, priority, rush }, context) => {
    context?.sendMessage?.({ content: `Processing order ${orderId}` });

    if (rush) {
      context?.sendMessage?.({ content: "Rush order - expediting", level: "warn" });
    }

    // Process the order...
    await processOrder(orderId, { priority, rush });

    context?.sendMessage?.({ content: "Order processed successfully" });
    return { orderId, status: "complete", priority, rush };
  },
});

export const handler = fabricLambda({
  service: processOrderHandler,
  name: "order-processor",
  secrets: ["DATABASE_URL", "STRIPE_API_KEY"],
  setup: [
    async () => {
      await connectToDatabase();
    },
  ],
  teardown: [
    async () => {
      await flushMetrics();
    },
  ],
  onMessage: (msg) => {
    log[msg.level || "info"](msg.content);
  },
});
```

## Error Handling

### Default Behavior

Errors are caught and returned as structured error responses:

```typescript
// On error, returns:
{
  error: true,
  message: "Error message",
  statusCode: 500,
  // ... additional error details
}
```

### Re-throwing Errors

Set `throw: true` to re-throw errors (useful for SQS retry behavior):

```typescript
export const lambdaHandler = fabricLambda({
  service: handler,
  throw: true, // Errors will propagate, triggering SQS retry
});
```

## TypeScript Types

```typescript
import type {
  FabricLambdaConfig,
  FabricLambdaOptions,
  LambdaContext,
  OnCompleteCallback,
  OnErrorCallback,
  OnFatalCallback,
  OnMessageCallback,
} from "@jaypie/fabric/lambda";
```

## Exports

```typescript
// @jaypie/fabric/lambda
export { fabricLambda } from "./fabricLambda.js";

export type {
  FabricLambdaConfig,
  FabricLambdaOptions,
  LambdaContext,
  OnCompleteCallback,
  OnErrorCallback,
  OnFatalCallback,
  OnMessageCallback,
} from "./types.js";
```

## Related

- [Jaypie_Fabric_Package.md](Jaypie_Fabric_Package.md) - Core fabricService and type conversion
- [Jaypie_Init_Lambda_Package.md](Jaypie_Init_Lambda_Package.md) - Setting up Lambda projects
