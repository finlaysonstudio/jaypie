---
description: CDK constructs and deployment patterns
related: aws, cicd, dynamodb, streaming, websockets
---

# CDK Constructs

Jaypie provides CDK constructs through `@jaypie/constructs` for deploying AWS infrastructure with best practices built-in.

## Installation

```bash
npm install @jaypie/constructs
```

## Core Constructs

### JaypieLambda

Lambda function with Datadog tracing, logging, and error handling:

```typescript
import { JaypieLambda } from "@jaypie/constructs";

const handler = new JaypieLambda(this, "ApiHandler", {
  entry: "src/handler.ts",
  handler: "handler",
  environment: {
    PROJECT_ENV: "production",
    PROJECT_KEY: "my-api",
  },
  timeout: Duration.seconds(30),
  memorySize: 512,
});
```

### JaypieQueue

SQS queue with DLQ and Lambda trigger:

```typescript
import { JaypieQueue } from "@jaypie/constructs";

const queue = new JaypieQueue(this, "ProcessQueue", {
  visibilityTimeout: Duration.seconds(60),
  retentionPeriod: Duration.days(7),
});

// Connect to Lambda
queue.addEventSource(handler);
```

### JaypieBucket

S3 bucket with encryption and lifecycle rules:

```typescript
import { JaypieBucket } from "@jaypie/constructs";

const bucket = new JaypieBucket(this, "AssetsBucket", {
  encryption: BucketEncryption.S3_MANAGED,
  lifecycleRules: [
    { expiration: Duration.days(90), prefix: "temp/" }
  ],
});
```

## Stack Structure

Organize stacks in the `stacks/` directory:

```
stacks/
├── cdk/
│   ├── src/
│   │   ├── app.ts        # CDK app entry
│   │   └── stacks/
│   │       ├── api.ts    # API stack
│   │       └── data.ts   # Data stack
│   ├── cdk.json
│   └── package.json
```

## Environment Configuration

Use environment-specific configuration:

```typescript
const env = process.env.PROJECT_ENV || "sandbox";
const nonce = process.env.PROJECT_NONCE || "dev";

const stack = new ApiStack(app, `api-${env}-${nonce}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
```

## Deployment

```bash
# Deploy to sandbox
PROJECT_ENV=sandbox PROJECT_NONCE=dev cdk deploy

# Deploy to production
PROJECT_ENV=production PROJECT_NONCE=prod cdk deploy
```

## Environment Variables

Pass configuration to Lambda via environment variables:

```typescript
const handler = new JaypieLambda(this, "Handler", {
  environment: {
    CDK_ENV_BUCKET: bucket.bucketName,
    CDK_ENV_QUEUE_URL: queue.queueUrl,
    SECRET_MONGODB_URI: "mongodb-connection-string",
  },
});

// Grant permissions
bucket.grantReadWrite(handler);
queue.grantSendMessages(handler);
```

## Datadog Integration

Enable Datadog tracing:

```typescript
const handler = new JaypieLambda(this, "Handler", {
  datadogApiKeyArn: "arn:aws:secretsmanager:...",
  environment: {
    DD_ENV: "production",
    DD_SERVICE: "my-api",
  },
});
```

## See Also

- **`skill("streaming")`** - JaypieDistribution with `streaming: true` for response streaming
- **`skill("websockets")`** - JaypieWebSocket and JaypieWebSocketTable constructs
