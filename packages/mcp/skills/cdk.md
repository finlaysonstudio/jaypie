---
description: CDK constructs and deployment patterns
related: apikey, aws, cicd, dynamodb, express, lambda, migrations, secrets, streaming, websockets
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

**CRITICAL**: When referencing `code: "../package/dist"`, the package must be built **before** CDK synth/deploy. In CI/CD, `npm run build` at the root handles this — but new packages must have a `build` script in their `package.json`. If the package is a build-time dependency of others, add it to `build:core-deps` in the root `package.json`. Without this, CI/CD fails with `"../package/dist" doesn't exist`.

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

## Resource Naming

CDK logical IDs (the construct `id` parameter) are stack-scoped and unique per stack. However, **physical resource names** set via props like `repositoryName`, `logGroupName`, `clusterName`, `family`, and `ruleName` are account-global. Always include `PROJECT_ENV` and `PROJECT_NONCE` to avoid collisions when multiple stacks deploy to the same account.

```typescript
// Bad — collides across stacks
repositoryName: `${prefix}-operations`

// Good — scoped per stack
repositoryName: `${prefix}-operations-${PROJECT_ENV}-${PROJECT_NONCE}`
```

Props that need scoping include:
- ECR: `repositoryName`
- CloudWatch: `logGroupName`
- ECS: `clusterName`, `family`
- EventBridge: `ruleName`
- SQS: `queueName`
- Any other prop that sets an account-global physical name

See `skill("variables")` for the role of `PROJECT_ENV` and `PROJECT_NONCE`.

## Deployment

```bash
# Deploy to sandbox
PROJECT_ENV=sandbox PROJECT_NONCE=dev cdk deploy

# Deploy to production
PROJECT_ENV=production PROJECT_NONCE=prod cdk deploy
```

## Lambda with DynamoDB Tables

Pass tables to `JaypieLambda` for automatic permissions and environment wiring:

```typescript
import { JaypieDynamoDb, JaypieLambda } from "@jaypie/constructs";

const table = new JaypieDynamoDb(this, "myApp");

const handler = new JaypieLambda(this, "ApiHandler", {
  entry: "src/handler.ts",
  handler: "handler",
  tables: [table],
});
```

**Behavior:**

| Tables Count | Permissions | Environment |
|-------------|-------------|-------------|
| 1 table | `grantReadWriteData()` | `DYNAMODB_TABLE_NAME` set automatically |
| 2+ tables | `grantReadWriteData()` for each | No auto env var — set `CDK_ENV_TABLE` manually |

Single table example — at runtime, use `process.env.DYNAMODB_TABLE_NAME`:

```typescript
const table = new JaypieDynamoDb(this, "myApp");
new JaypieLambda(this, "Handler", {
  tables: [table],
  // DYNAMODB_TABLE_NAME is set automatically
});
```

Multi-table example — set environment variables explicitly:

```typescript
const usersTable = new JaypieDynamoDb(this, "users");
const ordersTable = new JaypieDynamoDb(this, "orders");

new JaypieLambda(this, "Handler", {
  tables: [usersTable, ordersTable],
  environment: {
    USERS_TABLE: usersTable.tableName,
    ORDERS_TABLE: ordersTable.tableName,
  },
});
```

See `skill("dynamodb")` for table key conventions and query patterns.

## Lambda with Secrets

Pass secrets as strings (auto-creates `JaypieEnvSecret`) or as construct instances:

```typescript
// String shorthand — creates JaypieEnvSecret from env vars at deploy time
new JaypieLambda(this, "Handler", {
  secrets: ["MONGODB_URI", "ANTHROPIC_API_KEY"],
});

// Construct instances — for generated secrets or custom config
const salt = new JaypieEnvSecret(this, "ProjectSalt", {
  envKey: "PROJECT_SALT",
  generateSecretString: { excludePunctuation: true, passwordLength: 64 },
});

new JaypieLambda(this, "Handler", {
  secrets: [salt, "ANTHROPIC_API_KEY"],
});
```

See `skill("secrets")` for the full secrets pattern including generated secrets and personal environment gotchas.

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

## WAF (Web Application Firewall)

`JaypieDistribution` attaches a WAFv2 WebACL by default with:

- **AWSManagedRulesCommonRuleSet** — OWASP top 10 (SQLi, XSS, etc.)
- **AWSManagedRulesKnownBadInputsRuleSet** — known bad patterns (Log4j, etc.)
- **Rate limiting** — 2000 requests per 5 minutes per IP
- **WAF logging** — S3 bucket with Datadog forwarder notifications

```typescript
// Default: WAF enabled with logging
new JaypieDistribution(this, "Dist", { handler });

// Disable WAF entirely
new JaypieDistribution(this, "Dist", { handler, waf: false });

// Customize rate limit
new JaypieDistribution(this, "Dist", {
  handler,
  waf: { rateLimitPerIp: 500 },
});

// Use existing WebACL
new JaypieDistribution(this, "Dist", {
  handler,
  waf: { webAclArn: "arn:aws:wafv2:..." },
});

// Disable WAF logging only
new JaypieDistribution(this, "Dist", {
  handler,
  waf: { logBucket: false },
});

// Bring your own WAF logging bucket
new JaypieDistribution(this, "Dist", {
  handler,
  waf: { logBucket: myWafBucket },
});

// Override specific managed rule actions (e.g., allow large request bodies)
new JaypieDistribution(this, "Dist", {
  handler,
  waf: {
    managedRuleOverrides: {
      AWSManagedRulesCommonRuleSet: [
        { name: "SizeRestrictions_BODY", actionToUse: { count: {} } },
      ],
    },
  },
});
```

Cost: $5/month per WebACL + $1/month per rule + $0.60 per million requests. Use `waf: false` to opt out.

## Organization Trail Security Baseline

`JaypieOrganizationTrail` provides organization-wide security monitoring:

- **CloudTrail** with file validation enabled by default
- **Lambda data events** recorded by default
- **IAM Access Analyzer** (ORGANIZATION type) enabled by default
- **S3 data events** opt-in (cost consideration)

```typescript
const orgTrail = new JaypieOrganizationTrail(this, "OrgTrail");
// File validation, Lambda data events, and Access Analyzer all on by default

// Opt out of specific features
new JaypieOrganizationTrail(this, "OrgTrail", {
  enableAccessAnalyzer: false,
  enableLambdaDataEvents: false,
});

// Opt in to S3 data events
new JaypieOrganizationTrail(this, "OrgTrail", {
  enableS3DataEvents: true,
});
```

## See Also

- **`skill("apikey")`** - API key generation, validation, and hashing
- **`skill("dynamodb")`** - DynamoDB key design and query patterns
- **`skill("express")`** - Express handler and Lambda adapter
- **`skill("lambda")`** - Lambda handler wrappers and lifecycle
- **`skill("secrets")`** - Secret management with JaypieEnvSecret
- **`skill("streaming")`** - JaypieDistribution and JaypieNextJs streaming configuration
- **`skill("variables")`** - Environment variables reference
- **`skill("websockets")`** - JaypieWebSocket and JaypieWebSocketTable constructs
