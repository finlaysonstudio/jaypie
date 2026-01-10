---
description: conventions around deployment and environment variables, especially CDK_ENV_ and PROJECT_
---

# Jaypie CI/CD with GitHub Actions

Reference for Jaypie CI/CD conventions. For setup instructions, see `Jaypie_Init_CICD_with_GitHub_Actions.md`.

## Jaypie Environments

Jaypie assumes multiple deployed environments:

| Environment | Purpose |
|-------------|---------|
| production | Live environment, standalone |
| development | Validates multi-environment deployment works |
| sandbox | Shared testing environment |
| personal | Developer-specific builds tied to GitHub actor |

## Naming Conventions

Workflow files lead with the most important keyword and end with the environment:
- `deploy-personal-build.yml`
- `deploy-sandbox.yml`
- `deploy-production.yml`
- `npm-deploy.yml`

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
| production | tags: `v*` |
| development | branches: `[main]` |
| sandbox | branches: `[main, develop, sandbox, sandbox-*, sandbox/*]` |
| personal | branches-ignore: `[main, develop, nobuild-*, nobuild/*, sandbox, sandbox-*, sandbox/*]` |

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

New builds cancel in-progress builds. Environments run in parallel between each other but concurrently within an environment.

### Static Builds

```yaml
concurrency:
  group: deploy-production
  cancel-in-progress: true
```

### Personal Builds

```yaml
concurrency:
  group: deploy-personal-build-${{ github.actor }}
  cancel-in-progress: true
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

### Secret Naming

Secrets follow the same conventions as variables. Use `SECRET_` prefix for secrets that will be resolved at runtime:
- `SECRET_MONGODB_URI` - Secret name in AWS Secrets Manager
- `MONGODB_URI` - Direct value (for local development)

### Passing Secrets

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

