---
description: LLM tool creation from serviceHandler for use with @jaypie/llm Toolkit
---

# Jaypie Vocabulary LLM Adapter

The LLM adapter (`@jaypie/vocabulary/llm`) creates LLM tools from Jaypie service handlers for use with `@jaypie/llm` Toolkit, automatically generating JSON Schema from input definitions.

**See also:** [Jaypie_Vocabulary_Package.md](Jaypie_Vocabulary_Package.md) for core serviceHandler documentation.

## Installation

```bash
npm install @jaypie/vocabulary @jaypie/llm
```

## Quick Start

```typescript
import { serviceHandler } from "@jaypie/vocabulary";
import { createLlmTool } from "@jaypie/vocabulary/llm";
import { Toolkit } from "@jaypie/llm";

const handler = serviceHandler({
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

const { tool } = createLlmTool({ handler });
const toolkit = new Toolkit([tool]);
```

## createLlmTool

Creates an LLM tool from a serviceHandler.

### Options

| Option | Type | Description |
|--------|------|-------------|
| `handler` | `ServiceHandlerFunction` | Required. The service handler to adapt |
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
import { serviceHandler } from "@jaypie/vocabulary";
import { createLlmTool } from "@jaypie/vocabulary/llm";

const calculateHandler = serviceHandler({
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

const { tool } = createLlmTool({ handler: calculateHandler });

// Tool has these properties:
// tool.name: "calculate"
// tool.description: "Perform a mathematical calculation"
// tool.parameters: JSON Schema for inputs
// tool.function: The callable function
```

### Overriding Name and Description

```typescript
const { tool } = createLlmTool({
  handler,
  name: "math_calculator",
  description: "A tool for performing basic math operations",
});
```

### Excluding Fields

```typescript
const handler = serviceHandler({
  alias: "search",
  input: {
    query: { type: String },
    limit: { type: Number, default: 10 },
    _internalId: { type: String },  // Internal field
  },
  service: async (params) => { /* ... */ },
});

const { tool } = createLlmTool({
  handler,
  exclude: ["_internalId"],  // Not exposed to LLM
});
```

### Lifecycle Callbacks

Services can use context callbacks to report progress, errors, and completion:

```typescript
const handler = serviceHandler({
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

const { tool } = createLlmTool({
  handler,
  onComplete: (result) => console.log("Tool completed:", result),
  onError: (error) => console.warn("Recoverable error:", error),
  onFatal: (error) => console.error("Fatal error:", error),
  onMessage: (msg) => console.log(`[${msg.level || "info"}] ${msg.content}`),
});
```

**Error handling**: Services receive `context.onError()` and `context.onFatal()` callbacks to report errors without throwing. Any error that escapes the service (is thrown) is treated as fatal and routes to `onFatal`. If `onFatal` is not provided, thrown errors fall back to `onError`. Callback errors are swallowed to ensure failures never halt service execution.

## inputToJsonSchema

Converts vocabulary input definitions to JSON Schema:

```typescript
import { inputToJsonSchema } from "@jaypie/vocabulary/llm";

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

| Vocabulary Type | JSON Schema |
|-----------------|-------------|
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
import { serviceHandler } from "@jaypie/vocabulary";
import { createLlmTool } from "@jaypie/vocabulary/llm";
import { Llm, Toolkit } from "@jaypie/llm";

// Define service handlers
const weatherHandler = serviceHandler({
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

const searchHandler = serviceHandler({
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
const { tool: weatherTool } = createLlmTool({ handler: weatherHandler });
const { tool: searchTool } = createLlmTool({ handler: searchHandler });

// Use with Toolkit
const toolkit = new Toolkit([weatherTool, searchTool]);
const llm = new Llm({ toolkit });

const response = await llm.ask("What's the weather in Tokyo?");
```

## TypeScript Types

```typescript
import type {
  CreateLlmToolConfig,
  CreateLlmToolResult,
  LlmTool,
  OnCompleteCallback,
  OnErrorCallback,
  OnFatalCallback,
  OnMessageCallback,
} from "@jaypie/vocabulary/llm";
```

### Type Definitions

```typescript
interface LlmTool {
  name: string;
  description: string;
  parameters: JsonSchema;
  function: (params: Record<string, unknown>) => Promise<unknown>;
}

interface CreateLlmToolConfig {
  handler: ServiceHandlerFunction;
  name?: string;
  description?: string;
  message?: string | ((params: Record<string, unknown>) => string);
  exclude?: string[];
  onComplete?: OnCompleteCallback;
  onError?: OnErrorCallback;
  onFatal?: OnFatalCallback;
  onMessage?: OnMessageCallback;
}

interface CreateLlmToolResult {
  tool: LlmTool;
}
```

## Exports

```typescript
// @jaypie/vocabulary/llm
export { createLlmTool } from "./createLlmTool.js";
export { inputToJsonSchema } from "./inputToJsonSchema.js";

export type {
  CreateLlmToolConfig,
  CreateLlmToolResult,
  LlmTool,
  OnCompleteCallback,
  OnErrorCallback,
  OnFatalCallback,
  OnMessageCallback,
} from "./types.js";
```

## Related

- [Jaypie_Vocabulary_Package.md](Jaypie_Vocabulary_Package.md) - Core serviceHandler and type coercion
- [Jaypie_Llm_Tools.md](Jaypie_Llm_Tools.md) - LLM tools and Toolkit usage
