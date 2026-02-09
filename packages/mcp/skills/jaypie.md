---
description: Jaypie overview and core concepts
---

# Introduction to Jaypie

Jaypie is a complete stack framework for building multi-environment cloud applications on AWS using TypeScript/Node.js.

## Core Packages

### Main Package: `jaypie`

The main package provides:
- **Secrets**: AWS Secrets Manager integration
- **Errors**: Structured error types (ConfigurationError, etc.)
- **Events**: Event parsing for Lambda handlers
- **Lifecycle**: Handler lifecycle management
- **Logging**: Structured logging with context
- **Queues**: SQS messaging utilities

```typescript
import {
  getSecret,
  log,
  ConfigurationError,
  HTTP,
  PROJECT
} from "jaypie";
```

### Infrastructure: `@jaypie/constructs`

CDK constructs for AWS infrastructure:
- Lambda functions with best practices
- SQS queues with DLQ
- S3 buckets with encryption
- CloudFront distributions
- Secrets Manager secrets

### Testing: `@jaypie/testkit`

Testing utilities and mocks:
- Mock implementations for all Jaypie functions
- Vitest configuration helpers
- Test data fabrication

## Project Structure

Jaypie projects use npm workspaces:

```
project/
├── packages/           # npm packages
│   ├── api/           # Express API
│   └── lib/           # Shared library
├── workspaces/        # CDK infrastructure
│   └── cdk/           # CDK app
└── package.json       # Root workspace config
```

## Key Conventions

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `PROJECT_ENV` | Environment: local, sandbox, production |
| `PROJECT_KEY` | Project identifier for logging |
| `PROJECT_NONCE` | Unique resource identifier |
| `LOG_LEVEL` | Log level: trace, debug, info, warn, error |

### Error Handling

Never throw vanilla `Error`. Use Jaypie errors:

```typescript
import { ConfigurationError, NotFoundError } from "jaypie";

if (!config.required) {
  throw new ConfigurationError("Missing required config");
}
```

### Logging

Use structured logging with context:

```typescript
import { log } from "jaypie";

log.info("Processing request", { userId, action });
log.error("Request failed", { error: error.message });
```

## Next Steps

- `skill("style")` - Code style conventions
- `skill("errors")` - Error handling patterns
- `skill("tests")` - Testing with Vitest
- `skill("cdk")` - Infrastructure with CDK
