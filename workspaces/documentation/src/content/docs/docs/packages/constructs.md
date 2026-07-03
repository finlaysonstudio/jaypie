---
title: "@jaypie/constructs"
---


**Prerequisites:** `npm install @jaypie/constructs aws-cdk-lib constructs`

## Overview

`@jaypie/constructs` provides AWS CDK constructs preconfigured with Jaypie conventions, Datadog integration, and environment variable patterns.

## Installation

```bash
npm install @jaypie/constructs aws-cdk-lib constructs
```

## Quick Reference

### Constructs

| Construct | Purpose |
|-----------|---------|
| `JaypieLambda` | Lambda function with Datadog |
| `JaypieQueuedLambda` | SQS-triggered Lambda |
| `JaypieBucketQueuedLambda` | S3-triggered Lambda via SQS |
| `JaypieExpressLambda` | Express app on Lambda |
| `JaypieApiGateway` | REST API with custom domain |
| `JaypieWebDeploymentBucket` | Static site with CloudFront |
| `JaypieDynamoDb` | DynamoDB with GSI patterns |
| `JaypieNextJs` | Next.js deployment via cdk-nextjs-standalone |
| `JaypieEnvSecret` | Secret reference for injection |

### Stack Classes

| Class | Purpose |
|-------|---------|
| `JaypieStack` | Base stack with tags and naming |
| `JaypieAppStack` | Application resources |
| `JaypieInfrastructureStack` | Shared infrastructure |

## JaypieLambda

Standard Lambda with Datadog integration.

```typescript
import { JaypieLambda } from "@jaypie/constructs";

new JaypieLambda(this, "Api", {
  code: "../api/dist",
  handler: "handler.handler",
  secrets: [mongoSecret],
  timeout: cdk.Duration.seconds(30),
  memorySize: 256,
  environment: {
    CUSTOM_VAR: "value",
  },
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `code` | `string` | - | Path to code directory |
| `handler` | `string` | - | Handler function (file.export) |
| `secrets` | `JaypieEnvSecret[]` | - | Secrets to inject |
| `timeout` | `Duration` | 30s | Function timeout |
| `memorySize` | `number` | 128 | Memory in MB |
| `environment` | `object` | - | Additional env vars |
| `vpc` | `IVpc` | - | VPC for function |

## JaypieQueuedLambda

Lambda triggered by SQS queue.

```typescript
import { JaypieQueuedLambda } from "@jaypie/constructs";

new JaypieQueuedLambda(this, "Worker", {
  code: "../worker/dist",
  handler: "index.handler",
  queueName: "tasks",
  batchSize: 10,
  maxBatchingWindow: cdk.Duration.seconds(5),
});
// Sets CDK_ENV_QUEUE_URL automatically
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `queueName` | `string` | - | SQS queue name |
| `batchSize` | `number` | 10 | Max messages per batch |
| `maxBatchingWindow` | `Duration` | 0 | Batch window duration |

## JaypieBucketQueuedLambda

Lambda triggered by S3 events via SQS.

```typescript
import { JaypieBucketQueuedLambda } from "@jaypie/constructs";

new JaypieBucketQueuedLambda(this, "FileProcessor", {
  code: "../processor/dist",
  handler: "index.handler",
  bucketName: "uploads",
  events: ["s3:ObjectCreated:*"],
  prefix: "incoming/",
});
// Sets CDK_ENV_BUCKET automatically
```

## JaypieExpressLambda

Express.js application on Lambda.

```typescript
import { JaypieExpressLambda } from "@jaypie/constructs";

new JaypieExpressLambda(this, "Api", {
  code: "../api/dist",
  handler: "handler.handler",
  secrets: [mongoSecret, apiKeySecret],
});
```

## JaypieApiGateway

REST API Gateway with custom domain.

```typescript
import { JaypieApiGateway } from "@jaypie/constructs";

new JaypieApiGateway(this, "Gateway", {
  handler: lambdaFunction,
  host: "api.example.com",
  zone: "example.com",
});
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `handler` | `IFunction` | Lambda function |
| `host` | `string` | Custom domain hostname |
| `zone` | `string` | Route53 hosted zone |

## JaypieWebDeploymentBucket

Static site on S3 fronted by CloudFront, ACM, and Route53. Ships with default security headers, WAFv2, and CloudFront access logging — same override mechanisms as `JaypieDistribution` (`securityHeaders`, `responseHeadersPolicy`, `waf`, `logBucket`, `destination`). When `CDK_ENV_REPO` is set, also provisions a scoped GitHub OIDC deploy role with `cloudfront:CreateInvalidation` on the distribution.

```typescript
import { JaypieWebDeploymentBucket } from "@jaypie/constructs";

new JaypieWebDeploymentBucket(this, "Web", {
  host: "app.example.com",
  zone: "example.com",
});

// host accepts a HostConfig object resolved via envHostname()
new JaypieWebDeploymentBucket(this, "Web", {
  host: { subdomain: "app", domain: "example.com" },
  zone: "example.com",
});
```

### Stable Outputs for cdk-outputs.json

Call `exportOutputs()` to emit stack-level `CfnOutput`s with hash-free logical IDs (`DestinationBucketName`, `DestinationBucketDeployRoleArn`, `DistributionId`, `CertificateArn`):

```typescript
const web = new JaypieWebDeploymentBucket(this, "Web", { host, zone });
web.exportOutputs();

// Multi-instance stacks: use prefix to avoid collisions
appWeb.exportOutputs({ prefix: "App" });   // AppDestinationBucketName, ...
docsWeb.exportOutputs({ prefix: "Docs" }); // DocsDestinationBucketName, ...
```

Outputs whose underlying resource doesn't exist (e.g., no deploy role, no distribution) are skipped.

## JaypieDynamoDb

DynamoDB table with Jaypie single-table design patterns.

```typescript
import { JaypieDynamoDb } from "@jaypie/constructs";
import { fabricIndex } from "@jaypie/fabric";

// Basic table (no GSIs by default)
new JaypieDynamoDb(this, "myApp");

// With indexes using fabricIndex()
new JaypieDynamoDb(this, "myApp", {
  indexes: [
    fabricIndex(),           // indexModel: pk=["model"], sk=["scope","updatedAt"]
    fabricIndex("alias"),    // indexModelAlias: pk=["model","alias"], sparse
    fabricIndex("xid"),      // indexModelXid: pk=["model","xid"], sparse
  ],
});
```

Creates table with:
- Primary key: `id` (PK) — no sort key
- No GSIs by default — use `indexes` prop with `fabricIndex()` to add them

## JaypieNextJs

Next.js deployment using `cdk-nextjs-standalone`.

```typescript
import { JaypieNextJs } from "@jaypie/constructs";

// With custom domain
new JaypieNextJs(this, "App", {
  domainName: "app.example.com",
  hostedZone: "example.com",
  nextjsPath: "../nextjs",
});

// CloudFront URL only (no custom domain)
new JaypieNextJs(this, "App", {
  domainProps: false,
  nextjsPath: "../nextjs",
});

// With response streaming
new JaypieNextJs(this, "App", {
  nextjsPath: "../nextjs",
  streaming: true,
});
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `nextjsPath` | `string` | Path to Next.js application |
| `domainName` | `string` | Custom domain name |
| `hostedZone` | `string` | Route53 hosted zone |
| `domainProps` | `false` | Set to false for CloudFront-only deployment |
| `streaming` | `boolean` | Enable Lambda response streaming |
| `secrets` | `JaypieEnvSecret[]` | Secrets to inject |
| `tables` | `ITable[]` | DynamoDB tables to grant access |

### Streaming Requirement

When using `streaming: true`, you must also create `open-next.config.ts` in your Next.js app:

```typescript
// nextjs/open-next.config.ts
import type { OpenNextConfig } from "@opennextjs/aws/types/open-next.js";

const config = {
  default: {
    override: {
      wrapper: "aws-lambda-streaming",
    },
  },
} satisfies OpenNextConfig;

export default config;
```

Without this, the Lambda returns a JSON envelope instead of streamed HTML because Lambda's `RESPONSE_STREAM` invoke mode requires the OpenNext streaming wrapper.

## JaypieEnvSecret

Secret reference for Lambda injection. Supports `removalPolicy` as `boolean` (`true` = RETAIN, `false` = DESTROY) or CDK `RemovalPolicy`.

```typescript
import { JaypieEnvSecret, JaypieLambda } from "@jaypie/constructs";
import { isProductionEnv } from "@jaypie/kit";

const mongoSecret = new JaypieEnvSecret(this, "MongoSecret", {
  secretName: "prod/mongodb-uri",
  envName: "MONGODB_URI",
  removalPolicy: isProductionEnv(),
});

new JaypieLambda(this, "Api", {
  secrets: [mongoSecret],
});
// Lambda has SECRET_MONGODB_URI env var
```

## Stack Classes

### JaypieStack

Base stack for every Jaypie CDK stack. Extending it automatically:

1. **Names the stack** from environment variables: `cdk-{PROJECT_SPONSOR}-{PROJECT_KEY}-{PROJECT_ENV}-{PROJECT_NONCE}[-{key}]`
2. **Resolves account & region** from `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION` (overridable via `env`)
3. **Applies standard tags** (`env`, `project`, `sponsor`, `nonce`, `commit`, `buildHex`, `buildDate`, `buildTime`, `version`, `service`, `creation`, `role`, `stack`) and propagates them to every taggable child resource

```typescript
import { JaypieStack, JaypieStackProps } from "@jaypie/constructs";
import type { Construct } from "constructs";

export class DataStack extends JaypieStack {
  constructor(scope: Construct, id: string, props: JaypieStackProps = {}) {
    super(scope, id, { key: "data", ...props });
    // ...your resources...
  }
}
```

`JaypieStackProps` extends CDK's `StackProps` with one optional `key` field (suffix for the generated stack name). Most projects use `JaypieAppStack` or `JaypieInfrastructureStack`; extend `JaypieStack` directly only for additional categories.

### JaypieAppStack

For application resources (Lambda, API Gateway). Pre-fills `key: "app"`:

```typescript
import { JaypieAppStack, JaypieLambda } from "@jaypie/constructs";
import type { Construct } from "constructs";

export class ApiStack extends JaypieAppStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new JaypieLambda(this, "Api", {
      code: "../api/dist",
      handler: "handler.handler",
    });
  }
}
```

### JaypieInfrastructureStack

For shared infrastructure. Pre-fills `key: "infra"` and tags the stack with `stackSha` from `CDK_ENV_INFRASTRUCTURE_STACK_SHA` when set:

```typescript
import { JaypieInfrastructureStack, JaypieEnvSecret } from "@jaypie/constructs";
import type { Construct } from "constructs";

export class InfraStack extends JaypieInfrastructureStack {
  public readonly mongoSecret: JaypieEnvSecret;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.mongoSecret = new JaypieEnvSecret(this, "MongoSecret", {
      secretName: "prod/mongodb-uri",
      envName: "MONGODB_URI",
    });
  }
}
```

## Environment Variables

Constructs automatically set:

| Variable | Source |
|----------|--------|
| `PROJECT_ENV` | Stack environment |
| `PROJECT_KEY` | Stack name |
| `CDK_ENV_QUEUE_URL` | Queue constructs |
| `CDK_ENV_BUCKET` | Bucket constructs |
| `CDK_ENV_DATADOG_API_KEY_ARN` | Datadog integration |
| `SECRET_*` | Secret constructs |

## Tags

All resources are tagged:

| Tag | Value |
|-----|-------|
| `project` | Project name |
| `environment` | Environment name |
| `stack` | Stack ID |

## CDK Entry Point

```typescript
// bin/cdk.ts
#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ApiStack } from "../lib/api-stack.js";
import { InfraStack } from "../lib/infra-stack.js";

const app = new cdk.App();

new InfraStack(app, "MyProject-Infra");
new ApiStack(app, "MyProject-Api");
```

## Related

- [CDK Infrastructure](/docs/guides/cdk-infrastructure/) - Setup guide
- [CI/CD](/docs/guides/cicd/) - Deployment workflows
- [Environment Variables](/docs/core/environment/) - Environment patterns
