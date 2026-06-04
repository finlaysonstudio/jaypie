---
description: CDK constructs and deployment patterns
related: apikey, aws, cicd, dynamodb, express, lambda, migrations, secrets, streaming, waf, web, websockets
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

## Stacks

### JaypieStack

`JaypieStack` extends CDK's `Stack` and is the recommended base class for every stack in a Jaypie project. Extending it gives you three things automatically:

1. **Stack naming** from environment variables, in the form
   `cdk-{PROJECT_SPONSOR}-{PROJECT_KEY}-{PROJECT_ENV}-{PROJECT_NONCE}[-{key}]`,
   so naming stays consistent across sandbox, personal, and production deploys.
2. **Account & region** resolved from `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION` (overridable via `env`).
3. **Standard tags** applied to the stack and propagated to every taggable child resource: `env`, `project`, `sponsor`, `nonce`, `commit`, `buildHex`, `buildDate`, `buildTime`, `version`, `service`, `creation`, `role`, `stack`.

```typescript
import { Construct } from "constructs";
import { JaypieStack, JaypieStackProps } from "@jaypie/constructs";

export class DataStack extends JaypieStack {
  constructor(scope: Construct, id: string, props: JaypieStackProps = {}) {
    super(scope, id, { key: "data", ...props });
    // ...your resources...
  }
}
```

Props extend `StackProps` with one addition:

| Prop | Description |
|------|-------------|
| `key` | Suffix appended to the generated stack name (e.g., `"data"`, `"events"`). Optional. |

If you see `undefined` or `unknown` in a generated stack name or tag, an env var is missing — fix the environment rather than overriding `stackName`.

#### `JaypieAppStack` / `JaypieInfrastructureStack`

Thin convenience subclasses that pre-fill `key`:

- `JaypieAppStack` → `key: "app"` (application workloads — Lambdas, APIs)
- `JaypieInfrastructureStack` → `key: "infra"` (shared infrastructure — buckets, hosted zones, shared secrets); also tags the stack with `stackSha` from `CDK_ENV_INFRASTRUCTURE_STACK_SHA` when set

Use them when their key fits; extend `JaypieStack` directly for any other category.

## Environment Configuration

`JaypieStack` resolves the AWS account and region from `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION` automatically, so most stacks need no env wiring at the call site:

```typescript
new ApiStack(app, "ApiStack");
```

Override per-stack only when you need to deploy outside the default context:

```typescript
new ApiStack(app, "ApiStack", {
  env: { account: "123456789012", region: "us-west-2" },
});
```

See `skill("variables")` for the full set of `PROJECT_*` and `CDK_*` environment variables that drive naming and tagging.

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

`JaypieDistribution` and `JaypieWebDeploymentBucket` attach a WAFv2 WebACL by
default (CommonRuleSet, KnownBadInputsRuleSet, IP rate limiting, and WAF logging
to S3 with Datadog forwarding).

See **`skill("waf")`** for configuration: `rateLimitPerIp`, `webAclArn`,
`logBucket`, `managedRuleOverrides`, `managedRuleScopeDowns`, the `allow`
path-scoped relaxation prop, and the rule-name ↔ label casing trap.

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
- **`skill("waf")`** - WAF configuration, managed rule overrides, and the `allow` prop
- **`skill("web")`** - JaypieWebDeploymentBucket and JaypieStaticWebBucket for static sites
- **`skill("websockets")`** - JaypieWebSocket and JaypieWebSocketTable constructs
