# @jaypie/fabric

Jaypie modeling framework - provides type conversion and service handler patterns for consistent input handling across Jaypie applications.

## Package Overview

| Attribute | Value |
|-----------|-------|
| Status | Initial development (0.0.x) |
| Type | Utility library |
| Dependencies | `@jaypie/errors` |
| Peer Dependencies | `@jaypie/aws` (optional), `@jaypie/lambda` (optional), `@modelcontextprotocol/sdk` (optional), `commander` (optional) |
| Exports | Conversion functions, createService, llm adapter; commander/lambda/mcp via sub-paths |

## Internal Structure

```
src/
├── __tests__/
│   ├── convert.spec.ts           # Conversion function tests
│   ├── convert-date.spec.ts      # Date conversion tests
│   ├── commander.spec.ts         # Commander adapter tests
│   ├── index.spec.ts             # Export verification tests
│   ├── lambda.spec.ts            # Lambda adapter tests
│   ├── llm.spec.ts               # LLM adapter tests
│   ├── mcp.spec.ts               # MCP adapter tests
│   ├── model.spec.ts             # Model type tests
│   ├── service.spec.ts           # Service handler tests
│   └── status.spec.ts            # Status type tests
├── commander/
│   ├── createCommanderOptions.ts  # Generate Commander Options from config
│   ├── index.ts                   # Commander module exports
│   ├── parseCommanderOptions.ts   # Parse Commander opts to handler input
│   ├── registerServiceCommand.ts  # Register handler as Commander command
│   └── types.ts                   # Commander adapter types
├── lambda/
│   ├── createLambdaService.ts     # Wrap createService for Lambda
│   ├── index.ts                   # Lambda module exports
│   └── types.ts                   # Lambda adapter types
├── llm/
│   ├── createLlmTool.ts           # Create LLM tool from createService
│   ├── index.ts                   # LLM module exports
│   ├── inputToJsonSchema.ts       # Convert input definitions to JSON Schema
│   └── types.ts                   # LLM adapter types
├── mcp/
│   ├── index.ts                   # MCP module exports
│   ├── registerMcpTool.ts         # Register createService as MCP tool
│   └── types.ts                   # MCP adapter types
├── models/
│   └── base.ts                    # BaseModel, JobModel, MessageModel, Progress types
├── convert.ts                     # Type conversion utilities
├── convert-date.ts                # Date conversion utilities
├── index.ts                       # Package exports
├── index/                         # Index utilities
│   ├── buildCompositeKey.ts
│   ├── calculateOu.ts
│   ├── defaultIndexes.ts
│   ├── index.ts
│   ├── populateIndexKeys.ts
│   └── registry.ts
├── service.ts                     # Service handler factory
├── status.ts                      # Status type and validators
└── types.ts                       # TypeScript type definitions
```

## Core Concepts

### Conversion Functions

Located in `convert.ts`. Handle flexible type conversion with predictable behavior:

| Function | Purpose |
|----------|---------|
| `convert(value, type)` | Master conversion dispatcher |
| `convertToBoolean` | Convert to boolean (`"true"` -> `true`, positive numbers -> `true`) |
| `convertToNumber` | Convert to number (`"true"` -> `1`, booleans -> `0`/`1`) |
| `convertToString` | Convert to string (booleans -> `"true"`/`"false"`) |
| `convertToArray` | Wrap non-arrays in array |
| `convertFromArray` | Extract single-element array to scalar |
| `convertToObject` | Wrap in `{ value: ... }` structure |
| `convertFromObject` | Extract `.value` from object |

Key behaviors:
- Empty string `""` becomes `undefined`
- `null`/`undefined` passthrough as `undefined`
- Invalid conversions throw `BadRequestError`
- Multi-value arrays cannot convert to scalars (throws `BadRequestError`)

**Unwrapping** (scalar conversions only - `convertToBoolean`, `convertToNumber`, `convertToString`):
- Objects with `value` property unwrap: `{value: "true"}` → `true`
- Single-element arrays unwrap: `[true]` → `true`
- JSON strings parse and unwrap: `'{"value":"true"}'` → `true`, `'[42]'` → `42`
- Nested structures unwrap recursively: `[{value: "true"}]` → `true`

### createService

Located in `service.ts`. Factory function that creates validated service endpoints:

```typescript
const handler = createService({
  alias: "optional-name",
  description: "Optional description",
  input: {
    fieldName: {
      type: Number,           // ConversionType (Boolean, Number, String, Array, Object)
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
- Converts all defined fields to their types
- Applies defaults before conversion
- **Required validation**: Fields are required unless they have a `default` OR `required: false`
- Runs validation (sync or async) after conversion
- Always returns a Promise
- **Optional service**: When `service` is omitted, returns the processed input (validation-only mode)
- **Flat properties**: Config properties attached directly to handler (`handler.alias`, `handler.input`, etc.)

### Typed Arrays

Typed arrays (`[String]`, `[Number]`, `[Boolean]`, `[Object]`, `[]`) convert each element:

```typescript
convert([1, 2, 3], [String])      // → ["1", "2", "3"]
convert(["1", "2"], [Number])     // → [1, 2]
convert([1, 0], [Boolean])        // → [true, false]
convert([1, 2], [Object])         // → [{ value: 1 }, { value: 2 }]
convert([1, "a", true], [])       // → [1, "a", true] (untyped, no element conversion)
```

**String Splitting**: Strings with commas or tabs are automatically split before conversion:

```typescript
convert("1,2,3", [Number])        // → [1, 2, 3]
convert("a, b, c", [String])      // → ["a", "b", "c"] (whitespace trimmed)
convert("true\tfalse", [Boolean]) // → [true, false]
```

### Index Utilities

Located in `src/index/`. Utilities for DynamoDB single-table design patterns:

| Function | Purpose |
|----------|---------|
| `registerModel({ model, indexes })` | Register custom indexes for a model |
| `getModelIndexes(model)` | Get indexes for a model (custom or DEFAULT_INDEXES) |
| `clearRegistry()` | Clear all registered models (for testing) |
| `getAllRegisteredIndexes()` | Get all registered custom indexes |
| `populateIndexKeys(entity, indexes, suffix?)` | Populate GSI keys on an entity |
| `buildCompositeKey(entity, fields, suffix?)` | Build composite key from entity fields |
| `calculateOu(parent?)` | Calculate organizational unit |
| `DEFAULT_INDEXES` | Standard GSI definitions |

### Types

Located in `types.ts`:

| Type | Description |
|------|-------------|
| `MessageLevel` | `"trace" \| "debug" \| "info" \| "warn" \| "error"` - log levels for messages |
| `Message` | `{ content: string; level?: MessageLevel }` - standard message structure |
| `ServiceContext` | `{ onError?, onFatal?, sendMessage? }` - context passed to services |
| `ScalarType` | `Boolean \| Number \| String` or string equivalents |
| `CompositeType` | `Array \| Object` or string equivalents |
| `ArrayElementType` | Types usable inside typed arrays |
| `TypedArrayType` | `[String]`, `[Number]`, `[Boolean]`, `[Object]`, `[]` |
| `RegExpType` | `RegExp` - bare regex converts to String with validation |
| `ValidatedStringType` | `Array<string \| RegExp>` - string with validation |
| `ValidatedNumberType` | `Array<number>` - number with validation |
| `ConversionType` | Union of all type variants |
| `InputFieldDefinition` | Field config with type, default, description, flag, letter, required, validate |
| `ValidateFunction` | `(value) => boolean \| void \| Promise<...>` |
| `ServiceFunction<TInput, TOutput>` | The actual service logic |
| `ServiceConfig` | Full handler configuration |
| `Service` | The returned async handler |

### Model Types

Located in `models/base.ts`:

| Type | Description |
|------|-------------|
| `BaseModel` | Base type for all models with id, model (required) and optional name, class, type, content |
| `BaseModelInput` | Input for creating models (omits auto-generated fields) |
| `BaseModelUpdate` | Partial input for updating models |
| `BaseModelFilter` | Filter options for listing models |
| `HistoryEntry` | Reverse delta recording previous values of changed fields |
| `MessageModel` | Message model extending BaseModel with required content field |
| `Progress` | Tracks job execution progress |
| `JobModel` | Job model extending BaseModel with status (required), startedAt, completedAt, messages, progress |
| `IndexDefinition` | GSI index definition with name, pk, sk |
| `IndexableModel` | Model with indexable fields |

## Exports

### Main Export (`@jaypie/fabric`)

```typescript
// Conversion
export { convert, convertFromArray, convertFromObject, convertToArray, convertToBoolean, convertToNumber, convertToObject, convertToString } from "./convert.js";
export { convertFromDate, convertToDate } from "./convert-date.js";

// LLM adapter namespace (re-exported, no optional deps)
export * as llm from "./llm/index.js";

// Service Handler
export { createService } from "./service.js";

// Models
export { BaseModel, JobModel, MessageModel, Progress } from "./models/base.js";

// Index Utilities
export { buildCompositeKey, calculateOu, clearRegistry, DEFAULT_INDEXES, getAllRegisteredIndexes, getModelIndexes, populateIndexKeys, registerModel } from "./index/index.js";

// Constants
export { APEX, ARCHIVED_SUFFIX, DELETED_SUFFIX, SEPARATOR } from "./constants.js";

// Types
export type { ConversionType, InputFieldDefinition, Message, MessageLevel, Service, ServiceConfig, ServiceContext, ServiceFunction, ValidateFunction } from "./types.js";
export type { IndexableModel, IndexDefinition } from "./index/index.js";

// Version
export const FABRIC_VERSION: string;
```

### Commander Export (`@jaypie/fabric/commander`)

```typescript
export { createCommanderOptions } from "./createCommanderOptions.js";
export { parseCommanderOptions } from "./parseCommanderOptions.js";
export { registerServiceCommand } from "./registerServiceCommand.js";
export type { CommanderOptionOverride, CreateCommanderOptionsConfig, CreateCommanderOptionsResult, OnCompleteCallback, OnErrorCallback, OnFatalCallback, OnMessageCallback, ParseCommanderOptionsConfig, RegisterServiceCommandConfig, RegisterServiceCommandResult } from "./types.js";
```

### Lambda Export (`@jaypie/fabric/lambda`)

```typescript
export { createLambdaService } from "./createLambdaService.js";
export type { CreateLambdaServiceConfig, CreateLambdaServiceOptions, LambdaContext, OnCompleteCallback, OnErrorCallback, OnFatalCallback, OnMessageCallback } from "./types.js";
```

### LLM Export (`@jaypie/fabric/llm`)

```typescript
export { createLlmTool } from "./createLlmTool.js";
export { inputToJsonSchema } from "./inputToJsonSchema.js";
export type { CreateLlmToolConfig, CreateLlmToolResult, LlmTool, OnCompleteCallback, OnErrorCallback, OnFatalCallback, OnMessageCallback } from "./types.js";
```

### MCP Export (`@jaypie/fabric/mcp`)

```typescript
export { registerMcpTool } from "./registerMcpTool.js";
export type { McpToolContentItem, McpToolResponse, OnCompleteCallback, OnErrorCallback, OnFatalCallback, OnMessageCallback, RegisterMcpToolConfig, RegisterMcpToolResult } from "./types.js";
```

## Migration from @jaypie/vocabulary

| Old (vocabulary) | New (fabric) |
|------------------|--------------|
| `coerce` | `convert` |
| `coerceToBoolean` | `convertToBoolean` |
| `coerceToNumber` | `convertToNumber` |
| `coerceToString` | `convertToString` |
| `coerceToArray` | `convertToArray` |
| `coerceFromArray` | `convertFromArray` |
| `coerceToObject` | `convertToObject` |
| `coerceFromObject` | `convertFromObject` |
| `coerceToDate` | `convertToDate` |
| `coerceFromDate` | `convertFromDate` |
| `serviceHandler` | `createService` |
| `ServiceHandlerFunction` | `Service` |
| `ServiceHandlerConfig` | `ServiceConfig` |
| `CoercionType` | `ConversionType` |
| `lambdaServiceHandler` | `createLambdaService` |
| `LambdaServiceHandlerConfig` | `CreateLambdaServiceConfig` |
| `BaseEntity` | `BaseModel` |
| `MessageEntity` | `MessageModel` |
| `Job` | `JobModel` |
| `IndexableEntity` | `IndexableModel` |
| `VOCABULARY_VERSION` | `FABRIC_VERSION` |

## Development Commands

```bash
npm run build -w packages/fabric   # Build package
npm run test -w packages/fabric    # Run tests
npm run typecheck -w packages/fabric
npm run lint -w packages/fabric
```

## Design Philosophy

The "Fabric" philosophy:
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
