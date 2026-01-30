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
│   │   ├── resolveCertificate.ts
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
| `JaypieQueuedLambda` | Lambda with SQS queue integration (FIFO by default) |
| `JaypieBucketQueuedLambda` | Lambda triggered by S3 bucket events via queue |

### Networking & Distribution

| Construct | Description |
|-----------|-------------|
| `JaypieCertificate` | Standalone ACM certificate with provider/consumer pattern |
| `JaypieDistribution` | CloudFront distribution with SSL, DNS, logging |
| `JaypieHostedZone` | Route53 hosted zone with query logging |
| `JaypieDnsRecord` | DNS record management |
| `JaypieApiGateway` | API Gateway configuration |
| `JaypieWebSocket` | WebSocket API Gateway v2 with custom domain |
| `JaypieWebSocketLambda` | Lambda optimized for WebSocket handlers |
| `JaypieWebSocketTable` | DynamoDB table for connection tracking |

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
| `JaypieDynamoDb` | DynamoDB table with Jaypie single-table design |
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

### Streaming Lambda

For streaming responses, use `createLambdaStreamHandler` from `@jaypie/express` with `JaypieDistribution`:

```typescript
import { JaypieExpressLambda, JaypieDistribution } from "@jaypie/constructs";

// Create Lambda (handler uses createLambdaStreamHandler internally)
const streamingApi = new JaypieExpressLambda(this, "StreamingApi", {
  code: "dist/api",
  handler: "index.handler",
});

// Use with CloudFront and streaming enabled
new JaypieDistribution(this, "Distribution", {
  handler: streamingApi,
  streaming: true,
  host: "api.example.com",
  zone: "example.com",
});
```

Note: Streaming requires Lambda Function URLs (not API Gateway). `JaypieDistribution` uses Function URLs by default.

### DynamoDB with Jaypie Single-Table Design

```typescript
import { JaypieDynamoDb, IndexDefinition } from "@jaypie/constructs";

// Basic table - table name is CDK-generated (includes stack name and unique suffix)
// e.g., cdk-sponsor-project-env-nonce-app-JaypieDynamoDbmyAppTable-XXXXX
const table = new JaypieDynamoDb(this, "myApp");

// With standard Jaypie GSIs (indexScope, indexAlias, indexClass, indexType, indexXid)
const tableWithIndexes = new JaypieDynamoDb(this, "myApp", {
  indexes: JaypieDynamoDb.DEFAULT_INDEXES,
});

// With explicit table name (overrides CDK-generated name)
const namedTable = new JaypieDynamoDb(this, "myApp", {
  tableName: "my-explicit-table-name",
});

// With custom indexes using IndexDefinition from @jaypie/fabric
const customTable = new JaypieDynamoDb(this, "myApp", {
  indexes: [
    { pk: ["scope", "model"], sk: ["sequence"] },           // indexScopeModel
    { pk: ["scope", "model", "type"], sparse: true },       // indexScopeModelType
    { name: "byAlias", pk: ["alias"], sk: ["createdAt"] },  // custom name
  ],
});
```

Note: `JaypieDynamoDb` uses `IndexDefinition` from `@jaypie/fabric` for GSI configuration, enabling consistent index definitions across CDK and runtime code. Table names default to CDK-generated names for proper namespacing across environments; use the `tableName` prop only when an explicit name is required.

### Next.js Deployment

```typescript
import { JaypieNextJs } from "@jaypie/constructs";

// With custom domain
new JaypieNextJs(this, "MyApp", {
  domainName: "app.example.com",
  hostedZone: "example.com",
  nextjsPath: "../nextjs",
});

// CloudFront URL only (no custom domain)
new JaypieNextJs(this, "MyApp", {
  domainProps: false,  // Forces CloudFront-only deployment
  nextjsPath: "../nextjs",
});
// Access via: https://d123456789.cloudfront.net

// With response streaming enabled
new JaypieNextJs(this, "MyApp", {
  domainName: "app.example.com",
  nextjsPath: "../nextjs",
  streaming: true,  // Enables Lambda response streaming for faster TTFB
});
```

When `domainProps: false`, no Route53/certificate configuration is created and `NEXT_PUBLIC_SITE_URL` is automatically set to the CloudFront distribution URL.

**Streaming Requirement:** When using `streaming: true`, you must also configure OpenNext in your Next.js app. Create `open-next.config.ts` at the same level as `next.config.js`:

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

Without this configuration, the Lambda Function URL returns a JSON envelope `{ statusCode, headers, body }` instead of streaming HTML, because Lambda's `RESPONSE_STREAM` invoke mode requires the handler to use `streamifyResponse` (which OpenNext's `aws-lambda-streaming` wrapper provides).

### Provider/Consumer Secrets Pattern

```typescript
// In sandbox stack (provider)
new JaypieEnvSecret(this, "SharedSecret", { provider: true, value: "secret-value" });

// In personal build (consumer) - automatically imports from sandbox
new JaypieEnvSecret(this, "SharedSecret"); // consumer: true auto-detected
```

### Shared Certificate (swap constructs without teardown)

```typescript
import { JaypieCertificate, JaypieDistribution, JaypieApiGateway } from "@jaypie/constructs";

// Create standalone certificate
const cert = new JaypieCertificate(this, "ApiCert", {
  domainName: "api.example.com",
  zone: "example.com",
});

// Use with any certificate-accepting construct
new JaypieDistribution(this, "Dist", { handler: api, certificate: cert });
// OR swap to ApiGateway without recreating certificate
new JaypieApiGateway(this, "Api", { handler: lambda, certificate: cert });

// Certificate also auto-shared when using certificate: true with same domain
// JaypieDistribution and JaypieApiGateway share stack-level certificates
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
| `resolveCertificate(scope, opts)` | Get or create stack-level certificate (enables sharing) |
| `resolveEnvironment(input)` | Parse environment array/object syntax |
| `resolveHostedZone(scope, { zone })` | Get or import hosted zone |
| `resolveSecrets(scope, input)` | Parse secrets array syntax |
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
6. **Flexible Constructor Signatures**: Some constructs support multiple calling patterns:
   - `(scope)` - uses environment defaults
   - `(scope, props)` - ID auto-generated from key property (e.g., domain name)
   - `(scope, id, props)` - explicit ID

### Flexible Constructor Pattern

Constructs like `JaypieCertificate` support flexible constructor signatures for convenience:

```typescript
// Minimal - uses environment variables
new JaypieCertificate(this);

// With options - ID auto-generated as "JaypieCert-{domain}"
new JaypieCertificate(this, {
  domainName: "api.example.com",
  zone: "example.com",
});

// Explicit ID - when you need specific construct ID
new JaypieCertificate(this, "MyApiCert", {
  domainName: "api.example.com",
  zone: "example.com",
});
```

The certificate is created at the stack level via `resolveCertificate()` and cached by domain. This means multiple constructs using the same domain share the same certificate, enabling seamless swapping between constructs like `JaypieDistribution` and `JaypieApiGateway` without recreating the certificate.
