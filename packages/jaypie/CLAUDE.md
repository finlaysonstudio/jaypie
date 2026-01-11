# packages/jaypie

Main entrypoint package for Jaypie. Aggregates and re-exports functionality from multiple Jaypie subpackages into a single unified import.

## Purpose

This package serves as the primary consumer-facing interface. Instead of importing from multiple `@jaypie/*` packages, applications import from `jaypie`:

```typescript
import { lambdaHandler, log, getSecret, BadRequestError } from "jaypie";
```

## Structure

```
src/
├── __tests__/
│   └── index.spec.js    # Export verification tests
├── error.constant.ts    # ERROR constant with message/title/type maps
└── index.ts             # Re-exports from all subpackages
```

## Dependencies (Re-exported)

| Package | Exports |
|---------|---------|
| `@jaypie/aws` | `getSecret`, `sendMessage` |
| `@jaypie/datadog` | `DATADOG`, `submitMetric` |
| `@jaypie/errors` | All error classes, `errorFromStatusCode` |
| `@jaypie/express` | `EXPRESS`, `expressHandler`, `cors` |
| `@jaypie/kit` | Core utilities (`uuid`, `JAYPIE`, `PROJECT`, etc.) |
| `@jaypie/lambda` | `lambdaHandler` |
| `@jaypie/logger` | `log` |

## Peer Dependencies (Optional)

- `@jaypie/llm` - LLM provider integrations
- `@jaypie/mongoose` - MongoDB/Mongoose utilities

## Local Exports

### ERROR Constant

Provides standardized error messages, titles, and types:

```typescript
import { ERROR } from "jaypie";

ERROR.MESSAGE.NOT_FOUND  // "The requested resource was not found"
ERROR.TITLE.NOT_FOUND    // "Not Found"
ERROR.TYPE.NOT_FOUND     // "NOT_FOUND"
```

### Backwards Compatibility Aliases

```typescript
// These are aliases for InternalError:
ProjectError, MultiError, ProjectMultiError
```

## Commands

```bash
npm run build -w packages/jaypie      # Build package
npm run test -w packages/jaypie       # Run tests
npm run typecheck -w packages/jaypie  # Type check
npm run lint -w packages/jaypie       # Lint
```

## Adding New Exports

When adding exports from a new subpackage:

1. Add the dependency to `package.json`
2. Add the re-export to `src/index.ts`
3. Add verification tests to `src/__tests__/index.spec.js`
4. Update `@jaypie/testkit` if mocks are needed
