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

#### Pre-built Code

When using `code` instead of `entry` for pre-built bundles:

```typescript
new JaypieLambda(this, "Api", {
  code: "../api/dist",     // Pre-built bundle directory
  handler: "index.handler", // Lambda finds index.mjs automatically
});
```

For ESM bundles, use `.mjs` extension or include `package.json` with `"type": "module"` in dist. See `skill("express")` for full esbuild config.

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

Organize stacks in the `workspaces/` directory:

```
workspaces/
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

## JaypieNextJs

Deploy Next.js applications:

```typescript
import { JaypieNextJs } from "@jaypie/constructs";

new JaypieNextJs(this, "App", {
  nextjsPath: "../nextjs",
  domainName: "app.example.com",
  hostedZone: "example.com",
  streaming: true,  // Optional: enables response streaming
});
```

**Streaming Note:** When `streaming: true`, also create `open-next.config.ts` in your Next.js app with `wrapper: "aws-lambda-streaming"`. See `skill("streaming")` for details.

## Security Headers

`JaypieDistribution` ships with default security response headers via a `ResponseHeadersPolicy` (analogous to `helmet` for Express):

- Cache-Control (no-store, no-cache, must-revalidate, proxy-revalidate)
- HSTS (2-year max-age, includeSubDomains, preload)
- X-Content-Type-Options (nosniff)
- X-Frame-Options (DENY)
- Referrer-Policy (strict-origin-when-cross-origin)
- Content-Security-Policy (conservative defaults)
- Permissions-Policy (camera, microphone, geolocation, payment disabled)
- Cross-Origin-Embedder-Policy (unsafe-none)
- Cross-Origin-Opener-Policy (same-origin)
- Cross-Origin-Resource-Policy (same-origin)
- Server header removed

```typescript
// Disable security headers
new JaypieDistribution(this, "Dist", { handler, securityHeaders: false });

// Override specific headers
new JaypieDistribution(this, "Dist", {
  handler,
  securityHeaders: {
    contentSecurityPolicy: "default-src 'self';",
    frameOption: HeadersFrameOption.SAMEORIGIN,
  },
});

// Full custom policy override
new JaypieDistribution(this, "Dist", {
  handler,
  responseHeadersPolicy: myCustomPolicy,
});
```

## See Also

- **`skill("streaming")`** - JaypieDistribution and JaypieNextJs streaming configuration
- **`skill("websockets")`** - JaypieWebSocket and JaypieWebSocketTable constructs
