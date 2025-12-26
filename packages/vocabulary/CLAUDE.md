# @jaypie/vocabulary

Jaypie standard application component vocabulary - provides type coercion and service handler patterns for consistent input handling across Jaypie applications.

## Package Overview

| Attribute | Value |
|-----------|-------|
| Status | Initial development (0.0.1) |
| Type | Utility library |
| Dependencies | `@jaypie/errors` |
| Exports | Coercion functions, serviceHandler, TypeScript types |

## Internal Structure

```
src/
├── __tests__/
│   ├── coerce.spec.ts       # Coercion function tests
│   ├── index.spec.ts        # Export verification tests
│   └── serviceHandler.spec.ts # Service handler tests
├── coerce.ts                # Type coercion utilities
├── index.ts                 # Package exports
├── serviceHandler.ts        # Service handler factory
└── types.ts                 # TypeScript type definitions
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

### Types

Located in `types.ts`:

| Type | Description |
|------|-------------|
| `ScalarType` | `Boolean \| Number \| String` or string equivalents |
| `CompositeType` | `Array \| Object` or string equivalents |
| `CoercionType` | Union of ScalarType and CompositeType |
| `InputFieldDefinition` | Field config with type, default, description, required, validate |
| `ValidateFunction` | `(value) => boolean \| void \| Promise<...>` |
| `ServiceFunction<TInput, TOutput>` | The actual service logic |
| `ServiceHandlerConfig` | Full handler configuration |
| `ServiceHandlerFunction` | The returned async handler |

## Exports

```typescript
// Coercion
export { coerce, coerceFromArray, coerceFromObject, coerceToArray, coerceToBoolean, coerceToNumber, coerceToObject, coerceToString } from "./coerce.js";

// Service Handler
export { serviceHandler } from "./serviceHandler.js";

// Types
export type { CoercionType, CompositeType, InputFieldDefinition, ScalarType, ServiceFunction, ServiceHandlerConfig, ServiceHandlerFunction, ValidateFunction } from "./types.js";

// Version
export const VOCABULARY_VERSION = "0.0.1";
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
- Invalid conversions fail fast with `BadRequestError`
