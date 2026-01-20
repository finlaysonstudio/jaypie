---
description: MCP server tool registration from fabricService
---

# Jaypie Fabric MCP Adapter

The MCP adapter (`@jaypie/fabric/mcp`) registers Jaypie service handlers as MCP (Model Context Protocol) tools for use with MCP servers.

**See also:** [Jaypie_Fabric_Package.md](Jaypie_Fabric_Package.md) for core fabricService documentation.

## Installation

```bash
npm install @jaypie/fabric @modelcontextprotocol/sdk
```

## Quick Start

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fabricService } from "@jaypie/fabric";
import { fabricMcp } from "@jaypie/fabric/mcp";

const handler = fabricService({
  alias: "greet",
  description: "Greet a user by name",
  input: {
    userName: { type: String, description: "The user's name" },
    loud: { type: Boolean, default: false, description: "Shout the greeting" },
  },
  service: ({ userName, loud }) => {
    const greeting = `Hello, ${userName}!`;
    return loud ? greeting.toUpperCase() : greeting;
  },
});

const server = new McpServer({ name: "my-server", version: "1.0.0" });
fabricMcp({ service: handler, server });
```

## fabricMcp

Registers a fabricService as an MCP tool.

### Options

| Option | Type | Description |
|--------|------|-------------|
| `service` | `Service` | Required. The service handler to adapt |
| `server` | `McpServer` | Required. The MCP server to register with |
| `name` | `string` | Override tool name (defaults to handler.alias) |
| `description` | `string` | Override tool description (defaults to handler.description) |
| `onComplete` | `OnCompleteCallback` | Called with tool's return value on success |
| `onError` | `OnErrorCallback` | Receives errors reported via `context.onError()` in service |
| `onFatal` | `OnFatalCallback` | Receives fatal errors (thrown or via `context.onFatal()`) |
| `onMessage` | `OnMessageCallback` | Receives messages from `context.sendMessage` in service |

### Basic Usage

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fabricService } from "@jaypie/fabric";
import { fabricMcp } from "@jaypie/fabric/mcp";

const calculateHandler = fabricService({
  alias: "calculate",
  description: "Perform a mathematical calculation",
  input: {
    operation: { type: ["add", "subtract", "multiply", "divide"] },
    a: { type: Number, description: "First operand" },
    b: { type: Number, description: "Second operand" },
  },
  service: ({ operation, a, b }) => {
    switch (operation) {
      case "add": return a + b;
      case "subtract": return a - b;
      case "multiply": return a * b;
      case "divide": return a / b;
    }
  },
});

const server = new McpServer({ name: "calculator", version: "1.0.0" });
fabricMcp({ service: calculateHandler, server });
```

### Overriding Name and Description

```typescript
fabricMcp({
  service: handler,
  server,
  name: "math_calculate",
  description: "A tool for performing basic math operations",
});
```

### Lifecycle Callbacks

Services can use context callbacks to report progress, errors, and completion:

```typescript
const handler = fabricService({
  alias: "evaluate",
  input: { jobId: { type: String } },
  service: async ({ jobId }, context) => {
    context?.sendMessage?.({ content: `Processing ${jobId}` });

    try {
      await riskyOperation();
    } catch (err) {
      context?.onError?.(err); // Reports error but continues
    }

    return { jobId, status: "complete" };
  },
});

fabricMcp({
  service: handler,
  server,
  onComplete: (result) => console.log("Tool completed:", result),
  onError: (error) => console.warn("Recoverable error:", error),
  onFatal: (error) => console.error("Fatal error:", error),
  onMessage: (msg) => console.log(`[${msg.level || "info"}] ${msg.content}`),
});
```

**Error handling**: Services receive `context.onError()` and `context.onFatal()` callbacks to report errors without throwing. Any error that escapes the service (is thrown) is treated as fatal and routes to `onFatal`. If `onFatal` is not provided, thrown errors fall back to `onError`. Callback errors are swallowed to ensure failures never halt service execution.

## Response Format

The adapter formats handler responses as MCP text content:

```typescript
// Handler returns:
{ result: 42, status: "complete" }

// MCP response:
{
  content: [{
    type: "text",
    text: '{"result":42,"status":"complete"}'
  }]
}
```

For string responses:

```typescript
// Handler returns:
"Hello, World!"

// MCP response:
{
  content: [{
    type: "text",
    text: "Hello, World!"
  }]
}
```

## Complete Example

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fabricService } from "@jaypie/fabric";
import { fabricMcp } from "@jaypie/fabric/mcp";

// Define handlers
const weatherHandler = fabricService({
  alias: "get_weather",
  description: "Get current weather for a location",
  input: {
    location: { type: String, description: "City name" },
    units: { type: ["celsius", "fahrenheit"], default: "celsius" },
  },
  service: async ({ location, units }) => {
    const weather = await fetchWeather(location);
    return {
      location,
      temperature: units === "celsius" ? weather.tempC : weather.tempF,
      units,
      conditions: weather.conditions,
    };
  },
});

const searchHandler = fabricService({
  alias: "search",
  description: "Search for information",
  input: {
    query: { type: String, description: "Search query" },
    limit: { type: Number, default: 10 },
  },
  service: async ({ query, limit }) => {
    return await performSearch(query, { limit });
  },
});

// Create server and register tools
const server = new McpServer({
  name: "my-mcp-server",
  version: "1.0.0",
});

fabricMcp({ service: weatherHandler, server });
fabricMcp({ service: searchHandler, server });

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Input Validation and Schema Generation

The adapter automatically converts fabric input definitions to Zod schemas for the MCP SDK, enabling proper parameter validation and type inference:

```typescript
// Fabric input definitions:
input: {
  name: { type: String, description: "User name" },
  count: { type: Number, default: 10 },
  active: { type: Boolean, required: false },
  status: { type: ["pending", "active", "done"] },
  tags: { type: [String] },
}

// Automatically generates equivalent Zod schemas:
// name: z.string().describe("User name")
// count: z.number().optional().default(10)
// active: z.boolean().optional()
// status: z.enum(["active", "done", "pending"])
// tags: z.array(z.string())
```

The adapter also delegates input validation to the service handler. Invalid inputs result in errors:

```typescript
// If handler expects:
input: {
  priority: { type: [1, 2, 3, 4, 5] },
  email: { type: /^[^@]+@[^@]+\.[^@]+$/ },
}

// Invalid calls throw BadRequestError:
// { priority: 10 }     → Validation fails
// { email: "invalid" } → Pattern mismatch
```

## TypeScript Types

```typescript
import type {
  FabricMcpConfig,
  FabricMcpResult,
  McpToolContentItem,
  McpToolResponse,
  OnCompleteCallback,
  OnErrorCallback,
  OnFatalCallback,
  OnMessageCallback,
} from "@jaypie/fabric/mcp";
```

### Type Definitions

```typescript
interface McpToolContentItem {
  type: "text";
  text: string;
}

interface McpToolResponse {
  content: McpToolContentItem[];
}

interface FabricMcpConfig {
  service: Service;
  server: McpServer;
  name?: string;
  description?: string;
  onComplete?: OnCompleteCallback;
  onError?: OnErrorCallback;
  onFatal?: OnFatalCallback;
  onMessage?: OnMessageCallback;
}

interface FabricMcpResult {
  name: string;
}
```

## Exports

```typescript
// @jaypie/fabric/mcp
export { fabricMcp } from "./fabricMcp.js";

export type {
  FabricMcpConfig,
  FabricMcpResult,
  McpToolContentItem,
  McpToolResponse,
  OnCompleteCallback,
  OnErrorCallback,
  OnFatalCallback,
  OnMessageCallback,
} from "./types.js";
```

## Related

- [Jaypie_Fabric_Package.md](Jaypie_Fabric_Package.md) - Core fabricService and type conversion
- [Jaypie_Fabric_LLM.md](Jaypie_Fabric_LLM.md) - LLM tool creation (similar pattern)
