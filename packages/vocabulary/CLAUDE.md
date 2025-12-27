# @jaypie/vocabulary

Jaypie standard application component vocabulary - provides type coercion and service handler patterns for consistent input handling across Jaypie applications.

## Package Overview

| Attribute | Value |
|-----------|-------|
| Status | Initial development (0.1.x) |
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
- **Optional service**: When `service` is omitted, returns the processed input (validation-only mode)

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

### Types

Located in `types.ts`:

| Type | Description |
|------|-------------|
| `ScalarType` | `Boolean \| Number \| String` or string equivalents |
| `CompositeType` | `Array \| Object` or string equivalents |
| `ArrayElementType` | Types usable inside typed arrays |
| `TypedArrayType` | `[String]`, `[Number]`, `[Boolean]`, `[Object]`, `[]` |
| `RegExpType` | `RegExp` - bare regex coerces to String with validation |
| `ValidatedStringType` | `Array<string \| RegExp>` - string with validation |
| `ValidatedNumberType` | `Array<number>` - number with validation |
| `CoercionType` | Union of all type variants |
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
export type { ArrayElementType, CoercionType, CompositeType, InputFieldDefinition, RegExpType, ScalarType, ServiceFunction, ServiceHandlerConfig, ServiceHandlerFunction, TypedArrayType, ValidatedNumberType, ValidatedStringType, ValidateFunction } from "./types.js";

// Version
export const VOCABULARY_VERSION: string;
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
