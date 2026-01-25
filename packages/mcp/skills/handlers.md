---
description: Overview of Jaypie handler patterns and lifecycle management
related: express, fabric, lambda, services, streaming, websockets
---

# Jaypie Handlers

Jaypie provides handler wrappers that add lifecycle management, error handling, validation, and observability to your functions. All handlers share a common lifecycle pattern but are tailored for different execution contexts.

## Handler Lifecycle

All Jaypie handlers follow this execution flow:

1. **Logger initialization** - Re-init logger with invocation context
2. **Unavailable check** - Return 503 immediately if `unavailable: true`
3. **Secrets loading** - Load AWS secrets into `process.env` (if configured)
4. **Validation** - Run validation functions
5. **Setup** - Run pre-handler functions
6. **Handler** - Execute main logic
7. **Teardown** - Run cleanup functions (always executes)
8. **Response** - Return result or formatted error

## Common Options

All handlers accept these options:

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Handler name for logging |
| `setup` | `Function[]` | Pre-handler functions |
| `teardown` | `Function[]` | Cleanup functions (always run) |
| `unavailable` | `boolean` | Return 503 immediately |
| `validate` | `Function[]` | Validation functions |

## Handler Types

### Core Handler (`@jaypie/kit`)

The foundational handler used internally by other wrappers:

```typescript
import { jaypieHandler } from "@jaypie/kit";

const handler = jaypieHandler(async (input) => {
  return processInput(input);
}, {
  name: "myHandler",
  validate: [(input) => { /* validation */ }],
  setup: [async () => { /* init */ }],
  teardown: [async () => { /* cleanup */ }],
});
```

For details, see the `@jaypie/kit` package documentation.

---

### Lambda Handler (`@jaypie/lambda`)

For AWS Lambda functions with optional secrets loading and streaming support.

```typescript
import { lambdaHandler, lambdaStreamHandler } from "jaypie";

export const handler = lambdaHandler(async (event, context) => {
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
}, {
  secrets: ["MY_SECRET"],
});

// Streaming variant
export const streamHandler = lambdaStreamHandler(async (event, context) => {
  context.responseStream.write("data: hello\n\n");
}, { format: "sse" });
```

**See:** `skill("lambda")` for full documentation.

---

### Express Handler (`@jaypie/express`)

For Express.js routes and Lambda-to-Express adapters.

```typescript
import { expressHandler, createLambdaHandler } from "jaypie";

// Express route handler
app.get("/api/users", expressHandler(async (req, res) => {
  return { users: [] };
}));

// Convert Express app to Lambda
export const handler = createLambdaHandler(app);
```

**See:** `skill("express")` for full documentation.

---

### Fabric Handler (`@jaypie/fabric`) *(Pre-1.0)*

Define a service once, deploy anywhere (Lambda, CLI, MCP, LLM tools).

```typescript
import { fabricService, fabricLambdaHandler } from "@jaypie/fabric";

const greetService = fabricService({
  alias: "greet",
  description: "Greet a user",
  input: {
    name: { type: String, required: true },
  },
  service: async ({ name }) => `Hello, ${name}!`,
});

// As Lambda
export const handler = fabricLambdaHandler(greetService);

// As CLI command
program.addCommand(fabricCommand(greetService));

// As MCP tool
fabricMcp({ service: greetService, server });
```

**See:** `skill("fabric")` for full documentation.

## Choosing a Handler

| Use Case | Handler |
|----------|---------|
| Direct Lambda function | `lambdaHandler` |
| Lambda response streaming | `lambdaStreamHandler` |
| Express app on Lambda | `createLambdaHandler` |
| Express route | `expressHandler` |
| Multi-platform service | `fabricService` + adapters |
| Custom wrapper | `jaypieHandler` (from kit) |

## Error Handling

All handlers catch errors and format responses:

- **Jaypie errors** (`isProjectError: true`): Return error body, log at debug level
- **Unhandled errors**: Wrap in `UnhandledError`, log at fatal level
- **With `throw: true`**: Re-throw instead of formatting (for custom handling)

```typescript
import { NotFoundError, BadRequestError } from "jaypie";

const handler = lambdaHandler(async (event) => {
  if (!event.id) throw new BadRequestError("ID required");
  const item = await getItem(event.id);
  if (!item) throw new NotFoundError("Item not found");
  return item;
});
```

## Testing

```typescript
import { original } from "@jaypie/testkit";

// Access unmocked handlers
const { lambdaHandler } = original.lambda;
const { expressHandler } = original.express;
```

## See Also

- **`skill("streaming")`** - Response streaming with SSE and NLJSON for real-time data delivery
- **`skill("websockets")`** - WebSocket APIs for bidirectional real-time communication
