# @jaypie/mongoose

MongoDB ODM integration with Mongoose for Jaypie applications.

## Purpose

This package provides lifecycle-aware MongoDB connection management using Mongoose. It integrates with AWS Secrets Manager for secure credential handling and follows Jaypie's handler lifecycle patterns.

## Directory Structure

```
mongoose/
├── src/
│   ├── __tests__/                    # Unit tests
│   ├── connect.function.ts           # Main connection function
│   ├── connectFromSecretEnv.function.ts  # AWS Secrets Manager connection
│   └── index.ts                      # Public exports
├── archive/                          # Archived/legacy code
├── rollup.config.mjs                 # Build configuration
├── testSetup.js                      # Vitest setup
└── vite.config.mjs                   # Vite/Vitest configuration
```

## Public API

### Functions

| Export | Description |
|--------|-------------|
| `connect()` | Connect to MongoDB using `SECRET_MONGODB_URI` secret or `MONGODB_URI` env var |
| `connectFromSecretEnv()` | Connect using AWS Secrets Manager secret name from `SECRET_MONGODB_URI` |
| `disconnect()` | Disconnect from MongoDB |
| `mongoose` | Re-exported mongoose instance for direct access |

### Connection Priority

1. If `SECRET_MONGODB_URI` env var exists, fetch URI from AWS Secrets Manager
2. Otherwise, use `MONGODB_URI` env var directly
3. Throws `ConfigurationError` if neither is available

## Usage

```typescript
import { connect, disconnect } from "@jaypie/mongoose";

// In Jaypie handler setup phase
await connect();

// In Jaypie handler teardown phase
await disconnect();
```

## Dependencies

### Peer Dependencies (must be installed by consumer)
- `@jaypie/errors` - Error types
- `@jaypie/kit` - Jaypie constants
- `@jaypie/logger` - Logging
- `mongoose` - MongoDB ODM

### Direct Dependencies
- `@jaypie/aws` - AWS Secrets Manager access via `getSecret()`

## Used By

- `@jaypie/jaypie` - Re-exported as part of the main Jaypie package
- `@jaypie/testkit` - Provides mocks for `connect`, `connectFromSecretEnv`, `disconnect`

## Testing

Mocks are available in `@jaypie/testkit`:

```typescript
import { connect, disconnect } from "@jaypie/testkit/mock/mongoose";
```

## Commands

```bash
npm run build      # Build with Rollup
npm run test       # Run tests with Vitest
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint
npm run format     # Auto-fix lint issues
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SECRET_MONGODB_URI` | AWS Secret name containing MongoDB connection string (preferred) |
| `MONGODB_URI` | Direct MongoDB connection URI (fallback) |

## Notes

- Connection timeout is set to 5000ms (`serverSelectionTimeoutMS`)
- Uses Jaypie structured logging with `JAYPIE.LIB.MONGOOSE` tag
- Designed for use within Jaypie handler lifecycle (setup/teardown phases)
