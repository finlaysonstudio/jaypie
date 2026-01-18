---
sidebar_position: 5
---

# CI/CD with GitHub Actions

**Prerequisites:**
- GitHub repository
- AWS account with OIDC configured
- Jaypie CDK package (for deployments)

## Overview

Jaypie projects use GitHub Actions for CI/CD with environment-specific deployments. The standard workflow includes:
- Check (lint, type, test) on feature branches
- Deploy on main branch and release tags
- Personal sandbox builds for developer testing

## Workspace Naming Conventions

| Directory | Purpose |
|-----------|---------|
| `packages/` | Default workspace for npm packages (preferred when only one namespace needed) |
| `stacks/` | CDK-deployed infrastructure and sites (as opposed to npm-published) |
| `workspaces/` | Generic workspace for other work |

## Environments

Jaypie assumes multiple deployed environments:

| Environment | Purpose |
|-------------|---------|
| production | Live environment, standalone |
| development | Validates multi-environment deployment works |
| sandbox | Shared testing environment |
| personal | Developer-specific builds tied to GitHub actor |

## Workflow Naming Conventions

### Workflow File Naming

| Pattern | Purpose | Example |
|---------|---------|---------|
| `deploy-env-$ENV.yml` | Deploy all stacks to an environment | `deploy-env-sandbox.yml` |
| `deploy-$ENV.yml` | Legacy alias for environment deploy | `deploy-sandbox.yml` |
| `deploy-stack-$STACK.yml` | Deploy specific stack content | `deploy-stack-documentation.yml` |

### Tag Naming

| Pattern | Purpose | Example |
|---------|---------|---------|
| `v*` | Production version release | `v1.2.3` |
| `$ENV-*` | Deploy to specific environment | `sandbox-hotfix` |
| `stack-$STACK-*` | Deploy specific stack | `stack-documentation-v1.0.0` |

Always prefer full words for maximum clarity.

## Triggers

| Environment | Trigger |
|-------------|---------|
| production | tags: `v*`, `production-*` |
| development | branches: `[main, development/*]`, tags: `development-*` |
| sandbox | branches: `[feat/*, sandbox/*]`, tags: `sandbox-*` |
| personal | branches-ignore: `[main, develop, nobuild-*, nobuild/*, sandbox, sandbox-*, sandbox/*]` |

### Stack Triggers

| Stack | Trigger |
|-------|---------|
| documentation | Push to `main` with path filter, tags: `stack-documentation-*` |

### Dependencies

| Environment | Lint/Test Dependency |
|-------------|----------------------|
| production | Required to pass before deploy |
| development | Required to pass before deploy |
| sandbox | Runs in parallel with deploy |
| personal | Runs in parallel with deploy |

## Check Workflow

**.github/workflows/npm-check.yml:**

```yaml
name: Check

on:
  push:
    branches:
      - 'feat/*'
      - 'fix/*'
      - 'devin/*'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['22', '24', '25']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm test
```

## Deploy Workflow

### Environment Deployment

**.github/workflows/deploy-env-sandbox.yml:**

```yaml
name: Deploy to Sandbox

on:
  push:
    branches:
      - 'feat/*'
      - 'sandbox/*'
    tags:
      - 'sandbox-*'

concurrency:
  group: deploy-env-sandbox

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: us-east-1
  CDK_PATH: packages/cdk

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-and-cache
      - uses: ./.github/actions/npm-install-build
      - run: npm run lint
      - run: npm run test

  deploy:
    runs-on: ubuntu-latest
    environment: sandbox
    steps:
      - uses: actions/checkout@v4

      - uses: ./.github/actions/setup-environment
        with:
          aws-region: ${{ vars.AWS_REGION }}
          aws-role-arn: ${{ vars.AWS_ROLE_ARN }}
          project-env: ${{ vars.PROJECT_ENV }}

      - uses: ./.github/actions/configure-aws
        with:
          aws-role-arn: ${{ vars.AWS_ROLE_ARN }}
          aws-region: ${{ vars.AWS_REGION }}

      - uses: ./.github/actions/setup-node-and-cache
      - uses: ./.github/actions/npm-install-build

      - uses: ./.github/actions/cdk-deploy
        with:
          stack-name: AppStack
```

### Production Deployment

**.github/workflows/deploy-env-production.yml:**

```yaml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*'
      - 'production-*'

concurrency:
  group: deploy-env-production

permissions:
  id-token: write
  contents: read

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-and-cache
      - uses: ./.github/actions/npm-install-build
      - run: npm run lint
      - run: npm run test

  deploy:
    runs-on: ubuntu-latest
    needs: lint-and-test
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: ./.github/actions/setup-environment
        with:
          aws-role-arn: ${{ vars.AWS_ROLE_ARN }}
          project-env: ${{ vars.PROJECT_ENV }}

      - uses: ./.github/actions/configure-aws
        with:
          aws-role-arn: ${{ vars.AWS_ROLE_ARN }}

      - uses: ./.github/actions/setup-node-and-cache
      - uses: ./.github/actions/npm-install-build

      - uses: ./.github/actions/cdk-deploy
        with:
          stack-name: AppStack
```

## Concurrency

Use concurrency groups without `cancel-in-progress` to avoid stuck deployments. Environments run in parallel between each other but concurrently within an environment.

### Environment Builds

```yaml
concurrency:
  group: deploy-env-production
```

### Stack Builds

```yaml
concurrency:
  group: deploy-stack-documentation-${{ github.event.inputs.environment || 'development' }}
```

### Personal Builds

```yaml
concurrency:
  group: deploy-personal-build-${{ github.actor }}
```

## Composite Actions

### Available Actions

| Action | Description |
|--------|-------------|
| `configure-aws` | OIDC authentication with AWS |
| `setup-node-and-cache` | Node.js setup with dependency caching |
| `npm-install-build` | Install dependencies and build |
| `setup-environment` | Configure environment variables |
| `cdk-deploy` | Build and deploy CDK stack |

### configure-aws

**.github/actions/configure-aws/action.yml:**

```yaml
name: Configure AWS Credentials
description: Configure AWS credentials using OIDC

inputs:
  aws-role-arn:
    description: AWS IAM role ARN
    required: true
  aws-region:
    description: AWS region
    required: false
    default: us-east-1

runs:
  using: composite
  steps:
    - name: Configure AWS Credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: ${{ inputs.aws-role-arn }}
        role-session-name: DeployRoleForGitHubSession
        aws-region: ${{ inputs.aws-region }}
```

### setup-environment

**.github/actions/setup-environment/action.yml:**

Configures environment variables with sensible defaults following variable scoping conventions.

**Variable Scoping (GitHub Settings):**
- **Organization**: AWS_REGION, LOG_LEVEL, MODULE_LOG_LEVEL, PROJECT_SPONSOR
- **Repository**: AWS_HOSTED_ZONE, PROJECT_KEY, PROJECT_SERVICE
- **Environment**: AWS_ROLE_ARN, DATADOG_API_KEY_ARN, PROJECT_ENV, PROJECT_NONCE

### cdk-deploy

**.github/actions/cdk-deploy/action.yml:**

```yaml
name: CDK Deploy
description: Build and deploy a CDK stack

inputs:
  stack-name:
    description: Name of the CDK stack to deploy
    required: true
  cdk-path:
    description: Path to CDK package
    required: false
    default: packages/cdk

runs:
  using: composite
  steps:
    - name: CDK Deploy
      shell: bash
      run: npx cdk deploy ${{ inputs.stack-name }} --require-approval never
      working-directory: ${{ inputs.cdk-path }}
```

## GitHub Variable Scoping

Variables are configured at different levels in GitHub Settings:

### Organization Level

| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | `us-east-1` |
| `LOG_LEVEL` | Application log level | `debug` |
| `MODULE_LOG_LEVEL` | Module log level | `warn` |
| `PROJECT_SPONSOR` | Organization name | `finlaysonstudio` |

### Repository Level

| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_HOSTED_ZONE` | Route53 hosted zone | `example.com` |
| `PROJECT_KEY` | Project identifier | `myapp` |
| `PROJECT_SERVICE` | Service name | `stacks` |

### Environment Level

| Variable | Description | Required |
|----------|-------------|----------|
| `AWS_ROLE_ARN` | IAM role ARN for OIDC | Yes |
| `DATADOG_API_KEY_ARN` | Datadog API key ARN in Secrets Manager | No |
| `PROJECT_ENV` | Environment identifier | Yes |
| `PROJECT_NONCE` | Unique resource identifier | No |

### Auto-Generated Variables

These variables are set automatically from GitHub context:

| Variable | Source | Description |
|----------|--------|-------------|
| `CDK_DEFAULT_ACCOUNT` | `${{ github.repository_owner }}` | Repository owner |
| `CDK_DEFAULT_REGION` | `AWS_REGION` | Same as AWS region |
| `CDK_ENV_REPO` | `${{ github.repository }}` | Repository name (owner/repo) |
| `PROJECT_COMMIT` | `${{ github.sha }}` | Current commit SHA |
| `PROJECT_VERSION` | `package.json` | Version from package.json |

## Environment Variables Reference

### Application Variables

Application variables may be prefixed with `APP_`. Build systems and frontend frameworks may require their own prefixes (e.g., `NUXT_`, `VITE_`).

### CDK Variables

Environment-specific variables for CDK use the `CDK_ENV_` prefix.

| Variable | Source | Example |
|----------|--------|---------|
| `CDK_ENV_API_HOSTED_ZONE` | Workflow | Route53 hosted zone for API |
| `CDK_ENV_API_SUBDOMAIN` | Workflow | API subdomain |
| `CDK_ENV_REPO` | Workflow | GitHub repository |
| `CDK_ENV_WEB_HOSTED_ZONE` | Workflow | Route53 hosted zone for web |
| `CDK_ENV_WEB_SUBDOMAIN` | Workflow | Web subdomain |
| `CDK_ENV_BUCKET` | Stack | S3 bucket name |
| `CDK_ENV_QUEUE_URL` | Stack | SQS queue URL |
| `CDK_ENV_SNS_ROLE_ARN` | Stack | SNS role ARN |
| `CDK_ENV_SNS_TOPIC_ARN` | Stack | SNS topic ARN |

### Jaypie Variables

Variables for Jaypie and the application use the `PROJECT_` prefix.

| Variable | Description | Example Values |
|----------|-------------|----------------|
| `PROJECT_ENV` | Environment identifier | `development`, `production`, `sandbox`, or GitHub actor |
| `PROJECT_KEY` | Project shortname/slug | `myapp` |
| `PROJECT_NONCE` | Eight-character random string | `860b5a0f` |
| `PROJECT_SERVICE` | Service name | `myapp` |
| `PROJECT_SPONSOR` | Project sponsor/organization | `finlaysonstudio` |

## Secrets

By default, no secrets are required. Dependencies add secrets as needed.

### Secret Naming

Secrets follow the same conventions as variables. Use `SECRET_` prefix for secrets that will be resolved at runtime:
- `SECRET_MONGODB_URI` - Secret name in AWS Secrets Manager
- `MONGODB_URI` - Direct value (for local development)

### Passing Secrets

Secrets are passed to CDK via `JaypieEnvSecret` construct and made available at runtime.

Pass secrets only to steps that need them:

```yaml
- name: Deploy CDK Stack
  uses: ./.github/actions/cdk-deploy
  with:
    stack-name: AppStack
  env:
    SECRET_API_KEY: ${{ secrets.API_KEY }}
```

Never expose secrets in logs or workflow outputs.

### Adding Dependency Secrets

When adding dependencies that require secrets, update the workflow accordingly.

#### Example: Auth0 Integration

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

## Personal Builds

Personal builds allow developers to create isolated deployments connected to shared resources. They use the sandbox environment but with a unique `PROJECT_ENV` value.

### Configuration

Set `PROJECT_ENV` to a unique value per developer:

```yaml
- name: Setup Environment
  uses: ./.github/actions/setup-environment
  with:
    project-env: ${{ github.actor }}
```

### Branch Naming

Personal builds trigger on branches not matching static environments:
- `feat/*` branches deploy personal builds
- `nobuild-*` and `nobuild/*` branches skip deployment

## AWS OIDC Configuration

### Create OIDC Provider

In AWS IAM, create an OIDC identity provider:
- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

### Create IAM Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:ORG/REPO:*"
        }
      }
    }
  ]
}
```

## GitHub Environments

Create GitHub environments matching deployment targets:
- `development`
- `production`
- `sandbox`

Each environment contains variables and secrets specific to that deployment target.

## CDK Stack Names

The `stack-name` parameter in deploy workflows must match the stack ID defined in your CDK app:

```typescript
// bin/cdk.ts
new AppStack(app, "AppStack");  // "AppStack" is the stack ID
```

```yaml
# deploy-env-*.yml
- name: Deploy CDK Stack
  uses: ./.github/actions/cdk-deploy
  with:
    stack-name: AppStack  # Must match the stack ID above
```

If you rename the stack ID (e.g., to "MyProjectAppStack" for clarity in AWS), update all deploy workflows to match. Mismatched names cause "No stacks match the name(s)" errors.

## Environment-Aware Hostnames

Jaypie CDK constructs use `envHostname()` from `@jaypie/constructs` to determine deployment hostnames based on `PROJECT_ENV`:

| `PROJECT_ENV` | Example Hostname |
|---------------|------------------|
| `production` | `example.com` (apex domain) |
| `sandbox` | `sandbox.example.com` |
| `development` | `development.example.com` |
| `personal` | `personal.example.com` |

:::caution Critical Configuration
If `PROJECT_ENV` is not set or is set incorrectly in the GitHub environment, deployments may target the wrong hostname (e.g., deploying sandbox changes to production apex).
:::

### How It Works

1. The `setup-environment` action reads `${{ vars.PROJECT_ENV }}` from the GitHub environment
2. This is exported as `PROJECT_ENV` to `$GITHUB_ENV`
3. CDK constructs read `process.env.PROJECT_ENV` via `envHostname()`
4. For production, the environment prefix is omitted (apex domain)
5. For all other environments, the prefix is prepended

### Using envHostname in Stacks

```typescript
import { envHostname, JaypieAppStack, JaypieStaticWebBucket } from "@jaypie/constructs";

export class MyStack extends JaypieAppStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const zone = process.env.CDK_ENV_HOSTED_ZONE ?? "example.com";
    // Returns "example.com" for production, "sandbox.example.com" for sandbox
    const host = envHostname({ domain: zone });

    new JaypieStaticWebBucket(this, "Bucket", { host, zone });
  }
}
```

## AWS Integration

Use OIDC authentication with `aws-actions/configure-aws-credentials@v4`:

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - name: Configure AWS Credentials
    uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: ${{ vars.AWS_ROLE_ARN }}
      role-session-name: DeployRoleForGitHubSession
      aws-region: us-east-1
```

Create an IAM role with trust policy for GitHub OIDC provider. Scope the trust policy to your repository.

## Datadog Integration

Integrate Datadog for observability by storing the API key in AWS Secrets Manager:

```yaml
env:
  CDK_ENV_DATADOG_API_KEY_ARN: ${{ vars.DATADOG_API_KEY_ARN }}
```

The CDK stack retrieves the key at deploy time and configures Lambda instrumentation.

## Linting and Testing

Use `npm run lint` and `npm run test`. Verify the test script uses `vitest run` or otherwise does not watch. If the script watches, propose changing it or use `vitest run` directly.

## Troubleshooting

### OIDC Authentication Fails

1. Verify OIDC provider exists in AWS IAM
2. Check role trust policy includes correct repository
3. Ensure `id-token: write` permission in workflow

### CDK Deploy Fails

1. Verify AWS credentials configured
2. Check stack name matches between CDK and workflow
3. Review CloudFormation events for specific errors

### Deployment Targets Wrong Hostname

If sandbox deploys to production URL or vice versa:
1. Go to GitHub Settings → Environments
2. Select the environment (sandbox, development, production)
3. Verify `PROJECT_ENV` variable exists and matches the environment name exactly
4. Ensure the CDK stack uses `envHostname()` rather than hardcoded hostnames

### Test Matrix Fails on Specific Node Version

1. Check for version-specific dependencies
2. Verify package-lock.json is committed
3. Review engine requirements in package.json

### Deployment Stuck in Concurrency Queue

1. Do not use `cancel-in-progress: true` (can leave deployments mid-way)
2. Wait for previous deployment to complete
3. Check GitHub Actions for failed/stuck runs in the same concurrency group

## Related

- [CDK Infrastructure](/docs/guides/cdk-infrastructure) - CDK deployment setup
- [Environment Variables](/docs/core/environment) - Environment configuration
- [Project Structure](/docs/architecture/project-structure) - Monorepo setup
