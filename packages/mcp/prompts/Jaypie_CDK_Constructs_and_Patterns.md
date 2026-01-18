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

### Streaming Lambda Functions

For streaming responses (SSE, real-time updates), use `createLambdaStreamHandler` from `@jaypie/express` with `JaypieDistribution`:

```typescript
import { JaypieExpressLambda, JaypieDistribution } from "@jaypie/constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";

// Create Lambda (handler uses createLambdaStreamHandler internally)
const streamingApi = new JaypieExpressLambda(this, "StreamingApi", {
  code: "dist/api",
  handler: "index.handler",
});

// Use with CloudFront and RESPONSE_STREAM invoke mode
new JaypieDistribution(this, "Distribution", {
  handler: streamingApi,
  invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
  host: "api.example.com",
  zone: "example.com",
});
```

For direct Function URL access (bypass CloudFront):
```typescript
import { FunctionUrlAuthType, InvokeMode } from "aws-cdk-lib/aws-lambda";

const streamingLambda = new JaypieLambda(this, "StreamingFunction", {
  code: "dist",
  handler: "stream.handler",
  timeout: Duration.minutes(5),
});

const functionUrl = streamingLambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  invokeMode: InvokeMode.RESPONSE_STREAM,
});

new cdk.CfnOutput(this, "StreamingUrl", { value: functionUrl.url });
```

Note: Streaming requires Lambda Function URLs (not API Gateway). `JaypieDistribution` uses Function URLs by default.

### Stack Types

Always extend Jaypie stack classes instead of raw CDK classes:

| Use | Instead of |
|-----|------------|
| `JaypieAppStack` | `cdk.Stack` |
| `JaypieInfrastructureStack` | `cdk.Stack` |

Jaypie stacks automatically configure:
- `env` with `CDK_DEFAULT_ACCOUNT` and `CDK_DEFAULT_REGION` (required for context providers)
- Standard tagging
- Removal policies based on environment

```typescript
new JaypieAppStack(scope, "AppStack");  // Application resources
new JaypieInfrastructureStack(scope, "InfraStack");  // Infrastructure resources
```

#### Error: Using cdk.Stack with Context Providers

Using `cdk.Stack` directly with constructs that need context providers causes:

```
ValidationError: Cannot retrieve value from context provider hosted-zone since
account/region are not specified at the stack level.
```

**Solution:** Change the base class:

```typescript
// Wrong
import * as cdk from "aws-cdk-lib";
export class AppStack extends cdk.Stack { ... }

// Correct
import { JaypieAppStack } from "@jaypie/constructs";
export class AppStack extends JaypieAppStack { ... }
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

### DynamoDB Tables

Use `JaypieDynamoDb` for single-table design with Jaypie patterns:
```typescript
// Shorthand: tableName becomes "myApp", construct id is "JaypieDynamoDb-myApp"
const table = new JaypieDynamoDb(this, "myApp");

// With standard Jaypie GSIs (indexScope, indexAlias, indexClass, indexType, indexXid)
const tableWithIndexes = new JaypieDynamoDb(this, "myApp", {
  indexes: JaypieDynamoDb.DEFAULT_INDEXES,
});

// With custom indexes using IndexDefinition from @jaypie/fabric
const customTable = new JaypieDynamoDb(this, "myApp", {
  indexes: [
    { pk: ["scope", "model"], sk: ["sequence"] },           // indexScopeModel
    { pk: ["scope", "model", "type"], sparse: true },       // indexScopeModelType
    { name: "byAlias", pk: ["alias"], sk: ["createdAt"] },  // custom name
  ],
});

// Connect table to Lambda
new JaypieLambda(this, "Worker", {
  code: "dist",
  tables: [table], // Grants read/write, sets DYNAMODB_TABLE_NAME
});
```

Features:
- Default partition key: `model` (string), sort key: `id` (string)
- PAY_PER_REQUEST billing mode by default
- RETAIN removal policy in production, DESTROY otherwise
- No GSIs by default - use `indexes` prop to add them
- `JaypieDynamoDb.DEFAULT_INDEXES` provides standard Jaypie GSIs from `@jaypie/fabric`
- Uses `IndexDefinition` from `@jaypie/fabric` for GSI configuration
- Implements `ITableV2` interface

For single-table design patterns, key builders, and query utilities, see `Jaypie_DynamoDB_Package.md`.

### Next.js Applications

Use `JaypieNextJs` for Next.js deployments with CloudFront and custom domains:
```typescript
const nextjs = new JaypieNextJs(this, "Web", {
  domainName: "app.example.com",
  hostedZone: "example.com",
  nextjsPath: "../nextjs", // Path to Next.js project
  environment: ["NODE_ENV", { CUSTOM_VAR: "value" }],
  secrets: ["AUTH0_CLIENT_SECRET", "AUTH0_SECRET"],
  tables: [dynamoTable],
});
```

Features:
- Uses `cdk-nextjs-standalone` under the hood
- CloudFront distribution with SSL certificate
- Custom domain via Route53
- Automatic Datadog integration
- Parameter Store/Secrets Manager layer
- Server-side function with secrets and tables access
- NEXT_PUBLIC_* environment variables automatically included
- `domainName` accepts string or config object: `{ component, domain, env, subdomain }`

Properties exposed:
- `bucket`: S3 bucket for static assets
- `distribution`: CloudFront distribution
- `domain`: Route53 domain configuration
- `serverFunction`: Next.js server Lambda function
- `imageOptimizationFunction`: Image optimization Lambda
- `url`: CloudFront distribution URL

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