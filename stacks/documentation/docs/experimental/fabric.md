---
sidebar_position: 2
---

# @jaypie/fabric

**Prerequisites:** `npm install @jaypie/fabric`

**Status:** Experimental - APIs may change

## Overview

`@jaypie/fabric` provides type conversion and service handler patterns for consistent input handling across Jaypie applications.

## Installation

```bash
npm install @jaypie/fabric
```

## Quick Reference

### Type Conversion Functions

| Function | Purpose |
|----------|---------|
| `fabric` | Master conversion dispatcher |
| `fabricBoolean` | Convert to boolean |
| `fabricNumber` | Convert to number |
| `fabricString` | Convert to string |
| `fabricArray` | Wrap non-arrays in array |
| `fabricObject` | Wrap in `{ value: ... }` structure |
| `fabricDate` | Convert to Date object |

### Service Handler

| Export | Purpose |
|--------|---------|
| `fabricService` | Create validated service endpoints |
| `FabricModel` | Base type for models |
| `FabricJob` | Job model with status tracking |
| `FabricMessage` | Message model with content |

## Type Conversion

Convert values between types with predictable behavior:

```typescript
import { fabric, fabricBoolean, fabricNumber, fabricString } from "@jaypie/fabric";

// Boolean conversion
fabricBoolean("true");      // true
fabricBoolean(1);           // true
fabricBoolean("false");     // false
fabricBoolean(0);           // false

// Number conversion
fabricNumber("42");         // 42
fabricNumber(true);         // 1
fabricNumber(false);        // 0

// String conversion
fabricString(true);         // "true"
fabricString(42);           // "42"

// Master dispatcher
fabric("true", Boolean);    // true
fabric("42", Number);       // 42
fabric(42, String);         // "42"
```

### Unwrapping Behavior

Scalar conversions automatically unwrap nested structures:

```typescript
// Objects with value property
fabric({ value: "true" }, Boolean);      // true

// Single-element arrays
fabric([42], Number);                    // 42

// JSON strings
fabric('{"value":"true"}', Boolean);     // true
fabric('[42]', Number);                  // 42
```

### Typed Arrays

Convert arrays with element type conversion:

```typescript
fabric([1, 2, 3], [String]);      // ["1", "2", "3"]
fabric(["1", "2"], [Number]);     // [1, 2]
fabric([1, 0], [Boolean]);        // [true, false]

// String splitting
fabric("1,2,3", [Number]);        // [1, 2, 3]
fabric("a, b, c", [String]);      // ["a", "b", "c"]
```

## Service Handler

Create validated service endpoints with automatic type conversion:

```typescript
import { fabricService } from "@jaypie/fabric";

const calculator = fabricService({
  alias: "add",
  description: "Add two numbers",
  input: {
    a: { type: Number, description: "First number" },
    b: { type: Number, description: "Second number" },
  },
  service: ({ a, b }) => a + b,
});

await calculator({ a: "5", b: "3" }); // 8
await calculator('{"a": 5, "b": 3}'); // 8
```

### Input Field Options

| Option | Type | Purpose |
|--------|------|---------|
| `type` | `ConversionType` | Boolean, Number, String, Array, Object |
| `default` | any | Default value if not provided |
| `description` | string | Field description |
| `required` | boolean | Required unless default is set |
| `validate` | function/RegExp/array | Validation rules |

### Validation

```typescript
const handler = fabricService({
  input: {
    email: {
      type: String,
      validate: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    age: {
      type: Number,
      validate: (v) => v >= 0 && v <= 120,
    },
    status: {
      type: String,
      validate: ["active", "inactive", "pending"],
    },
  },
  service: (input) => input,
});
```

## Sub-path Exports

### Commander (`@jaypie/fabric/commander`)

Register services as CLI commands:

```typescript
import { fabricCommand } from "@jaypie/fabric/commander";

fabricCommand(program, myService);
```

### Lambda (`@jaypie/fabric/lambda`)

Wrap services for AWS Lambda:

```typescript
import { fabricLambda } from "@jaypie/fabric/lambda";

export const handler = fabricLambda(myService);
```

### Express (`@jaypie/fabric/express`)

Create Express middleware:

```typescript
import { fabricExpress, FabricRouter } from "@jaypie/fabric/express";

app.post("/api", fabricExpress(myService));

// Multi-service router
const router = new FabricRouter({
  services: [service1, service2],
});
```

### HTTP (`@jaypie/fabric/http`)

HTTP service wrapper with CORS and authorization:

```typescript
import { fabricHttp, FabricHttpServer } from "@jaypie/fabric/http";

const httpService = fabricHttp(myService, {
  cors: { origin: "*" },
  authorization: validateToken,
});
```

### LLM (`@jaypie/fabric/llm`)

Create LLM tools:

```typescript
import { fabricTool } from "@jaypie/fabric/llm";

const tool = fabricTool(myService);
// Returns { name, description, parameters, execute }
```

### MCP (`@jaypie/fabric/mcp`)

Register MCP tools:

```typescript
import { fabricMcp } from "@jaypie/fabric/mcp";

fabricMcp(mcpServer, myService);
```

### Data (`@jaypie/fabric/data`)

Generate CRUD services for DynamoDB:

```typescript
import { FabricData } from "@jaypie/fabric/data";

const recordServices = FabricData({ model: "record" });
// Creates: create, list, read, update, delete, archive
```

## Index Utilities

Utilities for DynamoDB single-table patterns:

```typescript
import {
  APEX,
  buildCompositeKey,
  calculateScope,
  DEFAULT_INDEXES,
  populateIndexKeys,
} from "@jaypie/fabric";

// Calculate scope from parent
const scope = calculateScope({ model: "chat", id: "abc-123" });
// "chat#abc-123"

// Root scope
const rootScope = calculateScope(); // "@" (APEX)

// Build composite key
const key = buildCompositeKey(entity, ["scope", "model"]);
// "chat#abc-123#message"
```

## Related

- [@jaypie/dynamodb](/docs/experimental/dynamodb) - DynamoDB utilities
- [@jaypie/vocabulary](/docs/experimental/vocabulary) - Legacy service adapters (deprecated)
