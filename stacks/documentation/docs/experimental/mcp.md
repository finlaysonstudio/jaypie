---
sidebar_position: 3
---

# @jaypie/mcp


**Prerequisites:** `npm install @jaypie/mcp`

**Status:** Experimental - APIs may change

## Overview

`@jaypie/mcp` provides utilities for building MCP (Model Context Protocol) servers that expose Jaypie service handlers as tools for AI assistants.

## Installation

```bash
npm install @jaypie/mcp
```

## Quick Reference

### Exports

| Export | Purpose |
|--------|---------|
| `registerMcpTool` | Register service handler as MCP tool |
| `createMcpServer` | Create MCP server instance |

## MCP Tool Registration

### Basic Registration

```typescript
import { registerMcpTool } from "@jaypie/mcp";
import { serviceHandler } from "@jaypie/vocabulary";

const getUserHandler = serviceHandler({
  name: "get_user",
  description: "Get user by ID",
  input: {
    userId: { type: "string", required: true },
  },
  handler: async ({ userId }) => {
    const user = await db.users.findById(userId);
    return user;
  },
});

registerMcpTool(server, getUserHandler);
```

### With Callbacks

```typescript
registerMcpTool(server, handler, {
  onMessage: (message) => {
    console.log("Progress:", message);
  },
  onComplete: (result) => {
    console.log("Complete:", result);
  },
  onError: (error) => {
    console.error("Error:", error);
  },
});
```

## Service Handler to MCP Tool

Service handlers automatically convert to MCP tools:

| Vocabulary Type | JSON Schema Type |
|-----------------|------------------|
| `string` | `string` |
| `number` | `number` |
| `boolean` | `boolean` |
| `array` | `array` |
| `object` | `object` |
| `date` | `string` (format: date-time) |
| `uuid` | `string` (format: uuid) |

## Creating MCP Server

```typescript
import { createMcpServer, registerMcpTool } from "@jaypie/mcp";
import { handlers } from "./handlers.js";

const server = createMcpServer({
  name: "my-service",
  version: "1.0.0",
});

// Register all handlers
for (const handler of handlers) {
  registerMcpTool(server, handler);
}

// Start server
server.listen();
```

## Response Format

MCP tools return responses as text content:

```typescript
// Handler returns:
{ name: "Alice", email: "alice@example.com" }

// MCP response:
{
  content: [
    {
      type: "text",
      text: '{"name":"Alice","email":"alice@example.com"}'
    }
  ]
}
```

## Error Handling

Jaypie errors are converted to MCP error responses:

```typescript
const handler = serviceHandler({
  name: "get_user",
  handler: async ({ userId }) => {
    const user = await db.users.findById(userId);
    if (!user) {
      throw NotFoundError("User not found");
    }
    return user;
  },
});

// MCP receives error with status and message
```

## Input Validation

Input validation from vocabulary is enforced:

```typescript
const handler = serviceHandler({
  input: {
    email: {
      type: "string",
      required: true,
      validate: (value) => value.includes("@"),
    },
  },
  handler: async ({ email }) => {
    // email is guaranteed valid
  },
});
```

## Prompts and Resources

### List Prompts

```typescript
import { mcp__jaypie__list_prompts } from "@jaypie/mcp";

const prompts = await mcp__jaypie__list_prompts();
// Returns available Jaypie development prompts
```

### Read Prompt

```typescript
import { mcp__jaypie__read_prompt } from "@jaypie/mcp";

const content = await mcp__jaypie__read_prompt({
  filename: "Development_Process.md",
});
```

## Datadog Integration

Built-in tools for Datadog monitoring:

```typescript
import {
  mcp__jaypie__datadog_logs,
  mcp__jaypie__datadog_monitors,
  mcp__jaypie__datadog_synthetics,
} from "@jaypie/mcp";

// Query logs
const logs = await mcp__jaypie__datadog_logs({
  query: "status:error",
  from: "now-1h",
});

// Check monitors
const monitors = await mcp__jaypie__datadog_monitors({
  status: ["Alert", "Warn"],
});
```

## LLM Debug Tools

Debug LLM API calls:

```typescript
import { mcp__jaypie__llm_debug_call } from "@jaypie/mcp";

const response = await mcp__jaypie__llm_debug_call({
  provider: "anthropic",
  message: "Test message",
  model: "claude-sonnet-4",
});
```

## Configuration

Environment variables:

| Variable | Purpose |
|----------|---------|
| `DD_API_KEY` | Datadog API key |
| `DD_APP_KEY` | Datadog app key |
| `DD_ENV` | Default environment filter |
| `DD_SERVICE` | Default service filter |

## Related

- [Vocabulary](/docs/experimental/vocabulary) - Service handler patterns
- [LLM Integration](/docs/guides/llm-integration) - LLM tools
- [@jaypie/llm](/docs/packages/llm) - LLM package
