# @jaypie/vocabulary

Jaypie standard application component vocabulary - provides type coercion and service handler patterns for consistent input handling across Jaypie applications.

## Package Overview

| Attribute | Value |
|-----------|-------|
| Status | Initial development (0.1.x) |
| Type | Utility library |
| Dependencies | `@jaypie/errors` |
| Peer Dependencies | `@jaypie/aws` (optional), `@jaypie/lambda` (optional), `@modelcontextprotocol/sdk` (optional), `commander` (optional) |
| Exports | Coercion functions, serviceHandler, llm adapter; commander/lambda/mcp via sub-paths |

## Internal Structure

```
src/
├── __tests__/
│   ├── base-entity.spec.ts    # Entity type tests
│   ├── coerce.spec.ts         # Coercion function tests
│   ├── coerce-date.spec.ts    # Date coercion tests
│   ├── commander.spec.ts      # Commander adapter tests
│   ├── index.spec.ts          # Export verification tests
│   ├── lambda.spec.ts         # Lambda adapter tests
│   ├── llm.spec.ts            # LLM adapter tests
│   ├── mcp.spec.ts            # MCP adapter tests
│   ├── serviceHandler.spec.ts # Service handler tests
│   └── status.spec.ts         # Status type tests
├── commander/
│   ├── createCommanderOptions.ts  # Generate Commander Options from config
│   ├── index.ts                   # Commander module exports
│   ├── parseCommanderOptions.ts   # Parse Commander opts to handler input
│   ├── registerServiceCommand.ts  # Register handler as Commander command
│   └── types.ts                   # Commander adapter types
├── lambda/
│   ├── index.ts                   # Lambda module exports
│   ├── lambdaServiceHandler.ts    # Wrap serviceHandler for Lambda
│   └── types.ts                   # Lambda adapter types
├── llm/
│   ├── createLlmTool.ts           # Create LLM tool from serviceHandler
│   ├── index.ts                   # LLM module exports
│   ├── inputToJsonSchema.ts       # Convert input definitions to JSON Schema
│   └── types.ts                   # LLM adapter types
├── mcp/
│   ├── index.ts                   # MCP module exports
│   ├── registerMcpTool.ts         # Register serviceHandler as MCP tool
│   └── types.ts                   # MCP adapter types
├── base-entity.ts             # BaseEntity, Job, MessageEntity, Progress types
├── coerce.ts                  # Type coercion utilities
├── coerce-date.ts             # Date coercion utilities
├── index.ts                   # Package exports
├── serviceHandler.ts          # Service handler factory
├── status.ts                  # Status type and validators
└── types.ts                   # TypeScript type definitions
```

## Core Concepts

### Coercion Functions

Located in `coerce.ts`. Handle flexible type conversion with predictable behavior:

| Function | Purpose |
|----------|---------|
| `coerce(value, type)` | Master coercion dispatcher |
| `coerceToBoolean` | Convert to boolean (`"true"` -> `true`, positive numbers -> `true`) |
| `coerceToNumber` | Convert to number (`"true"` -> `1`, booleans -> `0`/`1`) |
| `coerceToString` | Convert to string (booleans -> `"true"`/`"false"`) |
| `coerceToArray` | Wrap non-arrays in array |
| `coerceFromArray` | Extract single-element array to scalar |
| `coerceToObject` | Wrap in `{ value: ... }` structure |
| `coerceFromObject` | Extract `.value` from object |

Key behaviors:
- Empty string `""` becomes `undefined`
- `null`/`undefined` passthrough as `undefined`
- Invalid coercions throw `BadRequestError`
- Multi-value arrays cannot coerce to scalars (throws `BadRequestError`)

**Unwrapping** (scalar coercions only - `coerceToBoolean`, `coerceToNumber`, `coerceToString`):
- Objects with `value` property unwrap: `{value: "true"}` → `true`
- Single-element arrays unwrap: `[true]` → `true`
- JSON strings parse and unwrap: `'{"value":"true"}'` → `true`, `'[42]'` → `42`
- Nested structures unwrap recursively: `[{value: "true"}]` → `true`

### Service Handler

Located in `serviceHandler.ts`. Factory function that creates validated service endpoints:

```typescript
const handler = serviceHandler({
  alias: "optional-name",
  description: "Optional description",
  input: {
    fieldName: {
      type: Number,           // CoercionType (Boolean, Number, String, Array, Object)
      default: 42,            // Optional default value
      description: "...",     // Optional description
      required: false,        // Optional: defaults to true unless default is set
      validate: (v) => v > 0, // Optional: function, RegExp, or array
    },
  },
  service: (input) => input.fieldName * 2,
});
```

Handler features:
- Accepts object or JSON string input
- Coerces all defined fields to their types
- Applies defaults before coercion
- **Required validation**: Fields are required unless they have a `default` OR `required: false`
- Runs validation (sync or async) after coercion
- Always returns a Promise
- **Optional service**: When `service` is omitted, returns the processed input (validation-only mode)
- **Flat properties**: Config properties attached directly to handler (`handler.alias`, `handler.input`, etc.)

#### Validation Only (No Service)

```typescript
const validateUser = serviceHandler({
  input: {
    age: { type: Number, validate: (v) => v >= 18 },
    email: { type: [/^[^@]+@[^@]+\.[^@]+$/] },
  },
  // no service - returns processed input
});

await validateUser({ age: "25", email: "bob@example.com" });
// → { age: 25, email: "bob@example.com" }
```

### Typed Arrays

Typed arrays (`[String]`, `[Number]`, `[Boolean]`, `[Object]`, `[]`) coerce each element:

```typescript
coerce([1, 2, 3], [String])      // → ["1", "2", "3"]
coerce(["1", "2"], [Number])     // → [1, 2]
coerce([1, 0], [Boolean])        // → [true, false]
coerce([1, 2], [Object])         // → [{ value: 1 }, { value: 2 }]
coerce([1, "a", true], [])       // → [1, "a", true] (untyped, no element coercion)
```

**String Splitting**: Strings with commas or tabs are automatically split before coercion:

```typescript
coerce("1,2,3", [Number])        // → [1, 2, 3]
coerce("a, b, c", [String])      // → ["a", "b", "c"] (whitespace trimmed)
coerce("true\tfalse", [Boolean]) // → [true, false]
```

Priority order:
1. JSON parsing: `"[1,2,3]"` parses as JSON array
2. Comma splitting: `"1,2,3"` splits on comma
3. Tab splitting: `"1\t2\t3"` splits on tab
4. Single element wrap: `"42"` becomes `["42"]`

### RegExp Type Shorthand

A bare RegExp as type coerces to String and validates against the pattern:

```typescript
email: { type: /^[^@]+@[^@]+\.[^@]+$/ }  // Coerces to String, validates against regex
url: { type: /^https?:\/\/.+/ }           // Same behavior
```

This is equivalent to `{ type: String, validate: /regex/ }` but more concise.

### Validated Type Shorthand

Arrays of literals validate a value against allowed options:

```typescript
// String validation - array of strings and/or RegExp
currency: { type: ["dec", "sps"] }        // Must be "dec" or "sps"
value: { type: [/^test-/, "special"] }    // Matches regex OR equals "special"
email: { type: [/^[^@]+@[^@]+\.[^@]+$/] } // Must match email pattern (array form)

// Number validation - array of numbers
priority: { type: [1, 2, 3, 4, 5] }       // Must be 1-5
rating: { type: [0.5, 1, 1.5, 2] }        // Must be one of these values
```

This is equivalent to `{ type: String, validate: [...] }` or `{ type: Number, validate: [...] }` but more concise.

### Commander Adapter

Located in `src/commander/`. Utilities for integrating service handlers with Commander.js CLIs.

**registerServiceCommand**: Registers a serviceHandler as a Commander.js command with automatic option generation.

```typescript
import { Command } from "commander";
import { serviceHandler } from "@jaypie/vocabulary";
import { registerServiceCommand } from "@jaypie/vocabulary/commander";

const handler = serviceHandler({
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
registerServiceCommand({ handler, program });
program.parse();
// Usage: greet --user Alice -l
```

**registerServiceCommand with callbacks**: Supports lifecycle callbacks for handling results, errors, and messages:

```typescript
const handler = serviceHandler({
  alias: "evaluate",
  input: { jobId: { type: String } },
  service: async ({ jobId }, context) => {
    context?.sendMessage?.({ content: `Starting job ${jobId}` });

    // Handle recoverable errors without throwing
    try {
      await riskyOperation();
    } catch (err) {
      context?.onError?.(err); // Reports error but continues
    }

    // For fatal errors, either throw or call context.onFatal()
    if (criticalFailure) {
      context?.onFatal?.(new Error("Cannot continue"));
    }

    return { jobId, status: "complete" };
  },
});

registerServiceCommand({
  handler,
  program,
  onComplete: (response) => {
    console.log("Done:", JSON.stringify(response, null, 2));
  },
  onError: (error) => {
    // Recoverable errors reported via context.onError()
    console.error("Warning:", error);
  },
  onFatal: (error) => {
    // Fatal errors (thrown or via context.onFatal())
    console.error("Fatal:", error);
    process.exit(1);
  },
  onMessage: (msg) => {
    console[msg.level || "info"](msg.content);
  },
});
```

| Callback | Type | Description |
|----------|------|-------------|
| `onComplete` | `(response: unknown) => void \| Promise<void>` | Called with handler's return value on success |
| `onError` | `(error: unknown) => void \| Promise<void>` | Receives errors reported via `context.onError()` in service |
| `onFatal` | `(error: unknown) => void \| Promise<void>` | Receives fatal errors (thrown or via `context.onFatal()`) |
| `onMessage` | `(message: Message) => void \| Promise<void>` | Receives messages from `context.sendMessage` in service |

**Error handling**: Services receive `context.onError()` and `context.onFatal()` callbacks to report errors without throwing. Any error that escapes the service (is thrown) is treated as fatal and routes to `onFatal`. If `onFatal` is not provided, thrown errors fall back to `onError`. If neither callback is provided, errors are re-thrown.

**createCommanderOptions**: Generates Commander.js `Option` objects from handler input definitions.

```typescript
import { createCommanderOptions } from "@jaypie/vocabulary/commander";

const { options } = createCommanderOptions(handler.input, {
  exclude: ["internalField"],
  overrides: { userName: { short: "u" } },
});
options.forEach((opt) => program.addOption(opt));
```

**parseCommanderOptions**: Converts Commander.js options back to handler input format.

```typescript
import { parseCommanderOptions } from "@jaypie/vocabulary/commander";

const input = parseCommanderOptions(program.opts(), {
  input: handler.input,
});
await handler(input);
```

### Lambda Adapter

Located in `src/lambda/`. Utilities for integrating service handlers with AWS Lambda.

**lambdaServiceHandler**: Wraps a serviceHandler for use as an AWS Lambda handler with full lifecycle management.

```typescript
import { serviceHandler } from "@jaypie/vocabulary";
import { lambdaServiceHandler } from "@jaypie/vocabulary/lambda";

const evaluationsHandler = serviceHandler({
  alias: "evaluationsHandler",
  input: {
    count: { type: Number, default: 1 },
    models: { type: [String], default: [] },
    plan: { type: String },
  },
  service: ({ count, models, plan }) => ({
    jobId: `job-${Date.now()}`,
    plan,
  }),
});

// Config object style
export const handler = lambdaServiceHandler({
  handler: evaluationsHandler,
  secrets: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"],
});

// Or handler with options style
export const handler2 = lambdaServiceHandler(evaluationsHandler, {
  secrets: ["ANTHROPIC_API_KEY"],
  setup: [async () => { /* initialization */ }],
  teardown: [async () => { /* cleanup */ }],
});
```

Features:
- Uses `getMessages()` from `@jaypie/aws` to extract messages from SQS/SNS events
- Calls the service handler once for each message
- Returns single response if one message, array of responses if multiple
- Uses `handler.alias` as the logging handler name (overridable via `name` option)
- Supports all `lambdaHandler` options: `chaos`, `name`, `secrets`, `setup`, `teardown`, `throw`, `unavailable`, `validate`

**lambdaServiceHandler with callbacks**: Supports lifecycle callbacks for handling results, errors, and messages:

```typescript
const handler = serviceHandler({
  alias: "evaluate",
  input: { jobId: { type: String } },
  service: async ({ jobId }, context) => {
    context?.sendMessage?.({ content: `Starting job ${jobId}` });

    // Handle recoverable errors without throwing
    try {
      await riskyOperation();
    } catch (err) {
      context?.onError?.(err); // Reports error but continues
    }

    // For fatal errors, either throw or call context.onFatal()
    if (criticalFailure) {
      context?.onFatal?.(new Error("Cannot continue"));
    }

    return { jobId, status: "complete" };
  },
});

export const lambdaHandler = lambdaServiceHandler({
  handler,
  onComplete: (response) => {
    console.log("Done:", JSON.stringify(response, null, 2));
  },
  onError: (error) => {
    // Recoverable errors reported via context.onError()
    console.error("Warning:", error);
  },
  onFatal: (error) => {
    // Fatal errors (thrown or via context.onFatal())
    console.error("Fatal:", error);
  },
  onMessage: (msg) => {
    console.log(`[${msg.level || "info"}] ${msg.content}`);
  },
});
```

| Callback | Type | Description |
|----------|------|-------------|
| `onComplete` | `(response: unknown) => void \| Promise<void>` | Called with handler's return value on success |
| `onError` | `(error: unknown) => void \| Promise<void>` | Receives errors reported via `context.onError()` in service |
| `onFatal` | `(error: unknown) => void \| Promise<void>` | Receives fatal errors (thrown or via `context.onFatal()`) |
| `onMessage` | `(message: Message) => void \| Promise<void>` | Receives messages from `context.sendMessage` in service |

**Error handling**: Services receive `context.onError()` and `context.onFatal()` callbacks to report errors without throwing. Any error that escapes the service (is thrown) is treated as fatal and routes to `onFatal`. If `onFatal` is not provided, thrown errors fall back to `onError`. Callback errors are swallowed to ensure failures never halt service execution.

### LLM Adapter

Located in `src/llm/`. Utilities for integrating service handlers with `@jaypie/llm` Toolkit.

**createLlmTool**: Creates an LLM tool from a serviceHandler for use with Toolkit:

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

// Use with Toolkit
const toolkit = new Toolkit([tool]);
```

| Option | Type | Description |
|--------|------|-------------|
| `handler` | `ServiceHandlerFunction` | Required. The service handler to adapt |
| `name` | `string` | Override tool name (defaults to handler.alias) |
| `description` | `string` | Override tool description (defaults to handler.description) |
| `message` | `string \| function` | Custom message for logging |
| `exclude` | `string[]` | Fields to exclude from tool parameters |
| `onComplete` | `(response: unknown) => void \| Promise<void>` | Called with tool's return value on success |
| `onError` | `(error: unknown) => void \| Promise<void>` | Receives errors reported via `context.onError()` in service |
| `onFatal` | `(error: unknown) => void \| Promise<void>` | Receives fatal errors (thrown or via `context.onFatal()`) |
| `onMessage` | `(message: Message) => void \| Promise<void>` | Receives messages from `context.sendMessage` in service |

**createLlmTool with callbacks**: Supports lifecycle callbacks for handling results, errors, and messages:

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

**inputToJsonSchema**: Converts vocabulary input definitions to JSON Schema for LLM tools:

```typescript
import { inputToJsonSchema } from "@jaypie/vocabulary/llm";

const schema = inputToJsonSchema(handler.input, { exclude: ["internal"] });
// Returns JSON Schema with properties, required array, and type: "object"
```

Features:
- Automatically converts vocabulary types to JSON Schema types
- Handles typed arrays, validated types, and regex patterns
- Generates `enum` for validated string/number types
- Respects `required` and `default` settings

### MCP Adapter

Located in `src/mcp/`. Utilities for integrating service handlers with Model Context Protocol servers.

**registerMcpTool**: Registers a serviceHandler as an MCP tool:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { serviceHandler } from "@jaypie/vocabulary";
import { registerMcpTool } from "@jaypie/vocabulary/mcp";

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

const server = new McpServer({ name: "my-server", version: "1.0.0" });
registerMcpTool({ handler, server });
```

| Option | Type | Description |
|--------|------|-------------|
| `handler` | `ServiceHandlerFunction` | Required. The service handler to adapt |
| `server` | `McpServer` | Required. The MCP server to register with |
| `name` | `string` | Override tool name (defaults to handler.alias) |
| `description` | `string` | Override tool description (defaults to handler.description) |
| `onComplete` | `(response: unknown) => void \| Promise<void>` | Called with tool's return value on success |
| `onError` | `(error: unknown) => void \| Promise<void>` | Receives errors reported via `context.onError()` in service |
| `onFatal` | `(error: unknown) => void \| Promise<void>` | Receives fatal errors (thrown or via `context.onFatal()`) |
| `onMessage` | `(message: Message) => void \| Promise<void>` | Receives messages from `context.sendMessage` in service |

**registerMcpTool with callbacks**: Supports lifecycle callbacks for handling results, errors, and messages:

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

registerMcpTool({
  handler,
  server,
  onComplete: (result) => console.log("Tool completed:", result),
  onError: (error) => console.warn("Recoverable error:", error),
  onFatal: (error) => console.error("Fatal error:", error),
  onMessage: (msg) => console.log(`[${msg.level || "info"}] ${msg.content}`),
});
```

**Error handling**: Services receive `context.onError()` and `context.onFatal()` callbacks to report errors without throwing. Any error that escapes the service (is thrown) is treated as fatal and routes to `onFatal`. If `onFatal` is not provided, thrown errors fall back to `onError`. Callback errors are swallowed to ensure failures never halt service execution.

Features:
- Uses handler.alias as tool name (overridable)
- Uses handler.description as tool description (overridable)
- Delegates input validation to the service handler
- Formats responses as MCP text content

### Types

Located in `types.ts`:

| Type | Description |
|------|-------------|
| `MessageLevel` | `"trace" \| "debug" \| "info" \| "warn" \| "error"` - log levels for messages |
| `Message` | `{ content: string; level?: MessageLevel }` - standard message structure |
| `ServiceContext` | `{ onError?, onFatal?, sendMessage? }` - context passed to services with error/message callbacks |
| `ScalarType` | `Boolean \| Number \| String` or string equivalents |
| `CompositeType` | `Array \| Object` or string equivalents |
| `ArrayElementType` | Types usable inside typed arrays |
| `TypedArrayType` | `[String]`, `[Number]`, `[Boolean]`, `[Object]`, `[]` |
| `RegExpType` | `RegExp` - bare regex coerces to String with validation |
| `ValidatedStringType` | `Array<string \| RegExp>` - string with validation |
| `ValidatedNumberType` | `Array<number>` - number with validation |
| `CoercionType` | Union of all type variants |
| `InputFieldDefinition` | Field config with type, default, description, flag, letter, required, validate |
| `ValidateFunction` | `(value) => boolean \| void \| Promise<...>` |
| `ServiceFunction<TInput, TOutput>` | The actual service logic |
| `ServiceHandlerConfig` | Full handler configuration |
| `ServiceHandlerFunction` | The returned async handler |

### Entity Types

Located in `base-entity.ts`:

| Type | Description |
|------|-------------|
| `BaseEntity` | Base type for all vocabulary entities with id, model (required) and optional name, class, type, content |
| `BaseEntityInput` | Input for creating entities (omits auto-generated fields) |
| `BaseEntityUpdate` | Partial input for updating entities |
| `BaseEntityFilter` | Filter options for listing entities |
| `HistoryEntry` | Reverse delta recording previous values of changed fields |
| `MessageEntity` | Message entity extending BaseEntity with required content field |
| `Progress` | Tracks job execution progress (elapsedTime, estimatedTime, percentageComplete, nextPercentageCheckpoint) |
| `Job` | Job entity extending BaseEntity with status (required), startedAt, completedAt, messages, progress |

#### Entity Model Schemas

**BaseEntity** (base for all entities):
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

**MessageEntity** (extends BaseEntity):
```
model: message
content: String (required)
type?: String (e.g., "assistant", "user", "system")
```

**Job** (extends BaseEntity):
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

## Exports

### Main Export (`@jaypie/vocabulary`)

```typescript
// Coercion
export { coerce, coerceFromArray, coerceFromObject, coerceToArray, coerceToBoolean, coerceToNumber, coerceToObject, coerceToString } from "./coerce.js";

// LLM adapter namespace (re-exported, no optional deps)
export * as llm from "./llm/index.js";

// Note: Other adapters have optional dependencies and must be imported directly:
//   import { registerServiceCommand } from "@jaypie/vocabulary/commander";
//   import { lambdaServiceHandler } from "@jaypie/vocabulary/lambda";
//   import { registerMcpTool } from "@jaypie/vocabulary/mcp";

// Service Handler
export { serviceHandler } from "./serviceHandler.js";

// Types
export type { ArrayElementType, CoercionType, CompositeType, InputFieldDefinition, Message, MessageLevel, RegExpType, ScalarType, ServiceContext, ServiceFunction, ServiceHandlerConfig, ServiceHandlerFunction, TypedArrayType, ValidatedNumberType, ValidatedStringType, ValidateFunction } from "./types.js";

// Version
export const VOCABULARY_VERSION: string;
```

### Commander Export (`@jaypie/vocabulary/commander`)

```typescript
export { createCommanderOptions } from "./createCommanderOptions.js";
export { parseCommanderOptions } from "./parseCommanderOptions.js";
export { registerServiceCommand } from "./registerServiceCommand.js";
export type { CommanderOptionOverride, CreateCommanderOptionsConfig, CreateCommanderOptionsResult, OnCompleteCallback, OnErrorCallback, OnFatalCallback, OnMessageCallback, ParseCommanderOptionsConfig, RegisterServiceCommandConfig, RegisterServiceCommandResult } from "./types.js";
```

### Lambda Export (`@jaypie/vocabulary/lambda`)

```typescript
export { lambdaServiceHandler } from "./lambdaServiceHandler.js";
export type { LambdaContext, LambdaServiceHandlerConfig, LambdaServiceHandlerOptions, LambdaServiceHandlerResult, OnCompleteCallback, OnErrorCallback, OnFatalCallback, OnMessageCallback } from "./types.js";
```

### LLM Export (`@jaypie/vocabulary/llm`)

```typescript
export { createLlmTool } from "./createLlmTool.js";
export { inputToJsonSchema } from "./inputToJsonSchema.js";
export type { CreateLlmToolConfig, CreateLlmToolResult, LlmTool, OnCompleteCallback, OnErrorCallback, OnFatalCallback, OnMessageCallback } from "./types.js";
```

### MCP Export (`@jaypie/vocabulary/mcp`)

```typescript
export { registerMcpTool } from "./registerMcpTool.js";
export type { McpToolContentItem, McpToolResponse, OnCompleteCallback, OnErrorCallback, OnFatalCallback, OnMessageCallback, RegisterMcpToolConfig, RegisterMcpToolResult } from "./types.js";
```

## Usage in Other Packages

This package is designed to be consumed by:
- **`@jaypie/lambda`** - Lambda handler input processing
- **`@jaypie/express`** - Express route input validation
- **`@jaypie/llm`** - Tool parameter coercion
- **`jaypie`** - Re-exported for application use

Currently in initial development and not yet integrated into other packages.

## Development Commands

```bash
npm run build -w packages/vocabulary   # Build package
npm run test -w packages/vocabulary    # Run tests
npm run typecheck -w packages/vocabulary
npm run lint -w packages/vocabulary
```

## Design Philosophy

The "Fabric" philosophy from README.md:
- **Smooth, pliable** - Things that feel right should work
- **Catch bad passes** - Invalid inputs throw clear errors

This means:
- `"true"` works where `true` is expected
- `"42"` works where `42` is expected
- `{value: X}` unwraps for all scalar types (Boolean, Number, String)
- `[X]` unwraps for all scalar types
- `'{"value":X}'` and `'[X]'` parse and unwrap for all scalar types
- JSON strings automatically parse
- `"1,2,3"` splits into array when target is typed array
- `"a\tb\tc"` splits on tabs when target is typed array
- `["a", "b"]` as type means validated string (must be "a" or "b")
- `/regex/` as type means string validated against pattern (bare RegExp)
- `[/regex/]` as type means string validated against pattern (array form)
- `[1, 2, 3]` as type means validated number (must be 1, 2, or 3)
- Invalid conversions fail fast with `BadRequestError`
