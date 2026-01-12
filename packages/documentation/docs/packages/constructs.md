---
sidebar_position: 4
---

# @jaypie/constructs


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

Static site hosting with CloudFront.

```typescript
import { JaypieWebDeploymentBucket } from "@jaypie/constructs";

new JaypieWebDeploymentBucket(this, "Web", {
  source: "../web/dist",
  host: "app.example.com",
  zone: "example.com",
});
```

## JaypieDynamoDb

DynamoDB table with Jaypie GSI patterns.

```typescript
import { JaypieDynamoDb } from "@jaypie/constructs";

new JaypieDynamoDb(this, "Table", {
  tableName: "entities",
});
```

Creates table with:
- Primary key: `model` (PK), `id` (SK)
- 5 GSIs for query patterns (ou, alias, class, type, xid)

## JaypieEnvSecret

Secret reference for Lambda injection.

```typescript
import { JaypieEnvSecret, JaypieLambda } from "@jaypie/constructs";

const mongoSecret = new JaypieEnvSecret(this, "MongoSecret", {
  secretName: "prod/mongodb-uri",
  envName: "MONGODB_URI",
});

new JaypieLambda(this, "Api", {
  secrets: [mongoSecret],
});
// Lambda has SECRET_MONGODB_URI env var
```

## Stack Classes

### JaypieAppStack

For application resources (Lambda, API Gateway):

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

For shared infrastructure:

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

- [CDK Infrastructure](/docs/guides/cdk-infrastructure) - Setup guide
- [CI/CD](/docs/guides/cicd) - Deployment workflows
- [Environment Variables](/docs/core/environment) - Environment patterns
