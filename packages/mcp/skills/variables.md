---
description: Environment variables reference
related: secrets, cdk, datadog
---

# Environment Variables

Configuration variables used in Jaypie applications.

## Project Variables

| Variable | Description | Values |
|----------|-------------|--------|
| `PROJECT_ENV` | Environment identifier | local, sandbox, kitchen, lab, studio, production |
| `PROJECT_KEY` | Project name for logging | e.g., my-api |
| `PROJECT_NONCE` | Unique resource suffix | e.g., dev, staging, prod |
| `PROJECT_CHAOS` | Chaos engineering mode | none, partial, full |

### Usage

```typescript
const env = process.env.PROJECT_ENV || "local";
const key = process.env.PROJECT_KEY || "unknown";

log.info("Starting", { env, project: key });
```

## Node Environment

| Variable | Description | Values |
|----------|-------------|--------|
| `NODE_ENV` | Node.js environment | development, production, test |
| `LOG_LEVEL` | Logging verbosity | trace, debug, info, warn, error |

### Log Level in Development

```bash
# Very verbose
LOG_LEVEL=trace npm run dev

# Normal debugging
LOG_LEVEL=debug npm run dev
```

## CDK Infrastructure Variables

| Variable | Description |
|----------|-------------|
| `CDK_ENV_BUCKET` | S3 bucket name |
| `CDK_ENV_QUEUE_URL` | SQS queue URL |
| `CDK_ENV_SNS_ROLE_ARN` | SNS role ARN |
| `CDK_ENV_SNS_TOPIC_ARN` | SNS topic ARN |
| `CDK_ENV_DATADOG_API_KEY_ARN` | Datadog API key ARN |
| `CDK_ENV_TABLE` | DynamoDB table name |

### Passing to Lambda

```typescript
const handler = new JaypieLambda(this, "Handler", {
  environment: {
    PROJECT_ENV: "production",
    PROJECT_KEY: "my-api",
    CDK_ENV_BUCKET: bucket.bucketName,
    CDK_ENV_QUEUE_URL: queue.queueUrl,
  },
});
```

## Secret Variables

| Variable | Description |
|----------|-------------|
| `SECRET_MONGODB_URI` | MongoDB connection secret name |
| `SECRET_API_KEY` | Third-party API key secret name |

### Usage Pattern

```typescript
// Secret name from env, value from Secrets Manager
const secretName = process.env.SECRET_MONGODB_URI;
const mongoUri = await getSecret(secretName);
```

## AWS Variables

| Variable | Description |
|----------|-------------|
| `AWS_PROFILE` | Default AWS profile |
| `AWS_REGION` | Default AWS region |
| `AWS_DEFAULT_REGION` | Fallback region |
| `AWS_SESSION_TOKEN` | Session token (Lambda runtime) |
| `AWS_ACCESS_KEY_ID` | Access key (if not using profile) |
| `AWS_SECRET_ACCESS_KEY` | Secret key (if not using profile) |

## Datadog Variables

| Variable | Description |
|----------|-------------|
| `DATADOG_API_KEY` or `DD_API_KEY` | API key |
| `DATADOG_APP_KEY` or `DD_APP_KEY` | Application key |
| `DD_ENV` | Environment tag |
| `DD_SERVICE` | Service name tag |
| `DD_VERSION` | Version tag |
| `DD_SOURCE` | Log source (default: lambda) |

### Unified Service Tagging

```typescript
environment: {
  DD_ENV: process.env.PROJECT_ENV,
  DD_SERVICE: process.env.PROJECT_KEY,
  DD_VERSION: process.env.npm_package_version,
}
```

## Local Development

### .env Files

```bash
# .env.local (not committed)
PROJECT_ENV=local
PROJECT_KEY=my-api
LOG_LEVEL=debug
MONGODB_URI=mongodb://localhost:27017/dev
```

### Loading .env

```typescript
import "dotenv/config";

// Or in package.json
"scripts": {
  "dev": "dotenv -- node src/index.js"
}
```

## Environment Detection

```typescript
const isProduction = process.env.PROJECT_ENV === "production";
const isLocal = process.env.PROJECT_ENV === "local";
const isDevelopment = !isProduction;
```

