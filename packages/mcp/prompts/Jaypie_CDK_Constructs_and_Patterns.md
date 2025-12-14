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
- Automatic Datadog integration when `DATADOG_API_KEY_ARN` or `CDK_ENV_DATADOG_API_KEY_ARN` exists
- Default environment variables from `PROJECT_*` settings
- Provisioned concurrency support via `provisionedConcurrentExecutions`
- Secrets management via `secrets` array (JaypieEnvSecret[])
- Direct secret integration via `envSecrets` object
- Parameter Store/Secrets Manager layer via `paramsAndSecrets`
- VPC, security groups, filesystem, and all standard Lambda configuration options

### Queue-Lambda Patterns

Use `JaypieQueuedLambda` for SQS-triggered Lambdas:
```typescript
new JaypieQueuedLambda(this, "Worker", {
  code: "dist",
  fifo: true,
  batchSize: 10,
  visibilityTimeout: Duration.seconds(900)
});
```

Features:
- Auto-creates SQS queue and connects to Lambda
- Implements both `lambda.IFunction` and `sqs.IQueue` interfaces
- Auto-injects `CDK_ENV_QUEUE_URL` environment variable
- Grants consume and send permissions to Lambda

Use `JaypieBucketQueuedLambda` for S3-triggered processing:
```typescript
new JaypieBucketQueuedLambda(this, "Processor", {
  code: "dist",
  bucketName: "my-bucket",
  bucketOptions: { versioned: true } // Optional S3 configuration
});
```

Features:
- Extends `JaypieQueuedLambda` with S3 bucket and event notifications
- Forces non-FIFO queue (S3 limitation)
- Auto-injects `CDK_ENV_BUCKET_NAME` environment variable
- Grants read/write permissions to Lambda
- Implements `s3.IBucket` interface

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
  provider: true,  // Exports for other stacks (default: PROJECT_ENV=sandbox)
  consumer: false, // Imports from provider stack (default: PROJECT_ENV=personal)
  value: "secret-value", // Direct value (alternative to envKey)
  generateSecretString: {}, // Auto-generate secret
});
```

Provider/consumer pattern:
- Provider stacks (sandbox) create and export secrets
- Consumer stacks (personal/ephemeral) import secrets by name
- Export name format: `env-${PROJECT_ENV}-${PROJECT_KEY}-${id}`

### Web Hosting

Use `JaypieWebDeploymentBucket` for static sites:
```typescript
new JaypieWebDeploymentBucket(this, "WebSite", {
  host: "www.example.com",
  zone: "example.com",
  certificate: true // Creates new cert; can pass ICertificate or false
});
```

Features:
- Creates S3 bucket with website hosting enabled
- Creates CloudFront distribution with SSL certificate
- Creates Route53 DNS records
- Auto-creates GitHub deployment role when `CDK_ENV_REPO` is set
- Production environments get optimized caching (index.html excluded)
- Implements `s3.IBucket` interface
- Can use `CDK_ENV_WEB_HOST` or `CDK_ENV_WEB_SUBDOMAIN` + hosted zone

### Hosted Zones

Use `JaypieHostedZone` for DNS with query logging:
```typescript
new JaypieHostedZone(this, "Zone", {
  zoneName: "example.com"
});
```

## Environment Variables

Configure constructs via environment:

### API Configuration
- `CDK_ENV_API_HOST_NAME`: Full API domain name
- `CDK_ENV_API_SUBDOMAIN`: API subdomain (combined with CDK_ENV_API_HOSTED_ZONE)
- `CDK_ENV_API_HOSTED_ZONE`: API hosted zone

### Web Configuration
- `CDK_ENV_WEB_HOST`: Full web domain name
- `CDK_ENV_WEB_SUBDOMAIN`: Web subdomain (combined with CDK_ENV_WEB_HOSTED_ZONE)
- `CDK_ENV_WEB_HOSTED_ZONE`: Web hosted zone

### General DNS
- `CDK_ENV_HOSTED_ZONE`: Fallback hosted zone (used by API and Web if specific zones not set)

### Deployment
- `CDK_ENV_REPO`: GitHub repository for deployment roles (format: owner/repo)

### Datadog Integration
- `DATADOG_API_KEY_ARN`: Datadog API key secret ARN (primary)
- `CDK_ENV_DATADOG_API_KEY_ARN`: Datadog API key secret ARN (fallback)
- `CDK_ENV_DATADOG_ROLE_ARN`: Datadog IAM role ARN for extended permissions

### Project Configuration
- `PROJECT_ENV`: Environment name (sandbox, production, personal, etc.)
- `PROJECT_KEY`: Project identifier
- `PROJECT_SERVICE`: Service name
- `PROJECT_SPONSOR`: Cost allocation tag
- `PROJECT_NONCE`: Unique identifier for ephemeral builds

### Infrastructure Tracking
- `CDK_ENV_INFRASTRUCTURE_STACK_SHA`: Git SHA for infrastructure stack tagging

### Auto-Injected (Set by Constructs)
- `CDK_ENV_BUCKET_NAME`: S3 bucket name (set by JaypieBucketQueuedLambda)
- `CDK_ENV_QUEUE_URL`: SQS queue URL (set by JaypieQueuedLambda)

## Helper Functions

Use helper utilities:
```typescript
import { constructStackName, constructEnvName, isEnv } from "@jaypie/constructs";

const stackName = constructStackName("app");  // project-env-app
const resourceName = constructEnvName("bucket");  // project-env-bucket
const isProduction = isEnv("production");
```

## Additional Helper Functions

Available from `@jaypie/constructs`:

```typescript
import {
  isProductionEnv,
  isSandboxEnv,
  jaypieLambdaEnv,
  constructTagger,
  resolveHostedZone,
  resolveDatadogLayers,
  resolveDatadogForwarderFunction,
  resolveDatadogLoggingDestination,
  resolveParamsAndSecrets,
  extendDatadogRole,
  envHostname,
  isValidHostname,
  isValidSubdomain,
  mergeDomain,
} from "@jaypie/constructs";
```

Common usage:
- `isProductionEnv()`: Returns true if PROJECT_ENV is production
- `isSandboxEnv()`: Returns true if PROJECT_ENV is sandbox
- `jaypieLambdaEnv({ initialEnvironment })`: Merges PROJECT_* vars into Lambda env
- `resolveHostedZone(scope, { zone })`: Gets IHostedZone from string or object
- `extendDatadogRole(lambda)`: Adds Datadog IAM permissions when CDK_ENV_DATADOG_ROLE_ARN set

## Additional Constructs

Other constructs available but not commonly used:

### Base and Infrastructure
- `JaypieStack`: Base stack with standard tagging and configuration

### Specialized Secrets
- `JaypieDatadogSecret`: Datadog API key secret management
- `JaypieMongoDbSecret`: MongoDB connection string secret
- `JaypieOpenAiSecret`: OpenAI API key secret
- `JaypieTraceSigningKeySecret`: Trace signing key secret

### DNS and Networking
- `JaypieDnsRecord`: Create individual DNS records in hosted zones

### Deployment and CI/CD
- `JaypieGitHubDeployRole`: GitHub Actions OIDC deployment role

### Event-Driven
- `JaypieEventsRule`: EventBridge rules with standard configuration

### Advanced Features
- `JaypieNextJs`: Next.js application deployment (uses cdk-nextjs-standalone)
- `JaypieDatadogForwarder`: Datadog log forwarder Lambda setup
- `JaypieOrganizationTrail`: CloudTrail organization-wide trail
- `JaypieSsoPermissions`: AWS IAM Identity Center permission sets
- `JaypieSsoSyncApplication`: SSO sync application for Google Workspace
- `JaypieAccountLoggingBucket`: Account-level centralized logging bucket
- `JaypieDatadogBucket`: Datadog-specific S3 bucket
- `JaypieStaticWebBucket`: Static web bucket (simpler than JaypieWebDeploymentBucket)
- `JaypieDistribution`: CloudFront distribution construct

## Tagging Strategy

Constructs apply standard tags:
- `role`: Resource role (api, processing, networking, hosting, deploy, monitoring, security, storage, stack)
- `vendor`: External service provider (auth0, datadog, mongodb, openai, knowtrace)
- `service`: Service category (datadog, infrastructure, libraries, sso, trace)
- `sponsor`: Cost allocation
- `project`: Project identifier (from PROJECT_KEY)
- `env`: Environment name (from PROJECT_ENV)
- `stackSha`: Git SHA for infrastructure stacks (from CDK_ENV_INFRASTRUCTURE_STACK_SHA)