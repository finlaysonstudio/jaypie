# @jaypie/fabric

Jaypie modeling framework - provides type conversion and service handler patterns for consistent input handling across Jaypie applications.

## Package Overview

| Attribute | Value |
|-----------|-------|
| Status | Initial development (0.1.x) |
| Type | Utility library |
| Dependencies | `@jaypie/errors` |
| Peer Dependencies | `@jaypie/aws` (optional), `@jaypie/lambda` (optional), `@modelcontextprotocol/sdk` (optional), `commander` (optional), `express` (optional) |
| Exports | Fabric functions, fabricService, llm adapter; commander/express/http/lambda/mcp via sub-paths |

## Internal Structure

```
src/
├── __tests__/
│   ├── commander.spec.ts         # Commander adapter tests
│   ├── express.spec.ts           # Express adapter tests
│   ├── http.spec.ts              # HTTP adapter tests
│   ├── index.spec.ts             # Export verification tests
│   ├── lambda.spec.ts            # Lambda adapter tests
│   ├── llm.spec.ts               # LLM adapter tests
│   ├── mcp.spec.ts               # MCP adapter tests
│   ├── model.spec.ts             # Model type tests
│   ├── resolve.spec.ts           # Resolution function tests
│   ├── resolve-date.spec.ts      # Date resolution tests
│   ├── service.spec.ts           # Service handler tests
│   └── status.spec.ts            # Status type tests
├── commander/
│   ├── createCommanderOptions.ts  # Generate Commander Options from config
│   ├── index.ts                   # Commander module exports
│   ├── parseCommanderOptions.ts   # Parse Commander opts to handler input
│   ├── fabricCommand.ts           # Register handler as Commander command
│   └── types.ts                   # Commander adapter types
├── express/
│   ├── fabricExpress.ts           # Express middleware from FabricHttpService
│   ├── FabricRouter.ts            # Multi-service Express Router
│   ├── index.ts                   # Express module exports
│   └── types.ts                   # Express adapter types
├── http/
│   ├── authorization.ts           # Token extraction and validation
│   ├── cors.ts                    # CORS configuration and headers
│   ├── fabricHttp.ts              # HTTP service wrapper
│   ├── httpTransform.ts           # HTTP context transformation
│   ├── index.ts                   # HTTP module exports
│   ├── stream.ts                  # SSE/NDJSON streaming utilities
│   └── types.ts                   # HTTP adapter types
├── lambda/
│   ├── fabricLambda.ts            # Wrap fabricService for Lambda
│   ├── index.ts                   # Lambda module exports
│   └── types.ts                   # Lambda adapter types
├── llm/
│   ├── fabricTool.ts              # Create LLM tool from fabricService
│   ├── index.ts                   # LLM module exports
│   ├── inputToJsonSchema.ts       # Convert input definitions to JSON Schema
│   └── types.ts                   # LLM adapter types
├── mcp/
│   ├── index.ts                   # MCP module exports
│   ├── fabricMcp.ts               # Register fabricService as MCP tool
│   └── types.ts                   # MCP adapter types
├── models/
│   └── base.ts                    # FabricModel, FabricJob, FabricMessage, Progress types
├── resolve.ts                     # Type resolution utilities
├── resolve-date.ts                # Date resolution utilities
├── index.ts                       # Package exports
├── index/                         # Index utilities for DynamoDB GSIs
│   ├── index.ts                   # Module exports
│   ├── keyBuilder.ts              # buildCompositeKey, calculateScope, populateIndexKeys
│   ├── registry.ts                # Model registry for custom indexes
│   └── types.ts                   # IndexDefinition, IndexableModel types
├── service.ts                     # Service handler factory
├── status.ts                      # Status type and validators
└── types.ts                       # TypeScript type definitions
```

## Core Concepts

### Fabric Functions (Type Conversion)

Located in `resolve.ts`. Handle flexible type conversion with predictable behavior:

| Function | Purpose |
|----------|---------|
| `fabric(value, type)` | Master conversion dispatcher |
| `fabricBoolean` | Convert to boolean (`"true"` -> `true`, positive numbers -> `true`) |
| `fabricNumber` | Convert to number (`"true"` -> `1`, booleans -> `0`/`1`) |
| `fabricString` | Convert to string (booleans -> `"true"`/`"false"`) |
| `fabricArray` | Wrap non-arrays in array |
| `resolveFromArray` | Extract single-element array to scalar |
| `fabricObject` | Wrap in `{ value: ... }` structure |
| `resolveFromObject` | Extract `.value` from object |

Key behaviors:
- Empty string `""` becomes `undefined`
- `null`/`undefined` passthrough as `undefined`
- Invalid conversions throw `BadRequestError`
- Multi-value arrays cannot convert to scalars (throws `BadRequestError`)

**Unwrapping** (scalar conversions only - `fabricBoolean`, `fabricNumber`, `fabricString`):
- Objects with `value` property unwrap: `{value: "true"}` → `true`
- Single-element arrays unwrap: `[true]` → `true`
- JSON strings parse and unwrap: `'{"value":"true"}'` → `true`, `'[42]'` → `42`
- Nested structures unwrap recursively: `[{value: "true"}]` → `true`

### fabricService

Located in `service.ts`. Factory function that creates validated service endpoints:

```typescript
const handler = fabricService({
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
fabric([1, 2, 3], [String])      // → ["1", "2", "3"]
fabric(["1", "2"], [Number])     // → [1, 2]
fabric([1, 0], [Boolean])        // → [true, false]
fabric([1, 2], [Object])         // → [{ value: 1 }, { value: 2 }]
fabric([1, "a", true], [])       // → [1, "a", true] (untyped, no element conversion)
```

**String Splitting**: Strings with commas or tabs are automatically split before conversion:

```typescript
fabric("1,2,3", [Number])        // → [1, 2, 3]
fabric("a, b, c", [String])      // → ["a", "b", "c"] (whitespace trimmed)
fabric("true\tfalse", [Boolean]) // → [true, false]
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
| `calculateScope(parent?)` | Calculate scope |
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
| `FabricModel` | Base type for all models with id, model (required) and optional name, class, type, content |
| `FabricModelInput` | Input for creating models (omits auto-generated fields) |
| `FabricModelUpdate` | Partial input for updating models |
| `FabricModelFilter` | Filter options for listing models |
| `FabricHistoryEntry` | Reverse delta recording previous values of changed fields |
| `FabricMessage` | Message model extending FabricModel with required content field |
| `FabricProgress` | Value object (not a model) tracking job execution progress |
| `FabricJob` | Job model extending FabricModel with status (required), startedAt, completedAt, messages, progress |
| `IndexDefinition` | GSI index definition with name, pk, sk |
| `IndexableModel` | Model with indexable fields |

## Exports

### Main Export (`@jaypie/fabric`)

```typescript
// Fabric functions (type conversion)
export { fabric, fabricArray, fabricBoolean, fabricNumber, fabricObject, fabricString, resolveFromArray, resolveFromObject } from "./resolve.js";
export { fabricDate, resolveFromDate, isValidDate, isDateType, DateType } from "./resolve-date.js";

// LLM adapter namespace (re-exported, no optional deps)
export * as llm from "./llm/index.js";

// Service Handler
export { fabricService } from "./service.js";

// Models
export { FabricModel, FabricJob, FabricMessage, Progress } from "./models/base.js";

// Index Utilities
export { buildCompositeKey, calculateScope, clearRegistry, DEFAULT_INDEXES, getAllRegisteredIndexes, getModelIndexes, populateIndexKeys, registerModel } from "./index/index.js";

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
export { fabricCommand } from "./fabricCommand.js";
export type { CommanderOptionOverride, CreateCommanderOptionsConfig, CreateCommanderOptionsResult, FabricCommandConfig, FabricCommandResult, OnCompleteCallback, OnErrorCallback, OnFatalCallback, OnMessageCallback, ParseCommanderOptionsConfig } from "./types.js";
```

### Lambda Export (`@jaypie/fabric/lambda`)

```typescript
export { fabricLambda } from "./fabricLambda.js";
export type { FabricLambdaConfig, FabricLambdaOptions, LambdaContext, OnCompleteCallback, OnErrorCallback, OnFatalCallback, OnMessageCallback } from "./types.js";
```

### LLM Export (`@jaypie/fabric/llm`)

```typescript
export { fabricTool } from "./fabricTool.js";
export { inputToJsonSchema } from "./inputToJsonSchema.js";
export type { FabricToolConfig, FabricToolResult, LlmTool, OnCompleteCallback, OnErrorCallback, OnFatalCallback, OnMessageCallback } from "./types.js";
```

### MCP Export (`@jaypie/fabric/mcp`)

```typescript
export { fabricMcp } from "./fabricMcp.js";
export type { FabricMcpConfig, FabricMcpResult, McpToolContentItem, McpToolResponse, OnCompleteCallback, OnErrorCallback, OnFatalCallback, OnMessageCallback } from "./types.js";
```

### Express Export (`@jaypie/fabric/express`)

```typescript
export { fabricExpress, isFabricExpressMiddleware } from "./fabricExpress.js";
export { FabricRouter, isFabricExpressRouter } from "./FabricRouter.js";
export type { FabricExpressConfig, FabricExpressMiddleware, FabricExpressRouter, FabricRouterConfig, FabricRouterServiceEntry, Request, Response, Router } from "./types.js";
```

### HTTP Export (`@jaypie/fabric/http`)

```typescript
// Main exports
export { fabricHttp, isFabricHttpService } from "./fabricHttp.js";
export type { HttpServiceContext } from "./fabricHttp.js";

// Authorization utilities
export { extractToken, getAuthHeader, isAuthorizationRequired, validateAuthorization } from "./authorization.js";

// CORS utilities
export { buildCorsHeaders, buildPreflightHeaders, DEFAULT_CORS_CONFIG, DEFAULT_CORS_METHODS, getAllowedOrigin, isPreflightRequest, normalizeCorsConfig } from "./cors.js";

// HTTP transformation utilities
export { createHttpContext, defaultHttpTransform, parseBody, parsePathParams, parseQueryString, transformHttpToInput } from "./httpTransform.js";

// Streaming utilities
export { collectStreamEvents, createCompleteEvent, createDataEvent, createErrorEvent, createMessageEvent, createNoopEvent, createStreamContext, createTextEvent, createToolCallEvent, createToolResultEvent, DEFAULT_STREAM_CONFIG, formatNdjsonEvent, formatSseEvent, formatStreamEvent, getStreamContentType, isAsyncIterable, isStreamingEnabled, llmChunkToHttpEvent, normalizeStreamConfig, pipeLlmStream, pipeLlmStreamToWriter, wrapServiceForStreaming } from "./stream.js";
export type { HttpStreamContext, LlmStreamChunk, PipeLlmStreamOptions, StreamWriter } from "./stream.js";

// Types
export type { AuthorizationConfig, AuthorizationFunction, CorsConfig, CorsHeaders, CorsOption, DataResponse, ErrorObject, ErrorResponse, FabricHttpConfig, FabricHttpService, HttpContext, HttpMethod, HttpStreamEvent, HttpStreamEventBase, HttpStreamEventComplete, HttpStreamEventData, HttpStreamEventError, HttpStreamEventMessage, HttpStreamEventNoop, HttpStreamEventText, HttpStreamEventToolCall, HttpStreamEventToolResult, HttpTransformFunction, StreamConfig, StreamingServiceFunction, StreamOption } from "./types.js";
export { DEFAULT_HTTP_METHODS, HttpStreamEventType } from "./types.js";
```

## Migration from @jaypie/vocabulary

| Old (vocabulary) | New (fabric) |
|------------------|--------------|
| `coerce` | `fabric` |
| `coerceToBoolean` | `fabricBoolean` |
| `coerceToNumber` | `fabricNumber` |
| `coerceToString` | `fabricString` |
| `coerceToArray` | `fabricArray` |
| `coerceFromArray` | `resolveFromArray` |
| `coerceToObject` | `fabricObject` |
| `coerceFromObject` | `resolveFromObject` |
| `coerceToDate` | `fabricDate` |
| `coerceFromDate` | `resolveFromDate` |
| `serviceHandler` | `fabricService` |
| `ServiceHandlerFunction` | `Service` |
| `ServiceHandlerConfig` | `ServiceConfig` |
| `CoercionType` | `ConversionType` |
| `lambdaServiceHandler` | `fabricLambda` |
| `LambdaServiceHandlerConfig` | `FabricLambdaConfig` |
| `createLlmTool` | `fabricTool` |
| `registerMcpTool` | `fabricMcp` |
| `registerServiceCommand` | `fabricCommand` |
| `BaseEntity` | `FabricModel` |
| `MessageEntity` | `FabricMessage` |
| `Job` | `FabricJob` |
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
