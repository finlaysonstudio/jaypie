---
sidebar_position: 5
---

# CI/CD with GitHub Actions


**Prerequisites:**
- GitHub repository
- AWS account with OIDC configured
- Jaypie CDK package (for deployments)

## Overview

Jaypie projects use GitHub Actions for CI/CD with environment-specific deployments.
The standard workflow includes check (lint, type, test) on feature branches and deploy on main.

## Quick Reference

### Environments

| Environment | Branch/Trigger | Purpose |
|-------------|----------------|---------|
| sandbox | `feat/*`, `fix/*` | Development testing |
| development | `main` | Staging/QA |
| production | Release tags | Production deployment |

### Workflow Files

| File | Trigger | Actions |
|------|---------|---------|
| `npm-check.yml` | Feature branches | Lint, typecheck, test |
| `npm-deploy.yml` | Main branch, tags | Build, deploy to AWS |

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
        node-version: ['20', '22', '24']
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

**.github/workflows/npm-deploy.yml:**

```yaml
name: Deploy

on:
  push:
    branches:
      - main
    tags:
      - 'deploy-*'
      - 'rc-*'

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.ref == 'refs/heads/main' && 'development' || 'production' }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - run: npm ci
      - run: npm run build

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1

      - name: Deploy CDK
        run: npm run deploy -w packages/cdk
        env:
          PROJECT_ENV: ${{ vars.PROJECT_ENV }}
```

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

### GitHub Secrets

| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | ARN of the IAM role |

### GitHub Variables

| Variable | Development | Production |
|----------|-------------|------------|
| `PROJECT_ENV` | development | production |
| `PROJECT_KEY` | my-project | my-project |

## Environment Configuration

### GitHub Environments

Create environments in GitHub repository settings:

1. **development**
   - No protection rules
   - Variables: `PROJECT_ENV=development`

2. **production**
   - Required reviewers
   - Variables: `PROJECT_ENV=production`

### Environment-Specific Deployments

```yaml
jobs:
  deploy-sandbox:
    if: startsWith(github.ref, 'refs/heads/feat/')
    environment: sandbox
    # ...

  deploy-development:
    if: github.ref == 'refs/heads/main'
    environment: development
    # ...

  deploy-production:
    if: startsWith(github.ref, 'refs/tags/deploy-')
    environment: production
    # ...
```

## Composite Actions

### Reusable Setup Action

**.github/actions/setup/action.yml:**

```yaml
name: Setup
description: Setup Node.js and install dependencies

runs:
  using: composite
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'npm'

    - run: npm ci
      shell: bash
```

### Usage

```yaml
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: npm run build
```

## Variable Naming Conventions

### Environment Variables

| Pattern | Source | Example |
|---------|--------|---------|
| `PROJECT_*` | GitHub Variables | `PROJECT_ENV`, `PROJECT_KEY` |
| `CDK_ENV_*` | CDK outputs | `CDK_ENV_QUEUE_URL` |
| `SECRET_*` | Secret references | `SECRET_MONGODB_URI` |

### Secrets

| Pattern | Purpose |
|---------|---------|
| `AWS_ROLE_ARN` | OIDC role for deployments |
| `NPM_TOKEN` | npm publishing |
| `DATADOG_API_KEY` | Datadog integration |

## Concurrency Control

Prevent concurrent deployments to same environment:

```yaml
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false
```

## Personal Sandbox Builds

For feature branch testing with personal AWS sandbox:

```yaml
deploy-sandbox:
  if: |
    startsWith(github.ref, 'refs/heads/feat/') &&
    contains(github.event.head_commit.message, '[deploy]')
  environment: sandbox-${{ github.actor }}
```

Trigger with commit message containing `[deploy]`.

## Troubleshooting

### OIDC Authentication Fails

1. Verify OIDC provider exists in AWS IAM
2. Check role trust policy includes correct repository
3. Ensure `id-token: write` permission in workflow

### CDK Deploy Fails

1. Verify AWS credentials configured
2. Check stack name matches between CDK and workflow
3. Review CloudFormation events for specific errors

### Test Matrix Fails on Specific Node Version

1. Check for version-specific dependencies
2. Verify package-lock.json is committed
3. Review engine requirements in package.json

## Related

- [CDK Infrastructure](/docs/guides/cdk-infrastructure) - CDK deployment setup
- [Environment Variables](/docs/core/environment) - Environment configuration
- [Project Structure](/docs/architecture/project-structure) - Monorepo setup
