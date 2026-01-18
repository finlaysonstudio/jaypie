---
description: conventions around deployment and environment variables, especially CDK_ENV_ and PROJECT_
---

# Jaypie CI/CD with GitHub Actions

Reference for Jaypie CI/CD conventions. For setup instructions, see `Jaypie_Init_CICD_with_GitHub_Actions.md`.

## Workspace Naming Conventions

| Directory | Purpose |
|-----------|---------|
| `packages/` | Default workspace for npm packages (preferred when only one namespace needed) |
| `stacks/` | CDK-deployed infrastructure and sites (as opposed to npm-published) |
| `workspaces/` | Generic workspace for other work |

## Jaypie Environments

Jaypie assumes multiple deployed environments:

| Environment | Purpose |
|-------------|---------|
| production | Live environment, standalone |
| development | Validates multi-environment deployment works |
| sandbox | Shared testing environment |
| personal | Developer-specific builds tied to GitHub actor |

## Naming Conventions

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

## File Structure

Workflow files follow this order:

```yaml
name:
on:
concurrency:
env:         # alphabetical
jobs:        # alphabetical
```

### Style Rules

1. Do not use secrets in the `env` section
2. Only pass secrets as environment variables to tasks that require them
3. Declare programmatic variables in `env` with empty string and comment:
   ```yaml
   env:
     PROJECT_VERSION: ""  # Set from package.json during build
   ```
4. Static variables should be set in `env`, not in job steps

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

### Linting and Testing

Use `npm run lint` and `npm run test`. Verify the test script uses `vitest run` or otherwise does not watch. If the script watches, propose changing it or use `vitest run` directly.

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

## GitHub Environments

Create GitHub environments matching deployment targets:
- `development`
- `production`
- `sandbox`

Each environment contains variables and secrets specific to that deployment target.

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

### Log Levels

| Variable | Default |
|----------|---------|
| `LOG_LEVEL` | `debug` |
| `MODULE_LOG_LEVEL` | `warn` |

### Vendor Variables

Follow naming from vendor documentation. If documentation does not reference environment variables, use the vendor name prefix (e.g., `E2B_TEAM_ID`, `POSTMAN_ENVIRONMENT_UUID`).

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

## CDK Stack Names

The `stack-name` parameter in deploy workflows must match the stack ID defined in `packages/cdk/bin/cdk.ts`:

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

## Integrations

### AWS

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

### Datadog

Integrate Datadog for observability by storing the API key in AWS Secrets Manager:

```yaml
env:
  CDK_ENV_DATADOG_API_KEY_ARN: ${{ vars.DATADOG_API_KEY_ARN }}
```

The CDK stack retrieves the key at deploy time and configures Lambda instrumentation.

