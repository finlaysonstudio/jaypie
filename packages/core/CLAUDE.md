# @jaypie/core

Utility package providing constants, errors, argument validation, and logging for the Jaypie ecosystem.

## Package Role

`@jaypie/core` serves as the foundational utility layer for Jaypie applications. It aggregates and re-exports functionality from lower-level packages (`@jaypie/errors`, `@jaypie/kit`, `@jaypie/logger`) while providing its own argument validation utilities.

**Primary consumer:** The `jaypie` umbrella package depends on `@jaypie/core` and re-exports its functionality.

## Directory Structure

```
src/
├── __tests__/           # Package-level integration tests
├── core/                # Core constants and internal utilities
│   ├── __tests__/       # Unit tests for core utilities
│   ├── constants.ts     # JAYPIE and PROJECT constants
│   └── *.pipeline.ts    # Internal pipeline utilities (not exported)
├── lib/                 # Library modules
│   ├── __tests__/       # Unit tests for lib modules
│   ├── arguments/       # Argument validation (validate, optional, required)
│   │   ├── __tests__/   # Unit tests for argument validation
│   │   ├── constants.ts # TYPE constants for validation
│   │   ├── index.ts     # Arguments module entry point
│   │   ├── optional.function.ts
│   │   ├── required.function.ts
│   │   └── validate.function.ts  # [DEPRECATED]
│   ├── arguments.lib.ts # Re-exports from arguments/
│   └── errors.lib.ts    # Re-exports from @jaypie/errors + ERROR constant
├── core.ts              # Core module exports (JAYPIE, PROJECT, log)
└── index.ts             # Package entry point
```

## Exports

### Constants
- `JAYPIE` - Environment variables, library names, layers, logger types
- `PROJECT` - Project sponsor identifiers

### Argument Validation
- `validate` - [DEPRECATED] Type validation function with convenience methods
- `optional` - Mark parameters as optional with type checking
- `required` - Mark parameters as required with type checking
- `VALIDATE` (aliased as `TYPE`) - Validation type constants
- `force` - Force value conversion (from `@jaypie/kit`)
- `isClass` - Check if value is a class (from `@jaypie/kit`)

### Errors (from `@jaypie/errors`)
All error classes and utilities from `@jaypie/errors` are re-exported:
- `BadGatewayError`, `BadRequestError`, `ConfigurationError`, `CorsError`
- `ForbiddenError`, `GatewayTimeoutError`, `GoneError`, `IllogicalError`
- `InternalError`, `MethodNotAllowedError`, `NotFoundError`, `NotImplementedError`
- `RejectedError`, `TeapotError`, `TooManyRequestsError`, `UnauthorizedError`
- `UnavailableError`, `UnhandledError`, `UnreachableCodeError`
- `errorFromStatusCode` (aliased from `jaypieErrorFromStatus`)
- `ERROR` constant with MESSAGE, TITLE, and TYPE mappings

**Backwards compatibility aliases:**
- `ProjectError`, `MultiError`, `ProjectMultiError` - All alias to `InternalError`

### Functions (from `@jaypie/kit`)
- `cloneDeep`, `envBoolean`, `envsKey`, `formatError`
- `getHeaderFrom`, `getObjectKeyCaseInsensitive`
- `placeholders`, `resolveValue`, `safeParseFloat`, `sleep`

### Handler
- `jaypieHandler` - Core handler wrapper (from `@jaypie/kit`)

### HTTP
- `HTTP` - HTTP constants (from `@jaypie/kit`)

### Logging
- `log` - Singleton logger instance (from `@jaypie/logger`)

### Utilities
- `uuid` - UUID generation (from `@jaypie/kit`)

## Usage in Other Packages

Import from `@jaypie/core` for:
```typescript
import { log } from "@jaypie/core";
import { validate } from "@jaypie/core";  // deprecated
import { BadRequestError, NotFoundError } from "@jaypie/core";
import { force } from "@jaypie/core";
import { cloneDeep, uuid } from "@jaypie/core";
```

Most applications should import from `jaypie` instead, which re-exports everything from `@jaypie/core`.

## Dependencies

- `@jaypie/errors` - Error class definitions
- `@jaypie/kit` - Utility functions and handlers
- `@jaypie/logger` - Logging singleton

## Notes

- The `validate` function is deprecated; prefer TypeScript type checking
- The `log` export is the singleton instance from `@jaypie/logger`, ensuring tag propagation works across the application
- Pipeline utilities in `src/core/` are internal and not exported
