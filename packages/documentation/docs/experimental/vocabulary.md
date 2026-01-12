---
sidebar_position: 5
---

# @jaypie/vocabulary


**Prerequisites:** `npm install @jaypie/vocabulary`

**Status:** Experimental - APIs may change

## Overview

`@jaypie/vocabulary` provides a service handler pattern with input type coercion and adapters for multiple execution contexts (CLI, Lambda, LLM tools, MCP).

## Installation

```bash
npm install @jaypie/vocabulary
```

## Quick Reference

### Core Exports

| Export | Purpose |
|--------|---------|
| `serviceHandler` | Create handler with typed inputs |
| `registerServiceCommand` | CLI adapter (Commander.js) |
| `lambdaServiceHandler` | Lambda adapter |
| `createLlmTool` | LLM tool adapter |
| `registerMcpTool` | MCP tool adapter |

### Input Types

| Type | Coercion |
|------|----------|
| `string` | String conversion |
| `number` | Number parsing |
| `boolean` | Boolean parsing ("true", "1", etc.) |
| `array` | Ensure array |
| `object` | Ensure object |
| `date` | Date parsing |
| `uuid` | UUID validation |

## Service Handler

### Basic Handler

```typescript
import { serviceHandler } from "@jaypie/vocabulary";

const getUser = serviceHandler({
  name: "get_user",
  description: "Get user by ID",
  input: {
    userId: {
      type: "string",
      required: true,
      description: "User ID",
    },
  },
  handler: async ({ userId }) => {
    return await db.users.findById(userId);
  },
});
```

### Input Definition

```typescript
const handler = serviceHandler({
  input: {
    name: {
      type: "string",
      required: true,
      description: "User name",
    },
    age: {
      type: "number",
      required: false,
      default: 0,
    },
    active: {
      type: "boolean",
      default: true,
    },
    tags: {
      type: "array",
      default: [],
    },
  },
  handler: async (input) => {
    // input is typed and coerced
  },
});
```

### Type Coercion

"Smooth, pliable" philosophy - flexible input handling:

```typescript
// String "true" becomes boolean true
handler({ active: "true" });

// String "42" becomes number 42
handler({ age: "42" });

// Single item becomes array
handler({ tags: "javascript" }); // ["javascript"]
```

## CLI Adapter

Integrate with Commander.js:

```typescript
import { Command } from "commander";
import { registerServiceCommand } from "@jaypie/vocabulary";

const program = new Command();

registerServiceCommand(program, getUser, {
  onMessage: (msg) => console.log(msg),
  onComplete: (result) => console.log(JSON.stringify(result, null, 2)),
  onError: (error) => console.error(error.message),
});

program.parse();
```

### Generated CLI

```bash
my-cli get_user --userId abc-123
```

Options auto-generated from input definition:

```typescript
{
  input: {
    userId: { type: "string", required: true },
    verbose: { type: "boolean", flag: "-v, --verbose" },
  },
}
```

## Lambda Adapter

```typescript
import { lambdaServiceHandler } from "@jaypie/vocabulary";

const getUser = serviceHandler({
  name: "get_user",
  input: {
    userId: { type: "string", required: true },
  },
  handler: async ({ userId }) => {
    return await db.users.findById(userId);
  },
});

export const handler = lambdaServiceHandler(getUser, {
  secrets: ["MONGODB_URI"],
  setup: [connectDb],
  teardown: [disconnectDb],
});
```

### Event Extraction

Lambda adapter automatically extracts input from:

- Direct invocation: `event.userId`
- API Gateway: `event.body.userId`, `event.queryStringParameters.userId`
- SQS: `event.Records[0].body.userId`
- SNS: `event.Records[0].Sns.Message.userId`

## LLM Tool Adapter

Convert handler to LLM tool:

```typescript
import { createLlmTool } from "@jaypie/vocabulary";
import Llm, { Toolkit } from "@jaypie/llm";

const getUserTool = createLlmTool(getUser);

const toolkit = new Toolkit([getUserTool]);

const response = await Llm.operate("Get user abc-123", {
  tools: toolkit,
});
```

### Type Mapping

| Vocabulary Type | JSON Schema Type |
|-----------------|------------------|
| `string` | `{ type: "string" }` |
| `number` | `{ type: "number" }` |
| `boolean` | `{ type: "boolean" }` |
| `array` | `{ type: "array" }` |
| `object` | `{ type: "object" }` |
| `date` | `{ type: "string", format: "date-time" }` |
| `uuid` | `{ type: "string", format: "uuid" }` |

## MCP Tool Adapter

Register as MCP tool:

```typescript
import { registerMcpTool } from "@jaypie/vocabulary";

registerMcpTool(mcpServer, getUser, {
  onMessage: (msg) => server.sendProgress(msg),
  onComplete: (result) => server.sendResult(result),
  onError: (error) => server.sendError(error),
});
```

## Input Validation

### Built-in Validation

```typescript
{
  input: {
    email: {
      type: "string",
      required: true,
      validate: (value) => value.includes("@"),
      errorMessage: "Invalid email format",
    },
  },
}
```

### Custom Validation

```typescript
{
  input: {
    age: {
      type: "number",
      validate: (value) => {
        if (value < 0 || value > 150) {
          throw BadRequestError("Age must be 0-150");
        }
        return true;
      },
    },
  },
}
```

## Error Handling

Errors are propagated through all adapters:

```typescript
const handler = serviceHandler({
  handler: async ({ userId }) => {
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

## Testing

```typescript
import { describe, expect, it } from "vitest";

describe("getUser", () => {
  it("returns user", async () => {
    const result = await getUser.handler({ userId: "abc-123" });
    expect(result).toHaveProperty("id", "abc-123");
  });

  it("throws NotFoundError", async () => {
    await expect(
      getUser.handler({ userId: "invalid" })
    ).rejects.toThrowNotFoundError();
  });
});
```

## Related

- [LLM Integration](/docs/guides/llm-integration) - LLM tools
- [@jaypie/llm](/docs/packages/llm) - LLM package
- [@jaypie/mcp](/docs/experimental/mcp) - MCP server
- [@jaypie/lambda](/docs/packages/lambda) - Lambda handlers
