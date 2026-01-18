---
sidebar_position: 5
---

# @jaypie/fabric

**Prerequisites:** `npm install @jaypie/fabric`

**Status:** Experimental - APIs may change

## Overview

`@jaypie/fabric` provides type conversion utilities and service handler patterns for consistent input handling across Jaypie applications. It follows the "Fabric" philosophy: things that feel right should work, and invalid inputs throw clear errors.

## Installation

```bash
npm install @jaypie/fabric
```

## Quick Reference

### Core Exports

| Export | Import Path | Purpose |
|--------|-------------|---------|
| `fabricService` | `@jaypie/fabric` | Create handler with typed inputs |
| `fabric` | `@jaypie/fabric` | Type conversion utilities |
| `StatusType` | `@jaypie/fabric` | Standard status values |
| `fabricCommand` | `@jaypie/fabric/commander` | CLI adapter (Commander.js) |
| `fabricLambda` | `@jaypie/fabric/lambda` | Lambda adapter |
| `fabricTool` | `@jaypie/fabric/llm` | LLM tool adapter |
| `fabricMcp` | `@jaypie/fabric/mcp` | MCP tool adapter |

### Supported Types

| Type | Aliases | Description |
|------|---------|-------------|
| `String` | `"string"` | String conversion |
| `Number` | `"number"` | Number parsing |
| `Boolean` | `"boolean"` | Boolean parsing |
| `Array` | `[]` | Array conversion |
| `Object` | `{}` | Object conversion |
| `[String]` | - | Typed array of strings |
| `[Number]` | - | Typed array of numbers |
| `/regex/` | - | String with regex validation |
| `["a", "b"]` | - | Validated string (must match) |
| `[1, 2, 3]` | - | Validated number (must match) |
| `StatusType` | - | Standard status values |

## Service Handler

### Basic Handler

```typescript
import { fabricService } from "@jaypie/fabric";

const divisionHandler = fabricService({
  alias: "division",
  description: "Divides two numbers",
  input: {
    numerator: {
      type: Number,
      default: 12,
      description: "Number on top",
    },
    denominator: {
      type: Number,
      default: 3,
      description: "Number on bottom",
      validate: (value) => value !== 0,
    },
  },
  service: ({ numerator, denominator }) => numerator / denominator,
});

await divisionHandler();                              // → 4
await divisionHandler({ numerator: 24 });             // → 8
await divisionHandler({ numerator: "14", denominator: "7" }); // → 2 (converted)
await divisionHandler('{"numerator": "18"}');         // → 6 (JSON parsed)
```

### Input Field Definition

| Property | Type | Description |
|----------|------|-------------|
| `type` | `ConversionType` | Required. The target type for conversion |
| `default` | `unknown` | Default value if not provided |
| `description` | `string` | Field description (used in CLI help) |
| `required` | `boolean` | Whether field is required (default: true unless default set) |
| `validate` | `function \| RegExp \| array` | Validation after conversion |
| `flag` | `string` | Override long flag name for Commander.js |
| `letter` | `string` | Short switch letter for Commander.js |

### Handler Properties

Config properties are attached directly to the handler:

```typescript
const handler = fabricService({
  alias: "greet",
  description: "Greet a user",
  input: { name: { type: String } },
  service: ({ name }) => `Hello, ${name}!`,
});

handler.alias;       // "greet"
handler.description; // "Greet a user"
handler.input;       // { name: { type: String } }
```

### ServiceContext

Services receive an optional second parameter with context utilities:

```typescript
const handler = fabricService({
  input: { jobId: { type: String } },
  service: async ({ jobId }, context) => {
    context?.sendMessage?.({ content: `Starting job ${jobId}` });

    // Handle recoverable errors without throwing
    try {
      await riskyOperation();
    } catch (err) {
      context?.onError?.(err);  // Reports error but continues
    }

    // Or report fatal errors explicitly
    if (criticalFailure) {
      context?.onFatal?.(new Error("Cannot continue"));
    }

    return { jobId, status: "complete" };
  },
});
```

Context callbacks connect to adapter registration:
- `sendMessage` → `onMessage` callback
- `onError` → `onError` callback (recoverable errors)
- `onFatal` → `onFatal` callback (fatal errors)

### Validation-Only Mode

When no `service` function is provided, the handler returns the processed input:

```typescript
const validateUser = fabricService({
  input: {
    age: { type: Number, validate: (v) => v >= 18 },
    email: { type: /^[^@]+@[^@]+\.[^@]+$/ },
    role: { type: ["admin", "user", "guest"], default: "user" },
  },
});

await validateUser({ age: "25", email: "bob@example.com" });
// → { age: 25, email: "bob@example.com", role: "user" }
```

## Type Conversion

### Conversion Examples

```typescript
import { fabric } from "@jaypie/fabric";

// Boolean conversion
fabric("true", Boolean);     // → true
fabric("false", Boolean);    // → false
fabric(1, Boolean);          // → true
fabric(0, Boolean);          // → false

// Number conversion
fabric("42", Number);        // → 42
fabric("true", Number);      // → 1
fabric("false", Number);     // → 0

// String conversion
fabric(true, String);        // → "true"
fabric(42, String);          // → "42"

// Array conversion
fabric("1,2,3", [Number]);   // → [1, 2, 3]
fabric("a\tb\tc", [String]); // → ["a", "b", "c"]
fabric([1, 2], [String]);    // → ["1", "2"]

// Unwrapping
fabric({ value: "42" }, Number);  // → 42
fabric(["true"], Boolean);        // → true
fabric('{"value": 5}', Number);   // → 5
```

### RegExp Type Shorthand

A bare RegExp converts to String and validates:

```typescript
const handler = fabricService({
  input: {
    email: { type: /^[^@]+@[^@]+\.[^@]+$/ },
  },
  service: ({ email }) => email,
});

await handler({ email: "bob@example.com" });  // ✓
await handler({ email: "invalid" });          // ✗ BadRequestError
```

### Validated Type Shorthand

Arrays of literals validate against allowed values:

```typescript
// String validation
input: {
  currency: { type: ["usd", "eur", "gbp"] },  // Must be one of these
  pattern: { type: [/^test-/, "special"] },   // Matches regex OR equals "special"
}

// Number validation
input: {
  priority: { type: [1, 2, 3, 4, 5] },        // Must be 1-5
}
```

### StatusType

A predefined validated string type for common status values:

```typescript
import { StatusType, isStatus } from "@jaypie/fabric";

// StatusType is: ["canceled", "complete", "error", "pending", "processing", "queued", "sending"]

const handler = fabricService({
  input: {
    status: { type: StatusType, default: "pending" },
  },
  service: ({ status }) => status,
});

await handler({ status: "processing" });  // ✓
await handler({ status: "invalid" });     // ✗ BadRequestError

// Type guard
isStatus("pending");   // → true
isStatus("unknown");   // → false
```

## CLI Adapter

Integrate with Commander.js:

```typescript
import { Command } from "commander";
import { fabricService } from "@jaypie/fabric";
import { fabricCommand } from "@jaypie/fabric/commander";

const handler = fabricService({
  alias: "greet",
  description: "Greet a user",
  input: {
    userName: { type: String, flag: "user", letter: "u" },
    loud: { type: Boolean, letter: "l", default: false },
  },
  service: ({ loud, userName }) => {
    const greeting = `Hello, ${userName}!`;
    return loud ? greeting.toUpperCase() : greeting;
  },
});

const program = new Command();
fabricCommand({
  service: handler,
  program,
  onMessage: (msg) => console.log(msg.content),
  onComplete: (result) => console.log(result),
  onError: (error) => console.warn("Warning:", error.message),
  onFatal: (error) => {
    console.error("Fatal:", error.message);
    process.exit(1);
  },
});
program.parse();
// Usage: greet --user Alice -l
```

## Lambda Adapter

```typescript
import { fabricService } from "@jaypie/fabric";
import { fabricLambda } from "@jaypie/fabric/lambda";

const processOrderHandler = fabricService({
  alias: "processOrder",
  input: {
    orderId: { type: String },
    priority: { type: [1, 2, 3], default: 2 },
  },
  service: async ({ orderId, priority }, context) => {
    context?.sendMessage?.({ content: `Processing order ${orderId}` });
    return { orderId, status: "complete", priority };
  },
});

export const handler = fabricLambda({
  service: processOrderHandler,
  secrets: ["MONGODB_URI"],
  setup: [connectDb],
  teardown: [disconnectDb],
  onMessage: (msg) => console.log(msg.content),
});
```

### Event Extraction

Lambda adapter automatically extracts input from:

- Direct invocation
- SQS events (including batches)
- SNS events

## LLM Tool Adapter

Convert handler to LLM tool:

```typescript
import { fabricService } from "@jaypie/fabric";
import { fabricTool } from "@jaypie/fabric/llm";
import { Llm, Toolkit } from "@jaypie/llm";

const weatherHandler = fabricService({
  alias: "get_weather",
  description: "Get current weather for a location",
  input: {
    location: { type: String, description: "City name" },
    units: { type: ["celsius", "fahrenheit"], default: "celsius" },
  },
  service: async ({ location, units }) => {
    const weather = await fetchWeather(location);
    return { location, temperature: weather.temp, units };
  },
});

const { tool } = fabricTool({ service: weatherHandler });
const toolkit = new Toolkit([tool]);
const llm = new Llm({ toolkit });

const response = await llm.ask("What's the weather in Tokyo?");
```

### Type Mapping

| Fabric Type | JSON Schema |
|-------------|-------------|
| `String` | `{ type: "string" }` |
| `Number` | `{ type: "number" }` |
| `Boolean` | `{ type: "boolean" }` |
| `[String]` | `{ type: "array", items: { type: "string" } }` |
| `/regex/` | `{ type: "string", pattern: "..." }` |
| `["a", "b"]` | `{ type: "string", enum: ["a", "b"] }` |

## MCP Tool Adapter

Register as MCP tool:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fabricService } from "@jaypie/fabric";
import { fabricMcp } from "@jaypie/fabric/mcp";

const handler = fabricService({
  alias: "calculate",
  description: "Perform a calculation",
  input: {
    operation: { type: ["add", "subtract", "multiply", "divide"] },
    a: { type: Number },
    b: { type: Number },
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
fabricMcp({ service: handler, server });
```

## Model Types

Standard model types for consistent data modeling:

```typescript
import type { FabricModel, FabricJob, FabricMessage } from "@jaypie/fabric";
```

### FabricModel Fields

```
model: <varies>
id: String (auto)
createdAt: Date (auto)
updatedAt: Date (auto)
name?: String
alias?: String
description?: String
class?: String
type?: String
content?: String
metadata?: Object
archivedAt?: Date
deletedAt?: Date
```

### FabricJob

```typescript
// FabricJob extends FabricModel
{
  model: "job",
  status: "pending" | "processing" | "complete" | "error" | ...,
  startedAt?: Date,
  completedAt?: Date,
  messages?: FabricMessage[],
  progress?: {
    percentageComplete?: number,
    estimatedTime?: number,
  },
}
```

## Error Handling

Errors are propagated through all adapters:

```typescript
import { NotFoundError } from "@jaypie/errors";

const handler = fabricService({
  input: { userId: { type: String } },
  service: async ({ userId }) => {
    const user = await db.users.findById(userId);
    if (!user) {
      throw NotFoundError("User not found");
    }
    return user;
  },
});

// CLI: Prints error message, exits with code 1
// Lambda: Returns error response
// LLM: Tool returns error to model
// MCP: Returns MCP error response
```

Invalid conversions throw `BadRequestError`:

```typescript
await handler({ numerator: "not-a-number" });  // Cannot convert to Number
await handler({ priority: 10 });                // Validation fails
await handler({});                              // Missing required field
```

## Testing

```typescript
import { describe, expect, it } from "vitest";
import { matchers } from "@jaypie/testkit";

expect.extend(matchers);

describe("getUser", () => {
  it("returns user", async () => {
    const result = await getUser({ userId: "abc-123" });
    expect(result).toHaveProperty("id", "abc-123");
  });

  it("converts string input", async () => {
    const result = await divisionHandler({ numerator: "24" });
    expect(result).toBe(8);
  });

  it("throws NotFoundError", async () => {
    await expect(
      getUser({ userId: "invalid" })
    ).rejects.toThrowNotFoundError();
  });
});
```

## Related

- [LLM Integration](/docs/guides/llm-integration) - LLM tools
- [@jaypie/llm](/docs/packages/llm) - LLM package
- [@jaypie/mcp](/docs/experimental/mcp) - MCP server
- [@jaypie/lambda](/docs/packages/lambda) - Lambda handlers
