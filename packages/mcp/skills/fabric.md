---
description: Fabric service patterns and adapters (pre-1.0)
related: errors, handlers, mcp, services, websockets
---

# Fabric Services

Fabric provides a unified service pattern that works across CLI, Lambda, LLM tools, and MCP.

## Core Concept

Define a service once, deploy it anywhere:

```typescript
import { fabricService } from "@jaypie/fabric";

const greetService = fabricService({
  alias: "greet",
  description: "Greet a user by name",
  input: {
    name: {
      type: String,
      required: true,
      description: "Name to greet",
    },
  },
  service: async ({ name }) => {
    return `Hello, ${name}!`;
  },
});
```

## Adapters

### Lambda Handler

```typescript
import { fabricLambdaHandler } from "@jaypie/fabric";

export const handler = fabricLambdaHandler(greetService);
// Invoked via Lambda with { name: "World" }
```

### CLI Command

```typescript
import { fabricCommand } from "@jaypie/fabric";

const program = new Command();
program.addCommand(fabricCommand(greetService));
// $ cli greet --name World
```

Array inputs are variadic and accept three forms. `type: Array` and `type: []`
behave identically; a typed array such as `[String]` additionally converts each
element.

```bash
cli chat --messages '[{"role":"user","content":"hi"}]'  # JSON array string
cli grant --permissions 'self:*,admin:read'             # comma or tab delimited
cli tag --labels alpha beta gamma                       # separate arguments
```

A lone argument that is neither JSON nor delimited becomes a single-element
array. Objects inside an array input are only reachable through the JSON form.

### MCP Tool

```typescript
import { fabricMcp, FabricMcpServer } from "@jaypie/fabric/mcp";

// Single service registration
fabricMcp({ service: greetService, server });

// Multi-service server (preferred)
const server = FabricMcpServer({
  name: "my-server",
  version: "1.0.0",
  services: [greetService, searchService],
});
// Available as MCP tools "greet" and "search"
```

### LLM Tool

```typescript
import { fabricTool } from "@jaypie/fabric/llm";

const { tool } = fabricTool({ service: greetService });
const tools = [tool];
// Available to LLM as function call
```

Declare `readOnly: true` on a service (or on the `fabricTool` config) when it
has no side effects. The annotation reaches `LlmTool.readOnly`, so
`toolkit.filter({ readOnly: true })` derives a toolkit safe for verification
passes. See `skill("llm")`.

```typescript
const searchService = fabricService({
  alias: "search",
  readOnly: true,
  service: ({ query }) => findDocuments(query),
});
```

### Express Middleware

```typescript
import { fabricHttp } from "@jaypie/fabric/http";
import { fabricExpress, FabricRouter } from "@jaypie/fabric/express";

// Wrap service with fabricHttp first (HTTP context + default input transform)
const greetHttp = fabricHttp({ service: greetService });

// Single-route middleware — alias becomes default path ("/greet")
app.get("/greet", fabricExpress({ service: greetHttp }));

// Lifecycle pass-through (forwarded to expressHandler): secrets, setup,
// teardown, validate, unavailable, locals, name, chaos
app.post(
  "/records",
  fabricExpress({
    service: recordsHttp,
    secrets: ["MONGODB_URI"],
    setup: async (req) => { /* ... */ },
  }),
);

// Multi-service router — alias-derived paths under a prefix
app.use(FabricRouter({ services: [greetHttp, searchHttp], prefix: "/api" }));
```

`fabricExpress` wraps the middleware with `expressHandler` internally, so
per-route lifecycle and observability come along for the ride (parallel to
`fabricLambda` → `lambdaHandler` and `fabricWebSocket` → `websocketHandler`).

## Service Suites

Group related services:

```typescript
import { createServiceSuite, fabricService } from "@jaypie/fabric";

const userService = fabricService({
  alias: "user_get",
  description: "Get user by ID",
  input: { id: { type: String, required: true } },
  service: async ({ id }) => User.findById(id),
});

const userListService = fabricService({
  alias: "user_list",
  description: "List all users",
  input: {},
  service: async () => User.find(),
});

const suite = createServiceSuite({
  name: "users",
  version: "1.0.0",
});

suite.register(userService, { category: "users", tags: ["immediate"] });
suite.register(userListService, { category: "users", tags: ["long"] });

// Access services
suite.services;                    // ServiceMeta[] - metadata for listing
suite.getServiceFunctions();       // Service[] - actual functions
suite.execute("user_get", { id }); // Direct execution
```

### Categories and Tags

`category` groups a service; a service has exactly one. `tags` classify across
categories; a service may carry any number. Transport surfaces curate their
mounted set from suite metadata rather than a hand-maintained list:

```typescript
suite.categories;                  // string[] - every registered category, sorted
suite.tags;                        // string[] - every registered tag, sorted
suite.getServicesByCategory("users");
suite.getServicesByTag("immediate");

// A 2-minute Express surface mounts only what fits its ceiling
const mounted = suite.filterServices(
  (meta) => !meta.tags.includes("long") && !meta.tags.includes("local"),
);
```

`ServiceMeta.tags` is always an array, empty when a service registers without
tags. Duplicate tags collapse on registration.

### Suite to MCP Server

Connect suites directly to MCP:

```typescript
import { createMcpServerFromSuite } from "@jaypie/fabric/mcp";

const server = createMcpServerFromSuite(suite, {
  name: "users-api",    // Optional override
  version: "1.0.0",
});
// All suite services now available as MCP tools
```

## Input Validation

Fabric validates inputs automatically:

```typescript
const service = fabricService({
  input: {
    email: {
      type: String,
      required: true,
      description: "User email address",
    },
    count: {
      type: Number,
      required: false,
      description: "Number of results",
    },
    status: {
      type: ["active", "inactive"] as const,
      required: false,
      description: "Filter by status",
    },
  },
  service: async ({ email, count, status }) => {
    // email: string (validated)
    // count: number | undefined
    // status: "active" | "inactive" | undefined
  },
});
```

## Error Handling

Fabric services use Jaypie errors:

```typescript
import { fabricService } from "@jaypie/fabric";
import { NotFoundError, BadRequestError } from "jaypie";

const service = fabricService({
  alias: "user_get",
  input: { id: { type: String, required: true } },
  service: async ({ id }) => {
    if (!isValidId(id)) {
      throw new BadRequestError("Invalid user ID format");
    }
    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError(`User ${id} not found`);
    }
    return user;
  },
});
```

## Best Practices

1. **Single Responsibility**: Each service does one thing
2. **Descriptive Aliases**: Use `noun_verb` format (`user_get`, `order_create`)
3. **Clear Descriptions**: Write for AI tools that need context
4. **Input Documentation**: Describe what each input expects
5. **Return Types**: Return JSON-serializable data

## See Also

- **`skill("websockets")`** - `fabricWebSocket` adapter for WebSocket Lambda handlers
