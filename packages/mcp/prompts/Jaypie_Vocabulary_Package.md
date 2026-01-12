---
description: Core guide to Jaypie Vocabulary for type coercion, service handlers, and entity types
---

# Jaypie Vocabulary Package

Jaypie Vocabulary (`@jaypie/vocabulary`) provides type coercion utilities and service handler patterns for consistent input handling across Jaypie applications.

## Related Adapter Guides

Vocabulary includes adapters for integrating service handlers with various platforms. See these guides for platform-specific integration:

| Guide | Import | Description |
|-------|--------|-------------|
| [Jaypie_Vocabulary_Commander.md](Jaypie_Vocabulary_Commander.md) | `@jaypie/vocabulary/commander` | Commander.js CLI integration with callbacks |
| [Jaypie_Vocabulary_Lambda.md](Jaypie_Vocabulary_Lambda.md) | `@jaypie/vocabulary/lambda` | AWS Lambda handler wrapping |
| [Jaypie_Vocabulary_LLM.md](Jaypie_Vocabulary_LLM.md) | `@jaypie/vocabulary/llm` | LLM tool creation for `@jaypie/llm` Toolkit |
| [Jaypie_Vocabulary_MCP.md](Jaypie_Vocabulary_MCP.md) | `@jaypie/vocabulary/mcp` | MCP server tool registration |

## Installation

```bash
npm install @jaypie/vocabulary
```

## Core Concepts

### Design Philosophy

Vocabulary follows the "Fabric" philosophy:
- **Smooth, pliable** - Things that feel right should work
- **Catch bad passes** - Invalid inputs throw clear errors

This means `"true"` works where `true` is expected, `"42"` works where `42` is expected, and invalid conversions fail fast with `BadRequestError`.

## serviceHandler

Factory function that creates validated service endpoints with automatic type coercion.

### Basic Usage

```typescript
import { serviceHandler } from "@jaypie/vocabulary";

const divisionHandler = serviceHandler({
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
await divisionHandler({ numerator: "14", denominator: "7" }); // → 2 (coerced)
await divisionHandler('{"numerator": "18"}');         // → 6 (JSON parsed)
```

### Handler Properties

Config properties are attached directly to the handler for introspection:

```typescript
const handler = serviceHandler({
  alias: "greet",
  description: "Greet a user",
  input: { name: { type: String } },
  service: ({ name }) => `Hello, ${name}!`,
});

handler.alias;       // "greet"
handler.description; // "Greet a user"
handler.input;       // { name: { type: String } }
```

### Input Field Definition

| Property | Type | Description |
|----------|------|-------------|
| `type` | `CoercionType` | Required. The target type for coercion |
| `default` | `unknown` | Default value if not provided |
| `description` | `string` | Field description (used in CLI help) |
| `required` | `boolean` | Whether field is required (default: true unless default set) |
| `validate` | `function \| RegExp \| array` | Validation after coercion |
| `flag` | `string` | Override long flag name for Commander.js |
| `letter` | `string` | Short switch letter for Commander.js |

### Validation-Only Mode

When no `service` function is provided, the handler returns the processed input:

```typescript
const validateUser = serviceHandler({
  input: {
    age: { type: Number, validate: (v) => v >= 18 },
    email: { type: /^[^@]+@[^@]+\.[^@]+$/ },
    role: { type: ["admin", "user", "guest"], default: "user" },
  },
});

await validateUser({ age: "25", email: "bob@example.com" });
// → { age: 25, email: "bob@example.com", role: "user" }
```

### ServiceContext

Services receive an optional second parameter with context utilities:

```typescript
interface ServiceContext {
  onError?: (error: unknown) => void | Promise<void>;
  onFatal?: (error: unknown) => void | Promise<void>;
  sendMessage?: (message: Message) => void | Promise<void>;
}

const handler = serviceHandler({
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

**Note:** Any error that escapes the service (is thrown) is treated as fatal and routes to `onFatal`.

## Type Coercion

### Supported Types

| Type | Aliases | Description |
|------|---------|-------------|
| `String` | `"string"`, `""` | String coercion |
| `Number` | `"number"` | Number coercion |
| `Boolean` | `"boolean"` | Boolean coercion |
| `Date` | `DateType` | Date coercion (ISO strings, timestamps) |
| `Array` | `"array"`, `[]` | Array coercion |
| `Object` | `"object"`, `{}` | Object coercion |
| `[String]` | `[""]` | Typed array of strings |
| `[Number]` | - | Typed array of numbers |
| `[Boolean]` | - | Typed array of booleans |
| `[Object]` | `[{}]` | Typed array of objects |
| `/regex/` | - | String with regex validation |
| `["a", "b"]` | - | Validated string (must match) |
| `[1, 2, 3]` | - | Validated number (must match) |
| `StatusType` | - | Validated status ("pending", "processing", etc.) |

### Coercion Examples

```typescript
import { coerce } from "@jaypie/vocabulary";

// Boolean coercion
coerce("true", Boolean);     // → true
coerce("false", Boolean);    // → false
coerce(1, Boolean);          // → true
coerce(0, Boolean);          // → false

// Number coercion
coerce("42", Number);        // → 42
coerce("true", Number);      // → 1
coerce("false", Number);     // → 0

// String coercion
coerce(true, String);        // → "true"
coerce(42, String);          // → "42"

// Array coercion
coerce("1,2,3", [Number]);   // → [1, 2, 3]
coerce("a\tb\tc", [String]); // → ["a", "b", "c"]
coerce([1, 2], [String]);    // → ["1", "2"]

// Unwrapping
coerce({ value: "42" }, Number);  // → 42
coerce(["true"], Boolean);        // → true
coerce('{"value": 5}', Number);   // → 5

// Date coercion
import { coerceToDate, coerceFromDate } from "@jaypie/vocabulary";

coerceToDate("2026-01-15T10:30:00Z");  // → Date object
coerceToDate(1736942400000);            // → Date from timestamp
coerceFromDate(new Date(), String);     // → ISO string
coerceFromDate(new Date(), Number);     // → Unix timestamp (ms)
```

### RegExp Type Shorthand

A bare RegExp coerces to String and validates:

```typescript
const handler = serviceHandler({
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
import { StatusType, isStatus, STATUS_VALUES } from "@jaypie/vocabulary";

// StatusType is: ["canceled", "complete", "error", "pending", "processing", "queued", "sending"]

const handler = serviceHandler({
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

## Entity Types

The vocabulary provides standard entity types for consistent data modeling:

```typescript
import type {
  BaseEntity,
  BaseEntityInput,
  BaseEntityUpdate,
  BaseEntityFilter,
  HistoryEntry,
  Job,
  MessageEntity,
  Progress,
} from "@jaypie/vocabulary";
```

### BaseEntity (base for all entities)

```
model: <varies>
id: String (auto)
createdAt: Date (auto)
updatedAt: Date (auto)
history?: [HistoryEntry] (auto)
name?: String
label?: String
abbreviation?: String
alias?: String
xid?: String
description?: String
class?: String
type?: String
content?: String
metadata?: Object
emoji?: String
icon?: String
archivedAt?: Date
deletedAt?: Date
```

### MessageEntity (extends BaseEntity)

```
model: message
content: String (required)
type?: String (e.g., "assistant", "user", "system")
```

### Job (extends BaseEntity)

```
model: job
type?: String (e.g., "batch", "realtime", "scheduled")
class?: String (e.g., "evaluation", "export", "import")
status: String (required)
startedAt?: Date
completedAt?: Date
messages?: [MessageEntity]
progress?:
    elapsedTime?: Number
    estimatedTime?: Number
    percentageComplete?: Number
    nextPercentageCheckpoint?: Number
```

### BaseEntity Utilities

Field constants and utility functions for working with entities:

```typescript
import {
  // Field name constants
  BASE_ENTITY_FIELDS,           // All field names as constants
  BASE_ENTITY_REQUIRED_FIELDS,  // ["createdAt", "id", "model", "updatedAt"]
  BASE_ENTITY_AUTO_FIELDS,      // ["createdAt", "history", "id", "updatedAt"]
  BASE_ENTITY_TIMESTAMP_FIELDS, // ["archivedAt", "createdAt", "deletedAt", "updatedAt"]

  // Type guards
  isBaseEntity,        // Check if value is a complete BaseEntity
  hasBaseEntityShape,  // Check if value has minimum shape (id + model)

  // Field helpers
  isAutoField,         // Check if field is auto-generated
  isTimestampField,    // Check if field is a timestamp

  // Utilities
  createBaseEntityInput,  // Create minimal input with required model
  pickBaseEntityFields,   // Extract only BaseEntity fields from object
} from "@jaypie/vocabulary";

// Example: Check if a field should be auto-generated
isAutoField("id");        // → true
isAutoField("name");      // → false

// Example: Extract BaseEntity fields from mixed object
const mixed = { id: "123", model: "record", customField: "value" };
pickBaseEntityFields(mixed);  // → { id: "123", model: "record" }
```

## TypeScript Types

```typescript
import type {
  // Entity types
  BaseEntity,
  BaseEntityFilter,
  BaseEntityInput,
  BaseEntityUpdate,
  HistoryEntry,
  Job,
  MessageEntity,
  Progress,
  Status,

  // Message types
  Message,
  MessageLevel,

  // Coercion types
  ArrayElementType,
  CoercionType,
  CompositeType,
  DateCoercionType,
  RegExpType,
  ScalarType,
  TypedArrayType,
  ValidatedNumberType,
  ValidatedStringType,

  // Service handler types
  InputFieldDefinition,
  ServiceContext,
  ServiceFunction,
  ServiceHandlerConfig,
  ServiceHandlerFunction,
  ValidateFunction,
} from "@jaypie/vocabulary";
```

### Message Type

Standard message structure for callbacks and notifications:

```typescript
type MessageLevel = "trace" | "debug" | "info" | "warn" | "error";

interface Message {
  content: string;
  level?: MessageLevel;  // Defaults to "info" if not specified
}
```

## Exports

### Main Export (`@jaypie/vocabulary`)

```typescript
// BaseEntity utilities
export {
  BASE_ENTITY_AUTO_FIELDS,
  BASE_ENTITY_FIELDS,
  BASE_ENTITY_REQUIRED_FIELDS,
  BASE_ENTITY_TIMESTAMP_FIELDS,
  createBaseEntityInput,
  hasBaseEntityShape,
  isAutoField,
  isBaseEntity,
  isTimestampField,
  pickBaseEntityFields,
} from "./base-entity.js";

// Coercion functions
export {
  coerce,
  coerceFromArray,
  coerceFromObject,
  coerceToArray,
  coerceToBoolean,
  coerceToNumber,
  coerceToObject,
  coerceToString,
} from "./coerce.js";

// Date coercion
export {
  coerceFromDate,
  coerceToDate,
  DateType,
  isDateType,
  isValidDate,
} from "./coerce-date.js";

// Status type
export { isStatus, STATUS_VALUES, StatusType } from "./status.js";

// Service Handler
export { serviceHandler } from "./serviceHandler.js";

// LLM adapter (re-exported, no optional deps)
export * as llm from "./llm/index.js";

// Note: Other adapters have optional dependencies and must be imported directly:
//   import { registerServiceCommand } from "@jaypie/vocabulary/commander";
//   import { lambdaServiceHandler } from "@jaypie/vocabulary/lambda";
//   import { registerMcpTool } from "@jaypie/vocabulary/mcp";

// Version
export const VOCABULARY_VERSION: string;
```

## Error Handling

Invalid coercions throw `BadRequestError` from `@jaypie/errors`:

```typescript
import { BadRequestError } from "@jaypie/errors";

// These throw BadRequestError:
await handler({ numerator: "not-a-number" });  // Cannot coerce to Number
await handler({ priority: 10 });                // Validation fails (not in [1,2,3,4,5])
await handler({});                              // Missing required field
```

## Integration with Other Packages

Vocabulary is designed to be consumed by:
- **`@jaypie/lambda`** - Lambda handler input processing
- **`@jaypie/express`** - Express route input validation
- **`@jaypie/llm`** - LLM tool parameter coercion via the llm adapter
- **`@jaypie/mcp`** - MCP server tool registration via the mcp adapter
- **CLI packages** - Commander.js integration via the commander adapter
