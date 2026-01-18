---
description: LLM tool creation from fabricService for use with @jaypie/llm Toolkit
---

# Jaypie Fabric LLM Adapter

The LLM adapter (`@jaypie/fabric/llm`) creates LLM tools from Jaypie service handlers for use with `@jaypie/llm` Toolkit, automatically generating JSON Schema from input definitions.

**See also:** [Jaypie_Fabric_Package.md](Jaypie_Fabric_Package.md) for core fabricService documentation.

## Installation

```bash
npm install @jaypie/fabric @jaypie/llm
```

## Quick Start

```typescript
import { fabricService } from "@jaypie/fabric";
import { fabricTool } from "@jaypie/fabric/llm";
import { Toolkit } from "@jaypie/llm";

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

const { tool } = fabricTool({ service: handler });
const toolkit = new Toolkit([tool]);
```

## fabricTool

Creates an LLM tool from a fabricService.

### Options

| Option | Type | Description |
|--------|------|-------------|
| `service` | `Service` | Required. The service handler to adapt |
| `name` | `string` | Override tool name (defaults to handler.alias) |
| `description` | `string` | Override tool description (defaults to handler.description) |
| `message` | `string \| function` | Custom message for logging |
| `exclude` | `string[]` | Fields to exclude from tool parameters |
| `onComplete` | `OnCompleteCallback` | Called with tool's return value on success |
| `onError` | `OnErrorCallback` | Receives errors reported via `context.onError()` in service |
| `onFatal` | `OnFatalCallback` | Receives fatal errors (thrown or via `context.onFatal()`) |
| `onMessage` | `OnMessageCallback` | Receives messages from `context.sendMessage` in service |

### Basic Usage

```typescript
import { fabricService } from "@jaypie/fabric";
import { fabricTool } from "@jaypie/fabric/llm";

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

const { tool } = fabricTool({ service: calculateHandler });

// Tool has these properties:
// tool.name: "calculate"
// tool.description: "Perform a mathematical calculation"
// tool.parameters: JSON Schema for inputs
// tool.function: The callable function
```

### Overriding Name and Description

```typescript
const { tool } = fabricTool({
  service: handler,
  name: "math_calculator",
  description: "A tool for performing basic math operations",
});
```

### Excluding Fields

```typescript
const handler = fabricService({
  alias: "search",
  input: {
    query: { type: String },
    limit: { type: Number, default: 10 },
    _internalId: { type: String },  // Internal field
  },
  service: async (params) => { /* ... */ },
});

const { tool } = fabricTool({
  service: handler,
  exclude: ["_internalId"],  // Not exposed to LLM
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

const { tool } = fabricTool({
  service: handler,
  onComplete: (result) => console.log("Tool completed:", result),
  onError: (error) => console.warn("Recoverable error:", error),
  onFatal: (error) => console.error("Fatal error:", error),
  onMessage: (msg) => console.log(`[${msg.level || "info"}] ${msg.content}`),
});
```

**Error handling**: Services receive `context.onError()` and `context.onFatal()` callbacks to report errors without throwing. Any error that escapes the service (is thrown) is treated as fatal and routes to `onFatal`. If `onFatal` is not provided, thrown errors fall back to `onError`. Callback errors are swallowed to ensure failures never halt service execution.

## inputToJsonSchema

Converts fabric input definitions to JSON Schema:

```typescript
import { inputToJsonSchema } from "@jaypie/fabric/llm";

const schema = inputToJsonSchema({
  userName: { type: String, description: "User's name" },
  age: { type: Number, required: false },
  role: { type: ["admin", "user", "guest"], default: "user" },
});

// Returns:
{
  type: "object",
  properties: {
    userName: { type: "string", description: "User's name" },
    age: { type: "number" },
    role: { type: "string", enum: ["admin", "user", "guest"] },
  },
  required: ["userName"],
}
```

### Type Mappings

| Fabric Type | JSON Schema |
|-------------|-------------|
| `String` | `{ type: "string" }` |
| `Number` | `{ type: "number" }` |
| `Boolean` | `{ type: "boolean" }` |
| `Array` | `{ type: "array" }` |
| `Object` | `{ type: "object" }` |
| `[String]` | `{ type: "array", items: { type: "string" } }` |
| `[Number]` | `{ type: "array", items: { type: "number" } }` |
| `/regex/` | `{ type: "string", pattern: "..." }` |
| `["a", "b"]` | `{ type: "string", enum: ["a", "b"] }` |
| `[1, 2, 3]` | `{ type: "number", enum: [1, 2, 3] }` |

### Excluding Fields

```typescript
const schema = inputToJsonSchema(handler.input, {
  exclude: ["internalField", "debugMode"],
});
```

## Complete Example

```typescript
import { fabricService } from "@jaypie/fabric";
import { fabricTool } from "@jaypie/fabric/llm";
import { Llm, Toolkit } from "@jaypie/llm";

// Define service handlers
const weatherHandler = fabricService({
  alias: "get_weather",
  description: "Get current weather for a location",
  input: {
    location: { type: String, description: "City name or coordinates" },
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
  alias: "search_web",
  description: "Search the web for information",
  input: {
    query: { type: String, description: "Search query" },
    maxResults: { type: Number, default: 5, description: "Maximum results" },
  },
  service: async ({ query, maxResults }) => {
    return await performSearch(query, maxResults);
  },
});

// Create tools
const { tool: weatherTool } = fabricTool({ service: weatherHandler });
const { tool: searchTool } = fabricTool({ service: searchHandler });

// Use with Toolkit
const toolkit = new Toolkit([weatherTool, searchTool]);
const llm = new Llm({ toolkit });

const response = await llm.ask("What's the weather in Tokyo?");
```

## TypeScript Types

```typescript
import type {
  FabricToolConfig,
  FabricToolResult,
  LlmTool,
  OnCompleteCallback,
  OnErrorCallback,
  OnFatalCallback,
  OnMessageCallback,
} from "@jaypie/fabric/llm";
```

### Type Definitions

```typescript
interface LlmTool {
  name: string;
  description: string;
  parameters: JsonSchema;
  function: (params: Record<string, unknown>) => Promise<unknown>;
}

interface FabricToolConfig {
  service: Service;
  name?: string;
  description?: string;
  message?: string | ((params: Record<string, unknown>) => string);
  exclude?: string[];
  onComplete?: OnCompleteCallback;
  onError?: OnErrorCallback;
  onFatal?: OnFatalCallback;
  onMessage?: OnMessageCallback;
}

interface FabricToolResult {
  tool: LlmTool;
}
```

## Exports

```typescript
// @jaypie/fabric/llm
export { fabricTool } from "./fabricTool.js";
export { inputToJsonSchema } from "./inputToJsonSchema.js";

export type {
  FabricToolConfig,
  FabricToolResult,
  LlmTool,
  OnCompleteCallback,
  OnErrorCallback,
  OnFatalCallback,
  OnMessageCallback,
} from "./types.js";
```

## Related

- [Jaypie_Fabric_Package.md](Jaypie_Fabric_Package.md) - Core fabricService and type conversion
- [Jaypie_Llm_Tools.md](Jaypie_Llm_Tools.md) - LLM tools and Toolkit usage
