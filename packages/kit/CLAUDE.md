# @jaypie/kit

Utility functions for Jaypie applications. This is a foundational package providing core utilities, constants, and the `jaypieHandler` lifecycle wrapper used across the Jaypie ecosystem.

## Package Dependencies

**Used by:** `@jaypie/aws`, `@jaypie/core`, `@jaypie/datadog`, `@jaypie/express`, `@jaypie/jaypie`, `@jaypie/lambda`, `@jaypie/llm`, `@jaypie/testkit`

**Depends on:** `@jaypie/errors`, `@jaypie/logger`, `js-yaml`, `uuid`

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
│   │   ├── jaypieKey.function.ts    # API key generate/validate/hash
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
  - `scrub` - Error scrubbing, `boolean | { client?: boolean, server?: boolean }`,
    defaults to `{ client: false, server: true }`

  Caught Jaypie errors log by status: 4xx at debug, 500 and above at error, both
  with `log.var({ jaypieError: { detail, status, title } })`. A 500-class error
  then has its `detail` and `title` replaced with the generic strings for its
  status, so a constructor message describing application internals never
  reaches a response body. 4xx keeps its detail as thrown, since a client error
  is only actionable when it says what to correct. `scrub` overrides either
  class; `status`, `message`, and `stack` are untouched either way. A scrubbed
  unmapped 4xx status takes the bad request strings and keeps its own status; a
  status outside 4xx and 5xx is never scrubbed. Non-Jaypie errors log at fatal
  and become `UnhandledError`.

### Type Coercion

- `force(value, type, options)` - Coerce values to specified types
- `force.array(value)` - Ensure value is an array
- `force.boolean(value)` - Parse boolean (handles "false", "0", "no", etc.)
- `force.number(value)` - Parse number with optional min/max
- `force.object(value, key)` - Ensure value is an object
- `force.positive(value)` - Parse positive number (min: 0)
- `force.string(value, default)` - Ensure value is a string

### API Key Functions

- `generateJaypieKey({ checksum, environment, issuer, length, pool, prefix, seed, separator, version })` - Generate API keys (prefix, environment, and checksum optional, seed for deterministic derivation)
  - `environment` defaults to `PROJECT_ENV` and sits between issuer and body, omitted in production or when `false`
  - `checksum` is truthiness only and emits five characters from a position-weighted rolling hash, each character a positional digit of the hash in base `pool.length` so the five span `pool.length^5` (~29.8 bits for base62); `version: 1` reproduces a pre-1.2.16 key with the four-character sum
  - Deriving every character from the same `hash % pool.length` collapses the checksum to `pool.length` values however long it is, since `(hash * p + o) % n` depends only on `hash % n`. That shipped in 1.2.16 and let ~6.9% of tampered keys validate; 1.2.17 fixes it and invalidates five-character keys minted by 1.2.16
  - Random bodies use rejection sampling; seeded bodies read HMAC blocks in counter mode under a versioned message
- `validateJaypieKey(key, options)` - Validate key format/checksum (prefix, environment, and checksum not required, accepts `_` or `-`)
  - Accepts a four-character legacy checksum or the five-character current one, so no existing key was invalidated
  - Throws `UnauthorizedError` when a key carrying an environment is validated in production with an `issuer`
- `hashJaypieKey(key, { salt })` - SHA-256/HMAC-SHA256 key hashing (reads `PROJECT_SALT` env)
- `jaypieApiKeyId(key, { namespace, salt })` - Derive a deterministic UUIDv5 from the hashed key, suitable as a user-facing DynamoDB id

### Utility Functions

- `cloneDeep(value)` - Deep clone objects
- `envBoolean(key, options)` - Parse boolean from environment variable
- `envsKey(key)` - Resolve environment-specific keys
- `formatError(error)` - Format errors for logging
- `getHeaderFrom(headers, key)` - Case-insensitive header lookup
- `getObjectKeyCaseInsensitive(obj, key)` - Case-insensitive object key lookup
- `isClass(value)` - Check if value is a class constructor
- `parseFrontmatter(content)` - Parse YAML frontmatter, returns `{ content, data }`
- `placeholders(template, values)` - Replace placeholders in strings
- `resolveValue(value)` - Await value if it's a promise
- `safeParseFloat(value)` - Safe float parsing
- `sleep(ms)` - Promise-based delay
- `stringifyFrontmatter(content, data)` - Serialize body + frontmatter to a string
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
