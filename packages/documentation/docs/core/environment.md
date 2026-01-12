---
sidebar_position: 4
---

# Environment Variables and Secrets

**Use this page when:** configuring Jaypie applications for different environments, loading secrets from AWS Secrets Manager, or understanding environment variable conventions.

**Prerequisites:** `npm install jaypie`

## Overview

Jaypie uses environment variables with consistent naming conventions across infrastructure and runtime.
Secrets are loaded from AWS Secrets Manager using a resolution pattern that supports local development.

## Quick Reference

### Variable Prefixes

| Prefix | Purpose | Example |
|--------|---------|---------|
| `PROJECT_` | Application identity | `PROJECT_ENV`, `PROJECT_KEY` |
| `CDK_ENV_` | Infrastructure resources | `CDK_ENV_QUEUE_URL`, `CDK_ENV_BUCKET` |
| `SECRET_` | Secret references | `SECRET_MONGODB_URI` |
| `LOG_` | Logging configuration | `LOG_LEVEL`, `LOG_FORMAT` |

### Core Variables

| Variable | Values | Description |
|----------|--------|-------------|
| `PROJECT_ENV` | local, sandbox, production | Environment identifier |
| `PROJECT_KEY` | string | Project identifier for logging |
| `PROJECT_NONCE` | string | Unique resource identifier |
| `NODE_ENV` | development, production, test | Node environment |
| `LOG_LEVEL` | trace, debug, info, warn, error | Logging threshold |

## Environment Detection

```typescript
import { isLocalEnv, isProductionEnv, isNodeTestEnv } from "jaypie";

if (isLocalEnv()) {
  // PROJECT_ENV === "local"
}

if (isProductionEnv()) {
  // PROJECT_ENV === "production" OR PROJECT_PRODUCTION === "true"
}

if (isNodeTestEnv()) {
  // NODE_ENV === "test"
}
```

## Secrets Management

### Resolution Pattern

`getEnvSecret` resolves secrets in order:

1. `SECRET_{name}` - Fetches from AWS Secrets Manager
2. `{name}_SECRET` - Alternative, fetches from AWS Secrets Manager
3. `{name}` - Direct value (used as-is)

```typescript
import { getEnvSecret } from "jaypie";

// If SECRET_API_KEY="secrets/api-key", fetches from Secrets Manager
// If API_KEY="sk-123", returns "sk-123" directly
const apiKey = await getEnvSecret("API_KEY");
```

### Handler Secrets

Load secrets automatically in handlers:

```typescript
import { expressHandler } from "jaypie";

export default expressHandler(handler, {
  secrets: ["MONGODB_URI", "API_KEY"],
});
// process.env.MONGODB_URI and process.env.API_KEY available in handler
```

### Manual Loading

Load multiple secrets into `process.env`:

```typescript
import { loadEnvSecrets } from "jaypie";

await loadEnvSecrets("MONGODB_URI", "API_KEY", "JWT_SECRET");
// process.env.MONGODB_URI, etc. now populated
```

### Direct Secret Fetch

Fetch a secret by its AWS Secrets Manager name:

```typescript
import { getSecret } from "jaypie";

const dbUri = await getSecret("prod/mongodb-uri");
```

## CDK Infrastructure Variables

### Queue Configuration

```typescript
// Runtime
import { sendMessage } from "jaypie";

// Uses CDK_ENV_QUEUE_URL by default
await sendMessage({ event: "user.created", userId: "123" });
```

```typescript
// CDK
new JaypieQueuedLambda(this, "Worker", {
  code: "dist",
  handler: "worker.handler",
});
// Sets CDK_ENV_QUEUE_URL automatically
```

### Bucket Configuration

```typescript
// Environment variable
process.env.CDK_ENV_BUCKET; // S3 bucket name

// CDK
new JaypieBucketQueuedLambda(this, "Processor", {
  bucketName: "uploads",
  // Sets CDK_ENV_BUCKET automatically
});
```

### SNS Configuration

| Variable | Description |
|----------|-------------|
| `CDK_ENV_SNS_TOPIC_ARN` | SNS topic ARN |
| `CDK_ENV_SNS_ROLE_ARN` | IAM role for SNS |

## Local Development

### Direct Values

For local development, set values directly:

```bash
# .env.local
MONGODB_URI=mongodb://localhost:27017/myapp
API_KEY=test-api-key
PROJECT_ENV=local
```

### Secret References

In deployed environments, use secret references:

```bash
# Environment (set by CDK)
SECRET_MONGODB_URI=prod/mongodb-uri
SECRET_API_KEY=prod/api-key
PROJECT_ENV=production
```

### Using env-cmd

```json
{
  "scripts": {
    "dev": "env-cmd -f .env.local tsx watch src/server.ts"
  }
}
```

## CDK Secrets Pattern

### Declaring Secrets

```typescript
import { JaypieEnvSecret, JaypieLambda } from "@jaypie/constructs";

// Create secret reference
const mongoSecret = new JaypieEnvSecret(this, "MongoSecret", {
  secretName: "prod/mongodb-uri",
  envName: "MONGODB_URI",
});

// Lambda with secret
new JaypieLambda(this, "Api", {
  secrets: [mongoSecret],
});
// Lambda has SECRET_MONGODB_URI pointing to Secrets Manager
```

### Datadog API Key

```typescript
new JaypieLambda(this, "Api", {
  // CDK_ENV_DATADOG_API_KEY_ARN set automatically
});
```

## Environment Variable Matrix

| Variable | Local | Sandbox | Production |
|----------|-------|---------|------------|
| `PROJECT_ENV` | local | sandbox | production |
| `MONGODB_URI` | mongodb://localhost | (via secret) | (via secret) |
| `LOG_LEVEL` | trace | debug | info |
| `NODE_ENV` | development | production | production |

## Testing Environment

```typescript
import { isNodeTestEnv } from "jaypie";

// In tests, NODE_ENV=test
if (isNodeTestEnv()) {
  // Skip external calls, use mocks
}
```

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      PROJECT_ENV: "local",
    },
  },
});
```

## Related

- [Handler Lifecycle](/docs/core/handler-lifecycle) - Secrets loading in handlers
- [CDK Infrastructure](/docs/guides/cdk-infrastructure) - Setting up CDK constructs
- [@jaypie/constructs](/docs/packages/constructs) - CDK construct reference
- [CI/CD](/docs/guides/cicd) - Environment configuration in deployments
