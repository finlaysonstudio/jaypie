# @jaypie/kit

Utility functions for Jaypie applications. This is a foundational package providing core utilities, constants, and the `jaypieHandler` lifecycle wrapper used across the Jaypie ecosystem.

## Package Dependencies

**Used by:** `@jaypie/aws`, `@jaypie/core`, `@jaypie/datadog`, `@jaypie/express`, `@jaypie/jaypie`, `@jaypie/lambda`, `@jaypie/llm`, `@jaypie/mongoose`, `@jaypie/testkit`

**Depends on:** `@jaypie/errors`, `@jaypie/logger`, `uuid`

## Directory Structure

```
src/
├── __tests__/           # Unit tests
├── core/
│   └── constants.ts     # JAYPIE and PROJECT constant objects
├── lib/
│   ├── arguments/       # Argument processing utilities
│   │   ├── force.function.ts    # Type coercion (force.string, force.number, etc.)
│   │   └── isClass.function.ts  # Class detection
│   ├── functions/       # Utility functions
│   │   ├── cloneDeep.ts         # Deep clone implementation
│   │   ├── envBoolean.ts        # Parse boolean from env vars
│   │   ├── envsKey.ts           # Multi-env key resolution
│   │   ├── formatError.function.ts
│   │   ├── getHeaderFrom.function.ts
│   │   ├── getObjectKeyCaseInsensitive.ts
│   │   ├── invokeChaos.function.ts  # Chaos engineering support
│   │   ├── placeholders.ts      # String placeholder replacement
│   │   ├── resolveValue.ts      # Async value resolution
│   │   ├── safeParseFloat.function.ts
│   │   └── sleep.function.ts
│   ├── functions.lib.ts  # Re-exports from functions/
│   └── http.lib.ts       # HTTP constants (codes, headers, methods)
├── types/               # TypeScript type definitions
├── core.ts              # Re-exports JAYPIE, PROJECT, and logger
├── index.ts             # Main entry point
├── isLocalEnv.ts        # Check if running locally
├── isNodeTestEnv.ts     # Check if NODE_ENV === "test"
├── isProductionEnv.ts   # Check if production environment
└── jaypieHandler.module.ts  # Handler lifecycle wrapper
```

## Key Exports

### Constants

- `JAYPIE` - Core constants: `ENV` (environment variable names), `LIB` (package names), `LAYER` (execution layers), `LOGGER`
- `PROJECT` - Project constants: `SPONSOR` (sponsor identifiers)
- `HTTP` - HTTP constants: `CODE`, `CONTENT`, `HEADER`, `METHOD`

### Environment Checks

- `isLocalEnv()` - Returns true if running in local/development environment
- `isNodeTestEnv()` - Returns true if `NODE_ENV === "test"`
- `isProductionEnv()` - Returns true if `PROJECT_ENV === "production"` OR `PROJECT_PRODUCTION === "true"`

### Handler

- `jaypieHandler(handler, options)` - Wraps async handlers with lifecycle management:
  - `unavailable` - Return 503 when true
  - `validate[]` - Validation functions (throw or return false to reject)
  - `setup[]` - Pre-handler lifecycle functions
  - `teardown[]` - Post-handler cleanup (always runs)
  - `chaos` - Chaos engineering mode (from `PROJECT_CHAOS` env)

### Type Coercion

- `force(value, type, options)` - Coerce values to specified types
- `force.array(value)` - Ensure value is an array
- `force.boolean(value)` - Parse boolean (handles "false", "0", "no", etc.)
- `force.number(value)` - Parse number with optional min/max
- `force.object(value, key)` - Ensure value is an object
- `force.positive(value)` - Parse positive number (min: 0)
- `force.string(value, default)` - Ensure value is a string

### Utility Functions

- `cloneDeep(value)` - Deep clone objects
- `envBoolean(key, options)` - Parse boolean from environment variable
- `envsKey(key)` - Resolve environment-specific keys
- `formatError(error)` - Format errors for logging
- `getHeaderFrom(headers, key)` - Case-insensitive header lookup
- `getObjectKeyCaseInsensitive(obj, key)` - Case-insensitive object key lookup
- `isClass(value)` - Check if value is a class constructor
- `placeholders(template, values)` - Replace placeholders in strings
- `resolveValue(value)` - Await value if it's a promise
- `safeParseFloat(value)` - Safe float parsing
- `sleep(ms)` - Promise-based delay
- `uuid()` - Generate UUID v4 (re-exported from `uuid`)

## Usage Patterns

### Handler Lifecycle

```typescript
import { jaypieHandler } from "@jaypie/kit";

export default jaypieHandler(
  async (event) => {
    // Main handler logic
    return { success: true };
  },
  {
    validate: [validateEvent],
    setup: [initDatabase],
    teardown: [closeConnections],
  },
);
```

### Type Coercion

```typescript
import { force } from "@jaypie/kit";

const count = force.number(process.env.COUNT);  // 0 if invalid
const enabled = force.boolean("false");         // false
const items = force.array(singleItem);          // [singleItem]
```

### Environment Checks

```typescript
import { isProductionEnv, isNodeTestEnv } from "@jaypie/kit";

if (isProductionEnv()) {
  // Production-only behavior
}
```

## Testing

When mocking `@jaypie/kit` in tests, use `@jaypie/testkit` which provides mock implementations for all exports.
