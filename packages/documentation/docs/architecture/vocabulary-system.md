---
sidebar_position: 2
---

# Vocabulary System


**Prerequisites:** Understanding of service handlers

## Overview

The Vocabulary system provides a pattern for creating handlers with typed inputs that automatically coerce values and work across CLI, Lambda, LLM, and MCP contexts.

## Core Concept

Service handlers define their input schema declaratively, enabling:

- **Type coercion** - `"true"` becomes `true`, `"42"` becomes `42`
- **Validation** - Required fields, custom validators
- **Adapter generation** - Auto-generate CLI options, LLM tool schemas, etc.

## Service Handler

### Definition

```typescript
import { serviceHandler } from "@jaypie/vocabulary";

const createUser = serviceHandler({
  name: "create_user",
  description: "Create a new user",
  input: {
    name: {
      type: "string",
      required: true,
      description: "User's full name",
    },
    email: {
      type: "string",
      required: true,
      description: "User's email address",
    },
    age: {
      type: "number",
      required: false,
      default: 0,
      description: "User's age",
    },
  },
  handler: async ({ name, email, age }) => {
    return await db.users.create({ name, email, age });
  },
});
```

### Input Types

| Type | Description | Coercion |
|------|-------------|----------|
| `string` | Text value | `.toString()` |
| `number` | Numeric value | `parseFloat()`, NaN → default |
| `boolean` | True/false | `"true"`, `"1"`, `1` → true |
| `array` | List of values | Single → `[value]` |
| `object` | Object value | JSON parse if string |
| `date` | Date value | `new Date()` |
| `uuid` | UUID string | Validation |

## Type Coercion Philosophy

"Smooth, pliable" - inputs should work naturally:

```typescript
// All these become boolean true
handler({ active: true });
handler({ active: "true" });
handler({ active: "TRUE" });
handler({ active: 1 });
handler({ active: "1" });

// All these become number 42
handler({ count: 42 });
handler({ count: "42" });
handler({ count: "42.0" });

// Single values become arrays
handler({ tags: "javascript" });
// Receives: { tags: ["javascript"] }
```

### Invalid Values

Invalid conversions fail fast with clear errors:

```typescript
// Throws BadRequestError
handler({ count: "not-a-number" });
handler({ email: null }); // if required
```

## Adapters

### Commander CLI

```typescript
import { registerServiceCommand } from "@jaypie/vocabulary";

registerServiceCommand(program, createUser, {
  onComplete: (result) => console.log(result),
});

// Generates:
// my-cli create_user --name "Alice" --email "alice@example.com" --age 25
```

### Lambda

```typescript
import { lambdaServiceHandler } from "@jaypie/vocabulary";

export const handler = lambdaServiceHandler(createUser, {
  secrets: ["MONGODB_URI"],
});

// Extracts input from:
// - Direct: event.name, event.email
// - API Gateway: body, queryStringParameters
// - SQS: Records[].body
```

### LLM Tool

```typescript
import { createLlmTool } from "@jaypie/vocabulary";

const tool = createLlmTool(createUser);
// Generates JSON Schema for tool parameters
```

### MCP Tool

```typescript
import { registerMcpTool } from "@jaypie/vocabulary";

registerMcpTool(server, createUser);
// Registers as MCP tool with schema
```

## JSON Schema Mapping

| Vocabulary | JSON Schema |
|------------|-------------|
| `string` | `{ type: "string" }` |
| `number` | `{ type: "number" }` |
| `boolean` | `{ type: "boolean" }` |
| `array` | `{ type: "array" }` |
| `object` | `{ type: "object" }` |
| `date` | `{ type: "string", format: "date-time" }` |
| `uuid` | `{ type: "string", format: "uuid" }` |

Required fields go in JSON Schema `required` array.

## Validation

### Built-in

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

### Custom Validator

```typescript
{
  input: {
    age: {
      type: "number",
      validate: (value) => {
        if (value < 0) throw BadRequestError("Age cannot be negative");
        if (value > 150) throw BadRequestError("Age too high");
        return true;
      },
    },
  },
}
```

## Callbacks

Adapters support lifecycle callbacks:

```typescript
registerServiceCommand(program, handler, {
  onMessage: (message) => {
    // Progress updates
    console.log(message);
  },
  onComplete: (result) => {
    // Success
    console.log(JSON.stringify(result, null, 2));
  },
  onError: (error) => {
    // Handled error
    console.error(error.message);
  },
  onFatal: (error) => {
    // Unhandled error
    console.error("Fatal:", error);
    process.exit(1);
  },
});
```

## Error Handling

Errors propagate through all adapters:

| Context | Behavior |
|---------|----------|
| CLI | Print message, exit code 1 |
| Lambda | Return error response |
| LLM | Return error to model |
| MCP | Return MCP error |

## Building Adapters

### Adapter Pattern

```typescript
function myAdapter(handler, options) {
  return async (rawInput) => {
    // 1. Extract input from context
    const extracted = extractInput(rawInput);

    // 2. Coerce types
    const coerced = coerceInput(handler.input, extracted);

    // 3. Validate
    validateInput(handler.input, coerced);

    // 4. Execute handler
    try {
      const result = await handler.handler(coerced);
      options.onComplete?.(result);
      return result;
    } catch (error) {
      options.onError?.(error);
      throw error;
    }
  };
}
```

## Related

- [Vocabulary](/docs/experimental/vocabulary) - Full API reference
- [@jaypie/llm](/docs/packages/llm) - LLM integration
- [@jaypie/mcp](/docs/experimental/mcp) - MCP integration
- [@jaypie/lambda](/docs/packages/lambda) - Lambda handlers
