---
description: Core guide to Jaypie Fabric for type conversion, service handlers, and model types
---

# Jaypie Fabric Package

Jaypie Fabric (`@jaypie/fabric`) provides type conversion utilities, service handler patterns, and model types for consistent input handling across Jaypie applications.

## Related Adapter Guides

Fabric includes adapters for integrating service handlers with various platforms. See these guides for platform-specific integration:

| Guide | Import | Description |
|-------|--------|-------------|
| [Jaypie_Fabric_Commander.md](Jaypie_Fabric_Commander.md) | `@jaypie/fabric/commander` | Commander.js CLI integration with callbacks |
| [Jaypie_Fabric_Lambda.md](Jaypie_Fabric_Lambda.md) | `@jaypie/fabric/lambda` | AWS Lambda handler wrapping |
| [Jaypie_Fabric_LLM.md](Jaypie_Fabric_LLM.md) | `@jaypie/fabric/llm` | LLM tool creation for `@jaypie/llm` Toolkit |
| [Jaypie_Fabric_MCP.md](Jaypie_Fabric_MCP.md) | `@jaypie/fabric/mcp` | MCP server tool registration |

## Installation

```bash
npm install @jaypie/fabric
```

## Core Concepts

### Design Philosophy

Fabric follows the "Fabric" philosophy:
- **Smooth, pliable** - Things that feel right should work
- **Catch bad passes** - Invalid inputs throw clear errors

This means `"true"` works where `true` is expected, `"42"` works where `42` is expected, and invalid conversions fail fast with `BadRequestError`.

## fabricService

Factory function that creates validated service endpoints with automatic type conversion.

### Basic Usage

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

### Handler Properties

Config properties are attached directly to the handler for introspection:

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

### ServiceContext

Services receive an optional second parameter with context utilities:

```typescript
interface ServiceContext {
  onError?: (error: unknown) => void | Promise<void>;
  onFatal?: (error: unknown) => void | Promise<void>;
  sendMessage?: (message: Message) => void | Promise<void>;
}

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

**Note:** Any error that escapes the service (is thrown) is treated as fatal and routes to `onFatal`.

## Type Conversion

### Supported Types

| Type | Aliases | Description |
|------|---------|-------------|
| `String` | `"string"`, `""` | String conversion |
| `Number` | `"number"` | Number conversion |
| `Boolean` | `"boolean"` | Boolean conversion |
| `Date` | `DateType` | Date conversion (ISO strings, timestamps) |
| `Array` | `"array"`, `[]` | Array conversion |
| `Object` | `"object"`, `{}` | Object conversion |
| `[String]` | `[""]` | Typed array of strings |
| `[Number]` | - | Typed array of numbers |
| `[Boolean]` | - | Typed array of booleans |
| `[Object]` | `[{}]` | Typed array of objects |
| `/regex/` | - | String with regex validation |
| `["a", "b"]` | - | Validated string (must match) |
| `[1, 2, 3]` | - | Validated number (must match) |
| `StatusType` | - | Validated status ("pending", "processing", etc.) |

### Conversion Examples

```typescript
import { fabric, fabricBoolean, fabricNumber, fabricString } from "@jaypie/fabric";

// Boolean conversion
fabricBoolean("true");     // → true
fabricBoolean("false");    // → false
fabricBoolean(1);          // → true
fabricBoolean(0);          // → false

// Number conversion
fabricNumber("42");        // → 42
fabricNumber("true");      // → 1
fabricNumber("false");     // → 0

// String conversion
fabricString(true);        // → "true"
fabricString(42);          // → "42"

// Array conversion
fabric("1,2,3", [Number]);   // → [1, 2, 3]
fabric("a\tb\tc", [String]); // → ["a", "b", "c"]
fabric([1, 2], [String]);    // → ["1", "2"]

// Unwrapping
fabricNumber({ value: "42" });  // → 42
fabricBoolean(["true"]);        // → true
fabricNumber('{"value": 5}');   // → 5

// Date conversion
import { fabricDate, resolveFromDate } from "@jaypie/fabric";

fabricDate("2026-01-15T10:30:00Z");  // → Date object
fabricDate(1736942400000);            // → Date from timestamp
resolveFromDate(new Date(), String);  // → ISO string
resolveFromDate(new Date(), Number);  // → Unix timestamp (ms)
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
import { StatusType, isStatus, STATUS_VALUES } from "@jaypie/fabric";

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

## Model Types

Fabric provides standard model types for consistent data modeling:

```typescript
import type {
  FabricModel,
  FabricModelInput,
  FabricModelUpdate,
  FabricModelFilter,
  FabricHistoryEntry,
  FabricJob,
  FabricMessage,
  FabricProgress,
} from "@jaypie/fabric";
```

### FabricModel (base for all models)

```
model: <varies>
id: String (auto)
createdAt: Date (auto)
updatedAt: Date (auto)
history?: [FabricHistoryEntry] (auto)
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

### FabricMessage (extends FabricModel)

```
model: message
content: String (required)
type?: String (e.g., "assistant", "user", "system")
```

### FabricJob (extends FabricModel)

```
model: job
type?: String (e.g., "batch", "realtime", "scheduled")
class?: String (e.g., "evaluation", "export", "import")
status: String (required)
startedAt?: Date
completedAt?: Date
messages?: [FabricMessage]
progress?: FabricProgress (value object, not a model)
```

### FabricProgress (value object)

FabricProgress is a **value object** (not a model) embedded in FabricJob:

```typescript
interface FabricProgress {
  elapsedTime?: number;
  estimatedTime?: number;
  percentageComplete?: number;
  nextPercentageCheckpoint?: number;
}
```

### FabricModel Utilities

Field constants and utility functions for working with models:

```typescript
import {
  // Field name constants
  FABRIC_MODEL_FIELDS,           // All field names as constants
  FABRIC_MODEL_REQUIRED_FIELDS,  // ["createdAt", "id", "model", "updatedAt"]
  FABRIC_MODEL_AUTO_FIELDS,      // ["createdAt", "history", "id", "updatedAt"]
  FABRIC_MODEL_TIMESTAMP_FIELDS, // ["archivedAt", "createdAt", "deletedAt", "updatedAt"]

  // Type guards
  isFabricModel,        // Check if value is a complete FabricModel
  hasFabricModelShape,  // Check if value has minimum shape (id + model)

  // Field helpers
  isAutoField,         // Check if field is auto-generated
  isTimestampField,    // Check if field is a timestamp

  // Utilities
  createFabricModelInput,  // Create minimal input with required model
  pickFabricModelFields,   // Extract only FabricModel fields from object
} from "@jaypie/fabric";

// Example: Check if a field should be auto-generated
isAutoField("id");        // → true
isAutoField("name");      // → false

// Example: Extract FabricModel fields from mixed object
const mixed = { id: "123", model: "record", customField: "value" };
pickFabricModelFields(mixed);  // → { id: "123", model: "record" }
```

## TypeScript Types

```typescript
import type {
  // Model types
  FabricModel,
  FabricModelFilter,
  FabricModelInput,
  FabricModelUpdate,
  FabricHistoryEntry,
  FabricJob,
  FabricMessage,
  FabricProgress,
  Status,

  // Message types
  Message,
  MessageLevel,

  // Conversion types
  ArrayElementType,
  ConversionType,
  CompositeType,
  DateConversionType,
  RegExpType,
  ScalarType,
  TypedArrayType,
  ValidatedNumberType,
  ValidatedStringType,

  // Service handler types
  InputFieldDefinition,
  ServiceContext,
  ServiceFunction,
  ServiceConfig,
  Service,
  ValidateFunction,
} from "@jaypie/fabric";
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

### Main Export (`@jaypie/fabric`)

```typescript
// FabricModel utilities
export {
  FABRIC_MODEL_AUTO_FIELDS,
  FABRIC_MODEL_FIELDS,
  FABRIC_MODEL_REQUIRED_FIELDS,
  FABRIC_MODEL_TIMESTAMP_FIELDS,
  createFabricModelInput,
  hasFabricModelShape,
  isAutoField,
  isFabricModel,
  isTimestampField,
  pickFabricModelFields,
} from "./models/base.js";

// Resolution functions
export {
  fabric,
  fabricArray,
  fabricBoolean,
  fabricNumber,
  fabricObject,
  fabricString,
  resolveFromArray,
  resolveFromObject,
} from "./resolve.js";

// Date resolution
export {
  fabricDate,
  DateType,
  isDateType,
  isValidDate,
  resolveFromDate,
} from "./resolve-date.js";

// Status type
export { isStatus, STATUS_VALUES, StatusType } from "./status.js";

// Service Handler
export { fabricService } from "./service.js";

// LLM adapter (re-exported, no optional deps)
export * as llm from "./llm/index.js";

// Note: Other adapters have optional dependencies and must be imported directly:
//   import { fabricCommand } from "@jaypie/fabric/commander";
//   import { fabricLambda } from "@jaypie/fabric/lambda";
//   import { fabricMcp } from "@jaypie/fabric/mcp";

// Version
export const FABRIC_VERSION: string;
```

## Error Handling

Invalid conversions throw `BadRequestError` from `@jaypie/errors`:

```typescript
import { BadRequestError } from "@jaypie/errors";

// These throw BadRequestError:
await handler({ numerator: "not-a-number" });  // Cannot convert to Number
await handler({ priority: 10 });                // Validation fails (not in [1,2,3,4,5])
await handler({});                              // Missing required field
```

## ServiceSuite

ServiceSuite groups fabricService instances for discovery, metadata export, and direct execution. Useful for exposing services through MCP or other interfaces.

### Creating a ServiceSuite

```typescript
import { createServiceSuite, fabricService } from "@jaypie/fabric";

const suite = createServiceSuite({
  name: "myapp",
  version: "1.0.0",
});
```

### Registering Services

```typescript
const greetService = fabricService({
  alias: "greet",
  description: "Greet a user",
  input: {
    name: { type: String, required: true, description: "User's name" },
  },
  service: ({ name }) => `Hello, ${name}!`,
});

const echoService = fabricService({
  alias: "echo",
  description: "Echo input back",
  input: {
    message: { type: String, default: "Hello", description: "Message to echo" },
  },
  service: ({ message }) => message,
});

suite.register(greetService, "utils");
suite.register(echoService, "utils");
```

### Suite Properties and Methods

```typescript
// Properties
suite.name;        // "myapp"
suite.version;     // "1.0.0"
suite.categories;  // ["utils"] - sorted array of registered categories
suite.services;    // Array of ServiceMeta for all registered services

// Methods
suite.getService("greet");              // ServiceMeta | undefined
suite.getServicesByCategory("utils");   // ServiceMeta[]
await suite.execute("greet", { name: "Alice" });  // "Hello, Alice!"
```

### ServiceMeta Structure

```typescript
interface ServiceMeta {
  name: string;        // Service alias
  description: string; // Service description
  category: string;    // Category from registration
  inputs: ServiceInput[];  // Input parameter definitions
  executable?: boolean;    // True if service can run with no inputs
}

interface ServiceInput {
  name: string;
  type: string;      // "string", "number", "boolean", "object", "array"
  required: boolean;
  description: string;
  enum?: string[];   // For validated string/number types
}
```

### TypeScript Types

```typescript
import type {
  CreateServiceSuiteConfig,
  ServiceInput,
  ServiceMeta,
  ServiceSuite,
} from "@jaypie/fabric";
```

## Integration with Other Packages

Fabric is designed to be consumed by:
- **`@jaypie/lambda`** - Lambda handler input processing
- **`@jaypie/express`** - Express route input validation
- **`@jaypie/llm`** - LLM tool parameter conversion via the llm adapter
- **`@jaypie/mcp`** - MCP server tool registration via the mcp adapter
- **CLI packages** - Commander.js integration via the commander adapter
