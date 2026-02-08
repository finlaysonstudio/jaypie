# @jaypie/workspaces-cdk

CDK infrastructure for Jaypie stacks.

## Purpose

This package contains AWS CDK stacks for deploying Jaypie-related infrastructure. It uses constructs from `@jaypie/constructs` to maintain consistent infrastructure patterns.

## Directory Structure

```
workspaces/cdk/
├── bin/
│   └── app.ts           # CDK app entry point
├── lib/
│   ├── index.ts         # Package exports
│   ├── documentation-stack.ts  # Documentation site stack
│   ├── garden-api-stack.ts     # Garden API (streaming Lambda)
│   └── garden-nextjs-stack.ts  # Garden Next.js site
├── cdk.json             # CDK configuration
├── package.json
└── tsconfig.json
```

## Stacks

### DocumentationStack

Deploys the Jaypie documentation site. The hostname is **environment-aware**:
- **production**: `jaypie.net` (apex domain)
- **sandbox**: `sandbox.jaypie.net`
- **development**: `development.jaypie.net`

This is handled automatically by `envHostname()` from `@jaypie/constructs`, which reads `PROJECT_ENV` to determine the appropriate hostname prefix.

**Resources Created:**
- S3 bucket for static website hosting
- CloudFront distribution with SSL
- Route53 DNS records
- IAM role for GitHub Actions deployment (if CDK_ENV_REPO is set)

**Critical Environment Variables:**
- `PROJECT_ENV` - **Required**. Determines the deployment hostname (production, sandbox, development)
- `CDK_ENV_HOSTED_ZONE` - Route53 hosted zone (default: "jaypie.net")
- `PROJECT_KEY` - Project identifier
- `PROJECT_SPONSOR` - Organization name
- `PROJECT_NONCE` - Unique resource identifier
- `CDK_DEFAULT_ACCOUNT` - AWS account ID
- `CDK_DEFAULT_REGION` - AWS region
- `CDK_ENV_REPO` - GitHub repository for deploy role (e.g., "finlaysonstudio/jaypie")

### GardenApiStack

Deploys the Garden streaming API. Uses `JaypieExpressLambda` with `JaypieDistribution` (streaming: true).

**Hostname:**
- **production**: `garden-api.jaypie.net`
- **sandbox**: `garden-api.sandbox.jaypie.net`

**Resources Created:**
- Lambda function (Express app with streaming support)
- Lambda Function URL with RESPONSE_STREAM invoke mode
- CloudFront distribution with SSL
- Route53 DNS records

**Stack ID:** `JaypieGardenApi`

### GardenNextjsStack

Deploys the Garden Next.js site. Uses `JaypieNextJs` (cdk-nextjs-standalone).

**Hostname:**
- **production**: `garden.jaypie.net`
- **sandbox**: `garden.sandbox.jaypie.net`

**Resources Created:**
- S3 bucket for static assets
- Lambda function for server-side rendering
- CloudFront distribution with SSL
- Route53 DNS records

**Stack ID:** `JaypieGardenNextjs`

## Commands

```bash
npm run build      # Compile TypeScript
npm run synth      # Synthesize CloudFormation template
npm run diff       # Show diff between deployed and local
npm run deploy     # Deploy to AWS
npm run cdk        # Run CDK CLI directly
npm run typecheck  # Type check without building
```

## Deployment

```bash
# Set required environment variables
export PROJECT_ENV=production
export PROJECT_KEY=jaypie
export CDK_DEFAULT_ACCOUNT=123456789012
export CDK_DEFAULT_REGION=us-east-1

# Deploy
npm run deploy
```

## Adding New Stacks

1. Create a new stack file in `lib/` (e.g., `my-stack.ts`)
2. Export the stack from `lib/index.ts`
3. Instantiate the stack in `bin/app.ts`
4. Document the stack in this file

## CI/CD Deployment

Infrastructure is deployed via GitHub Actions workflows following Jaypie conventions.

### Composite Actions

Reusable actions in `.github/actions/`:

| Action | Description |
|--------|-------------|
| `configure-aws` | OIDC authentication with AWS |
| `setup-node-and-cache` | Node.js setup with dependency caching |
| `npm-install-build` | Install dependencies and build |
| `setup-environment` | Configure environment variables |
| `cdk-deploy` | Build and deploy CDK stack |

### Workflow Naming Conventions

| Pattern | Purpose | Example |
|---------|---------|---------|
| `deploy-env-$ENV.yml` | Deploy all stacks to an environment | `deploy-env-sandbox.yml` |
| `deploy-$ENV.yml` | Legacy alias for environment deploy | `deploy-sandbox.yml` |
| `deploy-stack-$STACK.yml` | Deploy specific stack content | `deploy-stack-documentation.yml` |

### Workflows

| Workflow | File | Purpose |
|----------|------|---------|
| Build Stacks to Sandbox | `deploy-env-sandbox.yml` | Deploy CDK infrastructure + documentation content to sandbox |
| Build Stacks to Development | `deploy-env-development.yml` | Deploy CDK infrastructure + documentation content to development |
| Build Stacks to Production | `deploy-env-production.yml` | Deploy CDK infrastructure + documentation content to production |
| Deploy Stacks (Manual) | `deploy-stacks.yml` | Manual workflow_dispatch to deploy specific stacks |
| Deploy Documentation Stack | `deploy-stack-documentation.yml` | Deploy documentation content only (manual or on doc changes) |

### Deployment Triggers

#### Environment Deployments (`deploy-env-*.yml`)

| Environment | Trigger | Lint/Test |
|-------------|---------|-----------|
| sandbox | `feat/*`, `sandbox/*` branches, `sandbox-*` tags | Parallel (non-blocking) |
| development | `main`, `development/*` branches, `development-*` tags | Required before deploy |
| production | `v*` tags, `production-*` tags | Required before deploy |

#### Manual Deployments (`deploy-stacks.yml`)

Use `workflow_dispatch` to manually deploy specific stacks to any environment:

1. Go to Actions → "Deploy Stacks (Manual)"
2. Click "Run workflow"
3. Select environment (sandbox, development, production)
4. Select stacks to deploy:
   - `all` - All stacks
   - Individual stack names
   - Common combinations (e.g., `JaypieGardenApi JaypieGardenNextjs`)
5. Or provide a custom stack list in the text field

#### Stack Content Deployments

**Documentation** is deployed automatically as part of `deploy-env-*.yml` workflows alongside CDK infrastructure. This ensures the documentation site content is always deployed when the bucket/CloudFront infrastructure is deployed.

The deployment process:
1. CDK deploys infrastructure (S3 bucket, CloudFront, deploy role)
2. Workflow fetches outputs from CloudFormation (`DestinationBucketName`, `DestinationBucketDeployRoleArn`, `DistributionId`)
3. Workflow assumes the deploy role and syncs content to S3
4. CloudFront cache is invalidated

No manual GitHub variable configuration is needed for documentation deployment - all values are retrieved dynamically from CloudFormation stack outputs.

The separate `deploy-stack-documentation.yml` workflow can be used for:
- Manual deployment via `workflow_dispatch` to any environment
- Deploying documentation-only changes (without CDK changes) on `feat/*` or `sandbox/*` branches

**Note:** Garden stacks don't need separate content workflows:
- `JaypieGardenNextjs` uses `cdk-nextjs-standalone` which deploys assets during CDK
- `JaypieGardenApi` is a Lambda with code bundled in CDK deploy

### Concurrency

All workflows use concurrency groups without `cancel-in-progress` to avoid stuck deployments:

- `deploy-env-sandbox`
- `deploy-env-development`
- `deploy-env-production`
- `deploy-stack-documentation-$ENV`

### GitHub Variable Scoping

Variables are configured at different levels in GitHub Settings:

#### Organization Level
| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | `us-east-1` |
| `LOG_LEVEL` | Application log level | `debug` |
| `MODULE_LOG_LEVEL` | Module log level | `warn` |
| `PROJECT_SPONSOR` | Organization name | `finlaysonstudio` |

#### Repository Level
| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_HOSTED_ZONE` | Route53 hosted zone | `jaypie.net` |
| `PROJECT_KEY` | Project identifier | `jaypie` |
| `PROJECT_SERVICE` | Service name | `workspaces` |

#### Environment Level

**CRITICAL**: `PROJECT_ENV` must be configured for each GitHub environment. This determines the deployment hostname (e.g., `sandbox` → `sandbox.jaypie.net`, `production` → `jaypie.net`).

| Variable | Description | Required | Example Values |
|----------|-------------|----------|----------------|
| `AWS_ROLE_ARN` | IAM role ARN for OIDC | Yes | `arn:aws:iam::123456789012:role/deploy-role` |
| `DATADOG_API_KEY_ARN` | Datadog API key ARN | No | |
| `PROJECT_ENV` | Environment identifier | **Yes** | `sandbox`, `development`, `production` |
| `PROJECT_NONCE` | Unique resource identifier | No | `abc123` |

### Environment Secrets

By default, no secrets are required. Dependencies add secrets as needed.

Secrets are passed to CDK via `JaypieEnvSecret` construct and made available at runtime.

#### Example: Auth0 Integration

When adding Auth0 authentication:

**Environment Variables:**
- `AUTH0_AUDIENCE` - API identifier
- `AUTH0_CLIENT_ID` - Application client ID
- `AUTH0_DOMAIN` - Auth0 tenant domain

**Environment Secrets:**
- `AUTH0_CLIENT_SECRET` - Application client secret

Add to workflow:
```yaml
- name: Deploy CDK Stack
  uses: ./.github/actions/cdk-deploy
  with:
    stack-name: AppStack
  env:
    AUTH0_CLIENT_SECRET: ${{ secrets.AUTH0_CLIENT_SECRET }}
```

### AWS Prerequisites

1. **CDK Bootstrap**: Each AWS account must be bootstrapped for CDK:
   ```bash
   cdk bootstrap aws://ACCOUNT_ID/REGION
   ```

2. **GitHub OIDC Provider**: Set up GitHub OIDC provider in each AWS account:
   - Use `JaypieGitHubDeployRole` construct or manually create OIDC provider
   - Export the provider ARN as `github-oidc-provider` in CloudFormation

3. **Hosted Zone**: Ensure `jaypie.net` hosted zone exists in Route53

## Troubleshooting

### Stack deploys to wrong hostname (e.g., production apex instead of sandbox subdomain)

**Cause**: `PROJECT_ENV` is not set or is set incorrectly in the GitHub environment.

**Solution**: Ensure each GitHub environment has `PROJECT_ENV` configured:
1. Go to GitHub Settings → Environments
2. Select the environment (sandbox, development, production)
3. Add/verify the `PROJECT_ENV` variable matches the environment name

### CDK can't find stack

**Cause**: Using the class name instead of the stack ID.

**Solution**: Use the stack ID from `bin/app.ts`. For example:
```typescript
new DocumentationStack(app, "JaypieDocumentation");  // Stack ID is "JaypieDocumentation"
```
Deploy with: `cdk deploy JaypieDocumentation`

## Notes

- This package is `private: true` and not published to npm
- Uses `@jaypie/constructs` for consistent infrastructure patterns
- All stacks extend JaypieAppStack for standard naming and tagging
- Stacks use `envHostname()` from `@jaypie/constructs` for environment-aware hostnames
