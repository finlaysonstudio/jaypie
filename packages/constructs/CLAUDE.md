# CLAUDE.md - @jaypie/constructs

## Overview

AWS CDK constructs for Jaypie applications. Provides opinionated, production-ready constructs for Lambda, CloudFront, Route53, SQS, Secrets Manager, and more with built-in Datadog integration and consistent tagging.

## Package Structure

```
packages/constructs/
├── src/
│   ├── index.ts                 # Package exports
│   ├── constants.ts             # CDK constants (environments, tags, roles)
│   ├── helpers/                 # Utility functions
│   │   ├── index.ts
│   │   ├── addDatadogLayers.ts
│   │   ├── constructEnvName.ts
│   │   ├── constructStackName.ts
│   │   ├── constructTagger.ts
│   │   ├── envHostname.ts
│   │   ├── extendDatadogRole.ts
│   │   ├── isEnv.ts
│   │   ├── isValidHostname.ts
│   │   ├── isValidSubdomain.ts
│   │   ├── jaypieLambdaEnv.ts
│   │   ├── mergeDomain.ts
│   │   ├── resolveDatadogForwarderFunction.ts
│   │   ├── resolveDatadogLayers.ts
│   │   ├── resolveDatadogLoggingDestination.ts
│   │   ├── resolveEnvironment.ts
│   │   ├── resolveHostedZone.ts
│   │   ├── resolveParamsAndSecrets.ts
│   │   └── resolveSecrets.ts
│   ├── Jaypie*.ts               # Construct classes
│   ├── types/
│   │   └── globals.d.ts
│   └── __tests__/               # Unit tests
└── docs/                        # Documentation (empty)
```

## Key Constructs

### Stacks

| Construct | Description |
|-----------|-------------|
| `JaypieStack` | Base stack with automatic naming and tagging |
| `JaypieAppStack` | Application stack (default key: "app") |
| `JaypieInfrastructureStack` | Infrastructure stack (default key: "infra") |

### Lambda

| Construct | Description |
|-----------|-------------|
| `JaypieLambda` | Full-featured Lambda with Datadog, secrets, VPC support |
| `JaypieExpressLambda` | Lambda optimized for Express APIs (30s timeout, API role) |
| `JaypieStreamingLambda` | Lambda with AWS Lambda Web Adapter for streaming responses |
| `JaypieQueuedLambda` | Lambda with SQS queue integration (FIFO by default) |
| `JaypieBucketQueuedLambda` | Lambda triggered by S3 bucket events via queue |

### Networking & Distribution

| Construct | Description |
|-----------|-------------|
| `JaypieDistribution` | CloudFront distribution with SSL, DNS, logging |
| `JaypieHostedZone` | Route53 hosted zone with query logging |
| `JaypieDnsRecord` | DNS record management |
| `JaypieApiGateway` | API Gateway configuration |

### Secrets

| Construct | Description |
|-----------|-------------|
| `JaypieEnvSecret` | Environment-aware secrets (provider/consumer pattern) |
| `JaypieDatadogSecret` | Datadog API key secret |
| `JaypieMongoDbSecret` | MongoDB connection secret |
| `JaypieOpenAiSecret` | OpenAI API key secret |
| `JaypieTraceSigningKeySecret` | Trace signing key secret |

### Storage & Monitoring

| Construct | Description |
|-----------|-------------|
| `JaypieAccountLoggingBucket` | Centralized logging bucket |
| `JaypieDatadogBucket` | S3 bucket with Datadog forwarding |
| `JaypieDatadogForwarder` | Datadog log forwarder Lambda |
| `JaypieStaticWebBucket` | Static website hosting bucket |
| `JaypieWebDeploymentBucket` | Web deployment artifacts bucket |

### Other

| Construct | Description |
|-----------|-------------|
| `JaypieEventsRule` | EventBridge rule |
| `JaypieGitHubDeployRole` | GitHub Actions OIDC deploy role |
| `JaypieNextJs` | Next.js deployment (uses cdk-nextjs-standalone) |
| `JaypieOrganizationTrail` | CloudTrail for AWS Organizations |
| `JaypieSsoPermissions` | AWS SSO permission sets |
| `JaypieSsoSyncApplication` | SSO sync application |

## Constants (CDK Object)

The `CDK` constant provides standardized values:

- `CDK.ACCOUNT.*` - Account types (development, production, sandbox, etc.)
- `CDK.BUILD.*` - Build types (personal, ephemeral, static)
- `CDK.DATADOG.*` - Datadog configuration (site, layer versions)
- `CDK.DURATION.*` - Lambda timeouts (EXPRESS_API: 30s, LAMBDA_WORKER: 900s)
- `CDK.ENV.*` - Environments (production, development, sandbox, personal, etc.)
- `CDK.IMPORT.*` - Cross-stack import names
- `CDK.LAMBDA.*` - Lambda defaults (LOG_RETENTION: 90, MEMORY_SIZE: 1024)
- `CDK.ROLE.*` - Resource role tags (api, deploy, storage, processing, etc.)
- `CDK.SERVICE.*` - Service tags
- `CDK.TAG.*` - Tag key names
- `CDK.VENDOR.*` - Third-party vendor tags

The `LAMBDA_WEB_ADAPTER` constant provides AWS Lambda Web Adapter configuration:

- `LAMBDA_WEB_ADAPTER.ACCOUNT` - AWS account hosting the layer (753240598075)
- `LAMBDA_WEB_ADAPTER.VERSION` - Layer version (25)
- `LAMBDA_WEB_ADAPTER.LAYER.ARM64` - ARM64 layer name
- `LAMBDA_WEB_ADAPTER.LAYER.X86` - x86_64 layer name
- `LAMBDA_WEB_ADAPTER.DEFAULT_PORT` - Default port (8000)
- `LAMBDA_WEB_ADAPTER.INVOKE_MODE.*` - Invoke modes (BUFFERED, RESPONSE_STREAM)

## Environment Variables

Required by various constructs:

| Variable | Description |
|----------|-------------|
| `PROJECT_ENV` | Environment (production, sandbox, personal, etc.) |
| `PROJECT_KEY` | Project identifier |
| `PROJECT_SPONSOR` | Organization/sponsor name |
| `PROJECT_NONCE` | Unique deployment identifier |
| `PROJECT_COMMIT` | Git commit hash |
| `PROJECT_VERSION` | Package version |
| `PROJECT_SERVICE` | Service name |
| `CDK_DEFAULT_ACCOUNT` | AWS account ID |
| `CDK_DEFAULT_REGION` | AWS region |
| `CDK_ENV_HOSTED_ZONE` | Default hosted zone domain |
| `CDK_ENV_API_SUBDOMAIN` | API subdomain |
| `CDK_ENV_API_HOSTED_ZONE` | API hosted zone (overrides default) |
| `CDK_ENV_PERSONAL` | Flag for personal/ephemeral builds |

## Usage Patterns

### Lambda with Secrets

```typescript
import { JaypieLambda, JaypieEnvSecret } from "@jaypie/constructs";

new JaypieLambda(this, "MyLambda", {
  code: "dist/lambda",
  handler: "index.handler",
  secrets: ["MONGODB_URI", "API_KEY"], // Auto-creates JaypieEnvSecret
  environment: ["NODE_ENV", { DEBUG: "true" }], // Mixed array syntax
});
```

### CloudFront Distribution

```typescript
import { JaypieDistribution, JaypieExpressLambda } from "@jaypie/constructs";

const api = new JaypieExpressLambda(this, "Api", { code: "dist/api", handler: "index.handler" });
new JaypieDistribution(this, "Distribution", {
  handler: api,
  host: "api.example.com",
  zone: "example.com",
});
```

### Streaming Lambda with Web Adapter

```typescript
import { JaypieStreamingLambda, JaypieDistribution } from "@jaypie/constructs";

// Create streaming Lambda with AWS Lambda Web Adapter
const streamingLambda = new JaypieStreamingLambda(this, "StreamingApi", {
  code: "dist/api",
  handler: "run.sh",
  streaming: true,  // Enables RESPONSE_STREAM invoke mode
  port: 8000,       // Port your app listens on (default: 8000)
});

// Use with CloudFront (auto-detects invokeMode)
new JaypieDistribution(this, "Distribution", {
  handler: streamingLambda,
  host: "api.example.com",
  zone: "example.com",
});
```

### Provider/Consumer Secrets Pattern

```typescript
// In sandbox stack (provider)
new JaypieEnvSecret(this, "SharedSecret", { provider: true, value: "secret-value" });

// In personal build (consumer) - automatically imports from sandbox
new JaypieEnvSecret(this, "SharedSecret"); // consumer: true auto-detected
```

## Helper Functions

| Function | Description |
|----------|-------------|
| `constructStackName(key?)` | Generate stack name from env vars |
| `constructTagger(construct)` | Apply standard tags to construct |
| `constructEnvName(name)` | Generate environment-prefixed name |
| `envHostname()` | Get hostname from environment |
| `isEnv(env)` / `isProductionEnv()` / `isSandboxEnv()` | Environment checks |
| `isValidHostname(str)` / `isValidSubdomain(str)` | Validation helpers |
| `mergeDomain(subdomain, zone)` | Combine subdomain and zone |
| `resolveEnvironment(input)` | Parse environment array/object syntax |
| `resolveSecrets(scope, input)` | Parse secrets array syntax |
| `resolveHostedZone(scope, { zone })` | Get or import hosted zone |
| `addDatadogLayers(fn, opts)` | Add Datadog Lambda layers |
| `extendDatadogRole(scope, opts)` | Extend Datadog IAM role |
| `jaypieLambdaEnv(opts)` | Get standard Lambda environment |

## Dependencies

- `aws-cdk-lib` - AWS CDK core
- `constructs` - CDK constructs library
- `datadog-cdk-constructs-v2` - Datadog CDK integration
- `cdk-nextjs-standalone` - Next.js deployment
- `@jaypie/errors` - Error handling

## Commands

```bash
npm run build      # Build with Rollup
npm run test       # Run tests (vitest run)
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint
npm run format     # Auto-fix lint issues
```

## Key Patterns

1. **Automatic Tagging**: All constructs apply consistent tags (env, project, sponsor, role, etc.)
2. **Datadog Integration**: Lambda functions automatically get Datadog layers and forwarding
3. **Environment-Aware**: Constructs adapt behavior based on `PROJECT_ENV` (e.g., provider/consumer secrets)
4. **Interface Implementation**: Constructs implement CDK interfaces (IFunction, IQueue, IDistribution) for composability
5. **Node.js 24**: Default runtime is `nodejs24.x`
