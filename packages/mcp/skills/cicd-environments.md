---
description: GitHub Environments configuration for CDK deployments
related: cicd, cicd-actions, cicd-deploy, variables
---

# GitHub Environments Configuration

GitHub Environments provide deployment-specific variables for Jaypie CDK workflows. Each environment (sandbox, production) has its own set of variables.

## Required Variables

| Variable | Description |
|----------|-------------|
| `AWS_ROLE_ARN` | OIDC role ARN for assuming AWS credentials |

## Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | `us-east-1` | AWS region for deployment |
| `LOG_LEVEL` | `trace` (sandbox) / `info` (production) | Application log level |
| `PROJECT_CHAOS` | `full` (sandbox) / `none` (production) | Chaos engineering mode |
| `PROJECT_ENV` | Environment name | Environment identifier |
| `PROJECT_NONCE` | Branch name or `prod` | Unique identifier for resources |

## Environment Setup

### Create Environment

1. Navigate to **Settings** → **Environments**
2. Click **New environment**
3. Enter environment name (e.g., `sandbox`, `production`)
4. Click **Configure environment**

### Add Environment Variables

1. In environment settings, click **Add variable**
2. Add required and optional variables:

**Sandbox Environment:**

```
AWS_ROLE_ARN      = arn:aws:iam::123456789012:role/GitHubActions-Sandbox
AWS_REGION        = us-east-1
PROJECT_ENV       = sandbox
LOG_LEVEL         = trace
PROJECT_CHAOS     = full
```

**Production Environment:**

```
AWS_ROLE_ARN      = arn:aws:iam::123456789012:role/GitHubActions-Production
AWS_REGION        = us-east-1
PROJECT_ENV       = production
LOG_LEVEL         = info
PROJECT_CHAOS     = none
```

### Configure Deployment Protection (Production)

For production environments:

1. Enable **Required reviewers** and add approvers
2. Enable **Wait timer** if needed
3. Limit deployment branches to `main`, `production-*`, `v*`

## AWS OIDC Role Setup

### Trust Policy

Create an IAM role with this trust policy to allow GitHub Actions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:org/repo:*"
        }
      }
    }
  ]
}
```

### Role Permissions

Attach policies for CDK deployment:

- `PowerUserAccess` for CDK deployments, or scoped custom policy
- `iam:PassRole` for Lambda execution roles

## Workflow Environment Usage

Reference environments in workflow files:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: sandbox
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_ROLE_ARN }}
          aws-region: ${{ vars.AWS_REGION || 'us-east-1' }}
```

## Variable Precedence

Variables are resolved in order:

1. Job/step `env:` block (highest priority)
2. Workflow-level `env:` block
3. Environment variables (`vars.*`)
4. Repository variables
5. Default values in composite actions

## Troubleshooting

### "No credentials" Error

**Symptoms:** `Error: Credentials could not be loaded`

**Causes:**
- Missing `id-token: write` permission
- Incorrect `AWS_ROLE_ARN`
- Role trust policy not configured for repository

**Fix:** Verify OIDC role trust policy matches repository and permissions include `id-token: write`.

### "Access Denied" During Deploy

**Symptoms:** CDK deploy fails with permission errors

**Causes:**
- Role lacks required permissions
- Cross-account access not configured
- Resource policy restrictions

**Fix:** Review CloudTrail logs for specific denied action and update role policy.

### Variables Not Resolving

**Symptoms:** `${{ vars.AWS_ROLE_ARN }}` is empty

**Causes:**
- Variable not defined in environment
- Environment not specified in job
- Typo in variable name

**Fix:** Verify environment is set and variable exists with exact spelling.

### Wrong Environment Used

**Symptoms:** Deploying to wrong environment

**Causes:**
- `environment:` key missing or incorrect in job
- Branch protection rules not limiting deployments

**Fix:** Add explicit `environment:` to job and configure branch restrictions.

## Best Practices

1. **Use separate AWS accounts** for sandbox and production
2. **Limit production role permissions** to specific resources
3. **Enable deployment protection** for production
4. **Use environment-specific secrets** when needed
5. **Document role ARNs** in repository README or wiki
