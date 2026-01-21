---
description: Fabric service patterns and adapters
related: services, errors, tools
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
import { fabricLlmTool } from "@jaypie/fabric";

const tools = [fabricLlmTool(greetService)];
// Available to LLM as function call
```

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

suite.register(userService, "users");
suite.register(userListService, "users");

// Access services
suite.services;                    // ServiceMeta[] - metadata for listing
suite.getServiceFunctions();       // Service[] - actual functions
suite.execute("user_get", { id }); // Direct execution
```

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

