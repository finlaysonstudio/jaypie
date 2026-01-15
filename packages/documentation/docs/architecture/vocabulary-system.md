---
sidebar_position: 2
---

# Fabric System


**Prerequisites:** Understanding of service handlers

## Overview

The Fabric system provides a pattern for creating handlers with typed inputs that automatically convert values and work across CLI, Lambda, LLM, and MCP contexts.

## Core Concept

Service handlers define their input schema declaratively, enabling:

- **Type conversion** - `"true"` becomes `true`, `"42"` becomes `42`
- **Validation** - Required fields, custom validators
- **Adapter generation** - Auto-generate CLI options, LLM tool schemas, etc.

## Service Handler

### Definition

```typescript
import { fabricService } from "@jaypie/fabric";

const createUser = fabricService({
  alias: "create_user",
  description: "Create a new user",
  input: {
    name: {
      type: String,
      required: true,
      description: "User's full name",
    },
    email: {
      type: String,
      required: true,
      description: "User's email address",
    },
    age: {
      type: Number,
      required: false,
      default: 0,
      description: "User's age",
    },
  },
  service: async ({ name, email, age }) => {
    return await db.users.create({ name, email, age });
  },
});
```

### Input Types

| Type | Description | Conversion |
|------|-------------|----------|
| `String` | Text value | `.toString()` |
| `Number` | Numeric value | `parseFloat()`, NaN → default |
| `Boolean` | True/false | `"true"`, `"1"`, `1` → true |
| `Array` | List of values | Single → `[value]` |
| `Object` | Object value | JSON parse if string |
| `Date` | Date value | `new Date()` |

## Type Conversion Philosophy

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
import { fabricCommand } from "@jaypie/fabric/commander";

fabricCommand({ service: createUser, program });

// Generates:
// my-cli create_user --name "Alice" --email "alice@example.com" --age 25
```

### Lambda

```typescript
import { fabricLambda } from "@jaypie/fabric/lambda";

export const handler = fabricLambda({
  service: createUser,
  secrets: ["MONGODB_URI"],
});

// Extracts input from:
// - Direct: event.name, event.email
// - API Gateway: body, queryStringParameters
// - SQS: Records[].body
```

### LLM Tool

```typescript
import { fabricTool } from "@jaypie/fabric/llm";

const { tool } = fabricTool({ service: createUser });
// Generates JSON Schema for tool parameters
```

### MCP Tool

```typescript
import { fabricMcp } from "@jaypie/fabric/mcp";

fabricMcp({ service: createUser, server });
// Registers as MCP tool with schema
```

## JSON Schema Mapping

| Fabric | JSON Schema |
|--------|-------------|
| `String` | `{ type: "string" }` |
| `Number` | `{ type: "number" }` |
| `Boolean` | `{ type: "boolean" }` |
| `Array` | `{ type: "array" }` |
| `Object` | `{ type: "object" }` |
| `Date` | `{ type: "string", format: "date-time" }` |

Required fields go in JSON Schema `required` array.

## Validation

### Built-in

```typescript
{
  input: {
    email: {
      type: String,
      required: true,
      validate: (value) => value.includes("@"),
    },
  },
}
```

### Custom Validator

```typescript
{
  input: {
    age: {
      type: Number,
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
fabricCommand({
  service: handler,
  program,
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
function myAdapter(service, options) {
  return async (rawInput) => {
    // 1. Extract input from context
    const extracted = extractInput(rawInput);

    // 2. Convert types (handled by fabricService)
    // 3. Validate (handled by fabricService)

    // 4. Execute handler
    try {
      const result = await service(extracted);
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

- [Fabric](/docs/experimental/vocabulary) - Full API reference
- [@jaypie/llm](/docs/packages/llm) - LLM integration
- [@jaypie/mcp](/docs/experimental/mcp) - MCP integration
- [@jaypie/lambda](/docs/packages/lambda) - Lambda handlers
