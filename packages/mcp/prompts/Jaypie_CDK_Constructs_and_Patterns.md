---
description: Working with Jaypie CDK patterns and constructs
globs: packages/cdk/**
---

# Jaypie CDK Constructs and Patterns

Reusable AWS CDK constructs with standardized defaults and Jaypie conventions.

## Goal

Implement AWS infrastructure using Jaypie CDK constructs with consistent patterns, defaults, and tagging.

## Guidelines

CDK constructs enforce standard Jaypie conventions.
Environment variables prefixed with `CDK_ENV_` configure constructs.
All constructs apply standard tags and follow removal policies.
Constructs implement AWS CDK interfaces for compatibility.

## Process

### Lambda Functions

Use `JaypieLambda` for standard Lambda configurations:
```typescript
new JaypieLambda(this, "MyFunction", {
  code: "dist",
  handler: "index.handler",
  timeout: Duration.seconds(30),
  environment: { KEY: "value" }
});
```

Features:
- Automatic Datadog integration when `DATADOG_API_KEY_ARN` exists
- Default environment variables from `PROJECT_*` settings
- Provisioned concurrency support
- Secrets management via `JaypieEnvSecret`

### Queue-Lambda Patterns

Use `JaypieQueuedLambda` for SQS-triggered Lambdas:
```typescript
new JaypieQueuedLambda(this, "Worker", {
  code: "dist",
  fifo: true,
  batchSize: 10
});
```

Use `JaypieBucketQueuedLambda` for S3-triggered processing:
```typescript
new JaypieBucketQueuedLambda(this, "Processor", {
  code: "dist",
  bucketName: "my-bucket"
});
```

### API Gateway

Use `JaypieApiGateway` for REST APIs with custom domains:
```typescript
new JaypieApiGateway(this, "Api", {
  handler: lambdaFunction,
  host: "api.example.com",
  zone: "example.com"
});
```

Configures SSL certificates and Route53 records automatically.

### Express Lambda

Use `JaypieExpressLambda` for Express.js applications:
```typescript
new JaypieExpressLambda(this, "ExpressApp", {
  code: "dist",
  handler: "app.handler"
});
```

Preconfigured with API-optimized timeouts and role tags.

### Stack Types

Use specialized stacks for different purposes:
```typescript
new JaypieAppStack(scope, "AppStack");  // Application resources
new JaypieInfrastructureStack(scope, "InfraStack");  // Infrastructure resources
```

### Secrets Management

Use `JaypieEnvSecret` for cross-stack secret sharing:
```typescript
// Shorthand: if API_KEY exists in process.env, uses it as envKey
// Creates construct with id "EnvSecret_API_KEY"
new JaypieEnvSecret(this, "API_KEY");

// Explicit configuration
new JaypieEnvSecret(this, "ApiKey", {
  envKey: "API_KEY",
  provider: true,  // Exports for other stacks
  consumer: false  // Imports from provider stack
});
```

### Web Hosting

Use `JaypieWebDeploymentBucket` for static sites:
```typescript
new JaypieWebDeploymentBucket(this, "WebSite", {
  host: "www.example.com",
  zone: "example.com"
});
```

Creates S3 bucket, CloudFront distribution, and DNS records.

### Hosted Zones

Use `JaypieHostedZone` for DNS with query logging:
```typescript
new JaypieHostedZone(this, "Zone", {
  zoneName: "example.com"
});
```

## Environment Variables

Configure constructs via environment:
- `CDK_ENV_API_HOST_NAME`: API domain name
- `CDK_ENV_API_HOSTED_ZONE`: API hosted zone
- `CDK_ENV_WEB_SUBDOMAIN`: Web subdomain
- `CDK_ENV_WEB_HOSTED_ZONE`: Web hosted zone
- `CDK_ENV_REPO`: GitHub repository for deployment roles
- `DATADOG_API_KEY_ARN`: Datadog API key secret ARN
- `PROJECT_ENV`: Environment name (sandbox, production)
- `PROJECT_KEY`: Project identifier
- `PROJECT_SERVICE`: Service name
- `PROJECT_SPONSOR`: Cost allocation tag

## Helper Functions

Use helper utilities:
```typescript
import { constructStackName, constructEnvName, isEnv } from "@jaypie/constructs/helpers";

const stackName = constructStackName("app");  // project-env-app
const resourceName = constructEnvName("bucket");  // project-env-bucket
const isProduction = isEnv("production");
```

## Tagging Strategy

Constructs apply standard tags:
- `role`: Resource role (api, processing, networking, hosting)
- `vendor`: External service provider
- `service`: Service category
- `sponsor`: Cost allocation