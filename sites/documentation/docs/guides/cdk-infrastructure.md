---
sidebar_position: 2
---

# CDK Infrastructure


**Prerequisites:**
- `npm install @jaypie/constructs aws-cdk-lib constructs`
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- AWS credentials configured

## Overview

Jaypie provides CDK constructs that automatically configure Datadog integration, environment variables, and IAM permissions.
All Jaypie CDK applications extend `JaypieStack` classes for consistent configuration.

## Project Structure

```
packages/cdk/
├── bin/
│   └── cdk.ts           # CDK app entry point
├── lib/
│   ├── cdk-app.ts       # Application stack
│   └── cdk-infra.ts     # Infrastructure stack
├── cdk.json
├── package.json
└── tsconfig.json
```

## Stack Types

| Stack | Extends | Purpose |
|-------|---------|---------|
| `JaypieAppStack` | `JaypieStack` | Application resources (Lambda, API Gateway) |
| `JaypieInfrastructureStack` | `JaypieStack` | Shared infrastructure (VPC, databases) |

## Step 1: CDK Entry Point

**packages/cdk/bin/cdk.ts:**

```typescript
#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { AppStack } from "../lib/cdk-app.js";
import { InfraStack } from "../lib/cdk-infra.js";

const app = new cdk.App();

new InfraStack(app, "MyProject-Infra");
new AppStack(app, "MyProject-App");
```

## Step 2: Application Stack

**packages/cdk/lib/cdk-app.ts:**

```typescript
import { JaypieAppStack, JaypieLambda, JaypieApiGateway } from "@jaypie/constructs";
import type { Construct } from "constructs";

export class AppStack extends JaypieAppStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const api = new JaypieLambda(this, "Api", {
      code: "../../api/dist",
      handler: "handler.handler",
      secrets: ["MONGODB_URI"],
    });

    new JaypieApiGateway(this, "Gateway", {
      handler: api,
      host: "api.example.com",
      zone: "example.com",
    });
  }
}
```

## Step 3: Infrastructure Stack

**packages/cdk/lib/cdk-infra.ts:**

```typescript
import { JaypieInfrastructureStack, JaypieEnvSecret } from "@jaypie/constructs";
import type { Construct } from "constructs";

export class InfraStack extends JaypieInfrastructureStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new JaypieEnvSecret(this, "MongoSecret", {
      secretName: "prod/mongodb-uri",
      envName: "MONGODB_URI",
    });
  }
}
```

## Core Constructs

### JaypieLambda

Standard Lambda function with Datadog layers and environment injection.

```typescript
new JaypieLambda(this, "Worker", {
  code: "../worker/dist",
  handler: "index.handler",
  secrets: ["API_KEY"],
  timeout: cdk.Duration.seconds(30),
  memorySize: 256,
  environment: {
    CUSTOM_VAR: "value",
  },
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `code` | string | - | Path to Lambda code directory |
| `handler` | string | - | Handler function (file.function) |
| `secrets` | JaypieEnvSecret[] | - | Secrets to inject |
| `timeout` | Duration | 30s | Function timeout |
| `memorySize` | number | 128 | Memory in MB |
| `environment` | object | - | Additional env vars |

### JaypieQueuedLambda

Lambda triggered by SQS queue.

```typescript
new JaypieQueuedLambda(this, "QueueWorker", {
  code: "../worker/dist",
  handler: "index.handler",
  queueName: "tasks",
});
// Sets CDK_ENV_QUEUE_URL automatically
```

### JaypieBucketQueuedLambda

Lambda triggered by S3 events via SQS.

```typescript
new JaypieBucketQueuedLambda(this, "FileProcessor", {
  code: "../processor/dist",
  handler: "index.handler",
  bucketName: "uploads",
  events: ["s3:ObjectCreated:*"],
});
// Sets CDK_ENV_BUCKET automatically
```

### JaypieExpressLambda

Express application on Lambda.

```typescript
new JaypieExpressLambda(this, "Api", {
  code: "../api/dist",
  handler: "handler.handler",
});
```

### JaypieApiGateway

REST API Gateway with custom domain.

```typescript
new JaypieApiGateway(this, "Gateway", {
  handler: lambdaFunction,
  host: "api.example.com",
  zone: "example.com",
});
```

### JaypieWebDeploymentBucket

Static site hosting with CloudFront.

```typescript
new JaypieWebDeploymentBucket(this, "Web", {
  source: "../web/dist",
  host: "app.example.com",
  zone: "example.com",
});
```

### JaypieDynamoDb

DynamoDB table with Jaypie single-table design patterns.

```typescript
// Basic table (no GSIs by default)
new JaypieDynamoDb(this, "myApp");

// With standard Jaypie GSIs
new JaypieDynamoDb(this, "myApp", {
  indexes: JaypieDynamoDb.DEFAULT_INDEXES,
});

// With custom indexes using IndexDefinition from @jaypie/fabric
new JaypieDynamoDb(this, "myApp", {
  indexes: [
    { pk: ["scope", "model"], sk: ["sequence"] },
    { pk: ["scope", "model", "type"], sparse: true },
  ],
});
```

### JaypieEnvSecret

Secret reference for Lambda injection.

```typescript
const secret = new JaypieEnvSecret(this, "ApiKey", {
  secretName: "prod/api-key",
  envName: "API_KEY",
});

new JaypieLambda(this, "Function", {
  secrets: [secret],
});
// Lambda has SECRET_API_KEY pointing to Secrets Manager
```

## CDK Configuration

**packages/cdk/cdk.json:**

```json
{
  "app": "npx tsx bin/cdk.ts",
  "context": {
    "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
    "@aws-cdk/core:stackRelativeExports": true
  }
}
```

**packages/cdk/package.json:**

```json
{
  "name": "@project/cdk",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "scripts": {
    "build": "tsc",
    "cdk": "cdk",
    "synth": "cdk synth",
    "deploy": "cdk deploy"
  }
}
```

## Deployment

```bash
# Synthesize CloudFormation
npm run synth -w packages/cdk

# Deploy to AWS
npm run deploy -w packages/cdk

# Deploy specific stack
cdk deploy MyProject-App -w packages/cdk
```

## Environment-Specific Stacks

```typescript
const env = process.env.PROJECT_ENV || "sandbox";

new AppStack(app, `MyProject-${env}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
```

## Stack Naming Convention

Stack names must match GitHub Actions workflow configuration:

```yaml
# .github/workflows/deploy.yml
- name: Deploy
  run: cdk deploy MyProject-App
```

```typescript
// Must match exactly
new AppStack(app, "MyProject-App");
```

## Related

- [Express on Lambda](/docs/guides/express-lambda) - Building Express apps for Lambda
- [Environment Variables](/docs/core/environment) - CDK environment patterns
- [CI/CD](/docs/guides/cicd) - Automated deployments
- [@jaypie/constructs](/docs/packages/constructs) - Full construct reference
