---
description: step-by-step guide to initialize GitHub Actions CI/CD for Jaypie projects
---

# Initialize CI/CD with GitHub Actions

This guide walks through setting up GitHub Actions CI/CD from scratch for a Jaypie project.

## Prerequisites

- GitHub repository with Jaypie project structure
- AWS account with OIDC provider configured for GitHub Actions
- GitHub environments configured (development, sandbox, production)

## Directory Structure

Create the following structure:

```
.github/
├── actions/
│   ├── cdk-deploy/
│   │   └── action.yml
│   ├── configure-aws/
│   │   └── action.yml
│   ├── npm-install-build/
│   │   └── action.yml
│   ├── setup-environment/
│   │   └── action.yml
│   └── setup-node-and-cache/
│       └── action.yml
└── workflows/
    ├── check-production.yml
    ├── deploy-development.yml
    ├── deploy-production.yml
    ├── deploy-sandbox.yml
    └── version.yml
```

## Step 1: Create Composite Actions

Composite actions provide reusable workflow steps. Create each file in `.github/actions/`.

### configure-aws/action.yml

Configures AWS credentials using OIDC.

```yaml
name: Configure AWS Credentials
description: Configure AWS credentials using OIDC for GitHub Actions

inputs:
  role-arn:
    description: AWS IAM role ARN to assume
    required: true
  aws-region:
    description: AWS region
    required: false
    default: us-east-1
  role-session-name:
    description: Name for the role session
    required: false
    default: DeployRoleForGitHubSession

runs:
  using: composite
  steps:
    - name: Configure AWS Credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: ${{ inputs.role-arn }}
        role-session-name: ${{ inputs.role-session-name }}
        aws-region: ${{ inputs.aws-region }}
```

### setup-node-and-cache/action.yml

Sets up Node.js with caching for dependencies.

```yaml
name: Setup Node.js and Cache Dependencies
description: Checkout code, setup Node.js with npm cache, and configure dependency caching

inputs:
  node-version:
    description: Node.js version to use
    required: false
    default: "20"

outputs:
  node-modules-cache-hit:
    description: Whether node_modules cache was hit
    value: ${{ steps.cache-node-modules.outputs.cache-hit }}

runs:
  using: composite
  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js ${{ inputs.node-version }}
      uses: actions/setup-node@v4
      with:
        cache: npm
        node-version: ${{ inputs.node-version }}

    - name: Cache node_modules
      id: cache-node-modules
      uses: actions/cache@v4
      with:
        path: |
          node_modules
          packages/*/node_modules
        key: ${{ runner.os }}-node-${{ inputs.node-version }}-modules-${{ hashFiles('**/package-lock.json') }}
        restore-keys: |
          ${{ runner.os }}-node-${{ inputs.node-version }}-modules-

    - name: Cache Status
      shell: bash
      run: |
        echo "Node modules cache: ${{ steps.cache-node-modules.outputs.cache-hit == 'true' && '✓ HIT' || '✗ MISS' }}"
```

### npm-install-build/action.yml

Installs dependencies and builds the project.

```yaml
name: NPM Install and Build
description: Install dependencies and build the project

inputs:
  use-ci:
    description: Use npm ci instead of npm install (recommended for CI/CD)
    required: false
    default: "true"
  build-command:
    description: NPM script to run for building
    required: false
    default: build

runs:
  using: composite
  steps:
    - name: Install dependencies
      shell: bash
      run: |
        if [ "${{ inputs.use-ci }}" = "true" ]; then
          npm ci
        else
          npm install
        fi

    - name: Build project
      shell: bash
      run: npm run ${{ inputs.build-command }}
```

### setup-environment/action.yml

Configures environment variables with sensible defaults. Customize the defaults for your project.

```yaml
name: Setup Environment Variables
description: Configure environment variables with sensible defaults

inputs:
  aws-region:
    description: AWS region
    required: false
  aws-role-arn:
    description: AWS IAM role ARN
    required: false
  datadog-api-key-arn:
    description: Datadog API key ARN
    required: false
  aws-hosted-zone:
    description: Route53 hosted zone
    required: false
  log-level:
    description: Application log level
    required: false
  module-log-level:
    description: Module log level
    required: false
  project-env:
    description: Project environment
    required: false
  project-key:
    description: Project key
    required: false
  project-nonce:
    description: Project nonce
    required: false
  project-service:
    description: Project service name
    required: false
  project-sponsor:
    description: Project sponsor
    required: false

outputs:
  aws-region:
    description: Resolved AWS region
    value: ${{ steps.set-env.outputs.aws-region }}
  aws-role-arn:
    description: Resolved AWS role ARN
    value: ${{ steps.set-env.outputs.aws-role-arn }}
  project-env:
    description: Resolved project environment
    value: ${{ steps.set-env.outputs.project-env }}

runs:
  using: composite
  steps:
    - name: Set environment variables
      id: set-env
      shell: bash
      run: |
        # Read from inputs and apply defaults using bash parameter expansion
        AWS_REGION="${{ inputs.aws-region }}"
        AWS_REGION="${AWS_REGION:-us-east-1}"

        AWS_ROLE_ARN="${{ inputs.aws-role-arn }}"

        DATADOG_API_KEY_ARN="${{ inputs.datadog-api-key-arn }}"

        HOSTED_ZONE="${{ inputs.aws-hosted-zone }}"
        HOSTED_ZONE="${HOSTED_ZONE:-example.com}"

        LOG_LEVEL="${{ inputs.log-level }}"
        LOG_LEVEL="${LOG_LEVEL:-debug}"

        MODULE_LOG_LEVEL="${{ inputs.module-log-level }}"
        MODULE_LOG_LEVEL="${MODULE_LOG_LEVEL:-warn}"

        PROJECT_ENV="${{ inputs.project-env }}"
        PROJECT_ENV="${PROJECT_ENV:-sandbox}"

        PROJECT_KEY="${{ inputs.project-key }}"
        PROJECT_KEY="${PROJECT_KEY:-myapp}"

        PROJECT_NONCE="${{ inputs.project-nonce }}"
        PROJECT_NONCE="${PROJECT_NONCE:-$(echo $RANDOM | md5sum | head -c 8)}"

        PROJECT_SERVICE="${{ inputs.project-service }}"
        PROJECT_SERVICE="${PROJECT_SERVICE:-myapp}"

        PROJECT_SPONSOR="${{ inputs.project-sponsor }}"
        PROJECT_SPONSOR="${PROJECT_SPONSOR:-myorg}"

        # Extract version from package.json
        PROJECT_VERSION=$(node -p "require('./package.json').version")

        # Export all environment variables
        echo "AWS_REGION=${AWS_REGION}" >> $GITHUB_ENV
        echo "AWS_ROLE_ARN=${AWS_ROLE_ARN}" >> $GITHUB_ENV
        echo "CDK_ENV_DATADOG_API_KEY_ARN=${DATADOG_API_KEY_ARN}" >> $GITHUB_ENV
        echo "CDK_ENV_HOSTED_ZONE=${HOSTED_ZONE}" >> $GITHUB_ENV
        echo "CDK_ENV_REPO=${{ github.repository }}" >> $GITHUB_ENV
        echo "LOG_LEVEL=${LOG_LEVEL}" >> $GITHUB_ENV
        echo "MODULE_LOG_LEVEL=${MODULE_LOG_LEVEL}" >> $GITHUB_ENV
        echo "PROJECT_COMMIT=${{ github.sha }}" >> $GITHUB_ENV
        echo "PROJECT_ENV=${PROJECT_ENV}" >> $GITHUB_ENV
        echo "PROJECT_KEY=${PROJECT_KEY}" >> $GITHUB_ENV
        echo "PROJECT_NONCE=${PROJECT_NONCE}" >> $GITHUB_ENV
        echo "PROJECT_SERVICE=${PROJECT_SERVICE}" >> $GITHUB_ENV
        echo "PROJECT_SPONSOR=${PROJECT_SPONSOR}" >> $GITHUB_ENV
        echo "PROJECT_VERSION=${PROJECT_VERSION}" >> $GITHUB_ENV

        # Set outputs
        echo "aws-region=${AWS_REGION}" >> $GITHUB_OUTPUT
        echo "aws-role-arn=${AWS_ROLE_ARN}" >> $GITHUB_OUTPUT
        echo "project-env=${PROJECT_ENV}" >> $GITHUB_OUTPUT
```

### cdk-deploy/action.yml

Builds and deploys CDK stack with caching.

```yaml
name: CDK Build and Deploy
description: Build and deploy AWS CDK stack with caching

inputs:
  stack-name:
    description: CDK stack name to deploy
    required: true
  cdk-package-path:
    description: Path to CDK package
    required: false
    default: packages/cdk

runs:
  using: composite
  steps:
    - name: Cache CDK build
      id: cache-cdk
      uses: actions/cache@v4
      with:
        path: ${{ inputs.cdk-package-path }}/dist
        key: ${{ runner.os }}-cdk-build-${{ hashFiles(format('{0}/package.json', inputs.cdk-package-path), format('{0}/package-lock.json', inputs.cdk-package-path), format('{0}/tsconfig.json', inputs.cdk-package-path), format('{0}/bin/**', inputs.cdk-package-path), format('{0}/lib/**', inputs.cdk-package-path)) }}
        restore-keys: |
          ${{ runner.os }}-cdk-build-

    - name: CDK Cache Status
      shell: bash
      run: |
        if [ "${{ steps.cache-cdk.outputs.cache-hit }}" == "true" ]; then
          echo "✓ CDK build cache HIT - skipping rebuild"
        else
          echo "✗ CDK build cache MISS - will rebuild"
        fi

    - name: Build CDK
      if: steps.cache-cdk.outputs.cache-hit != 'true'
      shell: bash
      run: npm --prefix ${{ inputs.cdk-package-path }} run build

    - name: Deploy CDK Stack
      shell: bash
      run: npm --workspace ${{ inputs.cdk-package-path }} run cdk deploy -- ${{ inputs.stack-name }} --require-approval never
```

## Step 2: Create Workflow Files

Create workflow files in `.github/workflows/`.

### deploy-sandbox.yml

Deploys to sandbox on feature branches. Lint and test run in parallel with deploy.

```yaml
name: Build to Sandbox

on:
  push:
    branches:
      - feat/*
      - main
      - sandbox/*
    tags:
      - sandbox-*

concurrency:
  group: deploy-sandbox
  cancel-in-progress: true

jobs:
  deploy:
    environment: sandbox
    name: Deploy to AWS
    permissions:
      id-token: write
      contents: read
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Environment
        id: setup-env
        uses: ./.github/actions/setup-environment
        with:
          aws-region: ${{ vars.AWS_REGION }}
          aws-role-arn: ${{ vars.AWS_ROLE_ARN }}
          datadog-api-key-arn: ${{ vars.DATADOG_API_KEY_ARN }}
          aws-hosted-zone: ${{ vars.AWS_HOSTED_ZONE }}
          log-level: ${{ vars.LOG_LEVEL }}
          module-log-level: ${{ vars.MODULE_LOG_LEVEL }}
          project-env: ${{ vars.PROJECT_ENV }}
          project-key: ${{ vars.PROJECT_KEY }}
          project-nonce: ${{ vars.PROJECT_NONCE }}
          project-service: ${{ vars.PROJECT_SERVICE }}
          project-sponsor: ${{ vars.PROJECT_SPONSOR }}

      - name: Configure AWS Credentials
        uses: ./.github/actions/configure-aws
        with:
          role-arn: ${{ steps.setup-env.outputs.aws-role-arn }}
          aws-region: ${{ steps.setup-env.outputs.aws-region }}

      - name: Setup Node.js and Cache
        uses: ./.github/actions/setup-node-and-cache
        with:
          node-version: 20

      - name: Install and Build
        uses: ./.github/actions/npm-install-build

      - name: Deploy CDK Stack
        uses: ./.github/actions/cdk-deploy
        with:
          stack-name: AppStack

  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js and Cache
        id: setup-cache
        uses: ./.github/actions/setup-node-and-cache
        with:
          node-version: 20

      - name: Install dependencies
        if: steps.setup-cache.outputs.node-modules-cache-hit != 'true'
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run Lint
        run: npm run lint

  test:
    name: Unit Test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x, 22.x]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }} and Cache
        id: setup-cache
        uses: ./.github/actions/setup-node-and-cache
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        if: steps.setup-cache.outputs.node-modules-cache-hit != 'true'
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run Tests
        run: npm test
```

### deploy-development.yml

Deploys to development from main branch. Requires lint and test to pass.

```yaml
name: Build to Development

on:
  push:
    branches:
      - main
      - development/*
    tags:
      - development-*

concurrency:
  group: deploy-development
  cancel-in-progress: true

jobs:
  deploy:
    environment: development
    needs: [lint, test]
    name: Deploy to AWS
    permissions:
      id-token: write
      contents: read
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Environment
        id: setup-env
        uses: ./.github/actions/setup-environment
        with:
          aws-region: ${{ vars.AWS_REGION }}
          aws-role-arn: ${{ vars.AWS_ROLE_ARN }}
          datadog-api-key-arn: ${{ vars.DATADOG_API_KEY_ARN }}
          aws-hosted-zone: ${{ vars.AWS_HOSTED_ZONE }}
          log-level: ${{ vars.LOG_LEVEL }}
          module-log-level: ${{ vars.MODULE_LOG_LEVEL }}
          project-env: ${{ vars.PROJECT_ENV }}
          project-key: ${{ vars.PROJECT_KEY }}
          project-nonce: ${{ vars.PROJECT_NONCE }}
          project-service: ${{ vars.PROJECT_SERVICE }}
          project-sponsor: ${{ vars.PROJECT_SPONSOR }}

      - name: Configure AWS Credentials
        uses: ./.github/actions/configure-aws
        with:
          role-arn: ${{ steps.setup-env.outputs.aws-role-arn }}
          aws-region: ${{ steps.setup-env.outputs.aws-region }}

      - name: Setup Node.js and Cache
        uses: ./.github/actions/setup-node-and-cache
        with:
          node-version: 20

      - name: Install and Build
        uses: ./.github/actions/npm-install-build

      - name: Deploy CDK Stack
        uses: ./.github/actions/cdk-deploy
        with:
          stack-name: AppStack

  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js and Cache
        id: setup-cache
        uses: ./.github/actions/setup-node-and-cache
        with:
          node-version: 20

      - name: Install dependencies
        if: steps.setup-cache.outputs.node-modules-cache-hit != 'true'
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run Lint
        run: npm run lint

  test:
    name: Unit Test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x, 22.x]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }} and Cache
        id: setup-cache
        uses: ./.github/actions/setup-node-and-cache
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        if: steps.setup-cache.outputs.node-modules-cache-hit != 'true'
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run Tests
        run: npm test
```

### deploy-production.yml

Deploys to production from version tags. Requires lint and test to pass. Does not cancel in-progress builds.

```yaml
name: Build to Production

on:
  push:
    tags:
      - 'production-*'
      - 'v0.*'
      - 'v1.*'

concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  deploy:
    environment: production
    needs: [lint, test]
    if: |
      always() &&
      needs.lint.result == 'success' &&
      needs.test.result == 'success'
    name: Deploy to AWS
    permissions:
      id-token: write
      contents: read
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Display deployment version
        run: |
          VERSION=$(node -p "require('./package.json').version")
          echo "::notice::Deploying version $VERSION to production"
          echo "DEPLOY_VERSION=$VERSION" >> $GITHUB_ENV

      - name: Setup Environment
        id: setup-env
        uses: ./.github/actions/setup-environment
        with:
          aws-region: ${{ vars.AWS_REGION }}
          aws-role-arn: ${{ vars.AWS_ROLE_ARN }}
          datadog-api-key-arn: ${{ vars.DATADOG_API_KEY_ARN }}
          aws-hosted-zone: ${{ vars.AWS_HOSTED_ZONE }}
          log-level: ${{ vars.LOG_LEVEL }}
          module-log-level: ${{ vars.MODULE_LOG_LEVEL }}
          project-env: ${{ vars.PROJECT_ENV }}
          project-key: ${{ vars.PROJECT_KEY }}
          project-nonce: ${{ vars.PROJECT_NONCE }}
          project-service: ${{ vars.PROJECT_SERVICE }}
          project-sponsor: ${{ vars.PROJECT_SPONSOR }}

      - name: Configure AWS Credentials
        uses: ./.github/actions/configure-aws
        with:
          role-arn: ${{ steps.setup-env.outputs.aws-role-arn }}
          aws-region: ${{ steps.setup-env.outputs.aws-region }}

      - name: Setup Node.js and Cache
        uses: ./.github/actions/setup-node-and-cache
        with:
          node-version: 20

      - name: Install and Build
        uses: ./.github/actions/npm-install-build

      - name: Deploy CDK Stack
        uses: ./.github/actions/cdk-deploy
        with:
          stack-name: AppStack

  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js and Cache
        id: setup-cache
        uses: ./.github/actions/setup-node-and-cache
        with:
          node-version: 20

      - name: Install dependencies
        if: steps.setup-cache.outputs.node-modules-cache-hit != 'true'
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run Lint
        run: npm run lint

  test:
    name: Unit Test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x, 22.x]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }} and Cache
        id: setup-cache
        uses: ./.github/actions/setup-node-and-cache
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        if: steps.setup-cache.outputs.node-modules-cache-hit != 'true'
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run Tests
        run: npm test
```

### check-production.yml

Runs checks on production branches without deploying.

```yaml
name: Check Production Build

on:
  push:
    branches:
      - production
      - production-*
      - production/*

concurrency:
  group: check-production
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js and Cache
        id: setup-cache
        uses: ./.github/actions/setup-node-and-cache
        with:
          node-version: 20

      - name: Install dependencies
        if: steps.setup-cache.outputs.node-modules-cache-hit != 'true'
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run Lint
        run: npm run lint

  test:
    name: Unit Test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x, 22.x]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }} and Cache
        id: setup-cache
        uses: ./.github/actions/setup-node-and-cache
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        if: steps.setup-cache.outputs.node-modules-cache-hit != 'true'
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run Tests
        run: npm test
```

### version.yml

Updates version across monorepo packages.

```yaml
name: Update Version

on:
  workflow_dispatch:
    inputs:
      version_type:
        description: 'Version update type'
        required: true
        type: choice
        options:
          - patch
          - minor
          - major
          - custom
        default: patch
      custom_version:
        description: 'Custom version (e.g., 1.2.3) - only used if version_type is custom'
        required: false
        type: string
  workflow_call:
    inputs:
      version_type:
        description: 'Version update type'
        required: false
        type: string
        default: patch
      custom_version:
        description: 'Custom version (e.g., 1.2.3) - only used if version_type is custom'
        required: false
        type: string
    outputs:
      new_version:
        description: 'The new version number'
        value: ${{ jobs.version.outputs.new_version }}

jobs:
  version:
    name: Update and Sync Version
    runs-on: ubuntu-latest
    permissions:
      contents: write
    outputs:
      new_version: ${{ steps.bump.outputs.new_version }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Update root version
        id: bump
        run: |
          VERSION_TYPE="${{ inputs.version_type }}"
          CUSTOM_VERSION="${{ inputs.custom_version }}"

          if [[ "$VERSION_TYPE" == "custom" ]]; then
            if [[ -z "$CUSTOM_VERSION" ]]; then
              echo "Error: custom_version is required when version_type is 'custom'"
              exit 1
            fi
            npm version "$CUSTOM_VERSION" --no-git-tag-version --allow-same-version
          else
            npm version "$VERSION_TYPE" --no-git-tag-version
          fi

          NEW_VERSION=$(node -p "require('./package.json').version")
          echo "new_version=$NEW_VERSION" >> $GITHUB_OUTPUT
          echo "Updated to version $NEW_VERSION"

      - name: Sync package versions
        run: |
          NEW_VERSION="${{ steps.bump.outputs.new_version }}"
          echo "Syncing all packages to version $NEW_VERSION"

          for pkg in packages/*/package.json; do
            if [ -f "$pkg" ]; then
              echo "Updating $pkg"
              node -e "
                const fs = require('fs');
                const pkg = JSON.parse(fs.readFileSync('$pkg', 'utf8'));
                pkg.version = '$NEW_VERSION';
                fs.writeFileSync('$pkg', JSON.stringify(pkg, null, 2) + '\n');
              "
            fi
          done

      - name: Commit and push changes
        run: |
          git add package.json package-lock.json packages/*/package.json
          git commit -m "chore: version: ${{ steps.bump.outputs.new_version }}"
          git push
```

## Step 3: Configure GitHub Environments

Create environments in your GitHub repository settings. Each environment contains variables and secrets for that deployment target.

### Creating an Environment

1. Go to your repository on GitHub
2. Navigate to **Settings → Environments**
3. Click **New environment**
4. Name it (e.g., `sandbox`, `development`, `production`)
5. Click **Configure environment**
6. Under **Environment variables**, click **Add variable** for each variable

### Required Variables (per environment)

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_ROLE_ARN` | IAM role ARN for OIDC (deployment fails without this) | `arn:aws:iam::123456789:role/DeployRole` |

### Optional Variables (per environment)

| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_HOSTED_ZONE` | Route53 hosted zone | `example.com` |
| `DATADOG_API_KEY_ARN` | Secrets Manager ARN for Datadog | (none) |
| `LOG_LEVEL` | Application log level | `debug` |
| `MODULE_LOG_LEVEL` | Module log level | `warn` |
| `PROJECT_ENV` | Environment name | `sandbox` |
| `PROJECT_KEY` | Project identifier | (from package.json name) |
| `PROJECT_NONCE` | Unique identifier for resources | (random) |
| `PROJECT_SERVICE` | Service name | (from package.json name) |
| `PROJECT_SPONSOR` | Organization name | (from repository owner) |

### Auto-Generated Variables

These variables are set automatically from GitHub context:

| Variable | Source | Description |
|----------|--------|-------------|
| `CDK_ENV_REPO` | `${{ github.repository }}` | Repository name (owner/repo) |
| `PROJECT_COMMIT` | `${{ github.sha }}` | Current commit SHA |
| `PROJECT_VERSION` | `package.json` | Version from package.json |

### Environment Secrets

Add secrets for sensitive values. Secrets are passed to actions via `${{ secrets.SECRET_NAME }}`.

Navigate to: **Settings → Environments → [environment] → Environment secrets**

### Deployment Protection Rules (Optional)

You can add protection rules to any environment:

- **Required reviewers**: Require manual approval before deploying
- **Wait timer**: Delay deployment by a specified time
- **Deployment branches**: Limit which branches can deploy

### How Variables Are Resolved

GitHub Actions composite actions cannot access `vars.*` directly. Variables must be passed as action inputs.

The workflow passes variables to `setup-environment`, which applies defaults:

```yaml
jobs:
  deploy:
    environment: sandbox  # Variables from this environment
    steps:
      - name: Setup Environment
        id: setup-env
        uses: ./.github/actions/setup-environment
        with:
          aws-region: ${{ vars.AWS_REGION }}
          aws-role-arn: ${{ vars.AWS_ROLE_ARN }}
          # ... other vars

      # Access resolved values via outputs
      - name: Configure AWS
        uses: ./.github/actions/configure-aws
        with:
          role-arn: ${{ steps.setup-env.outputs.aws-role-arn }}
          aws-region: ${{ steps.setup-env.outputs.aws-region }}
```

The action uses bash parameter expansion to apply defaults:

```bash
AWS_REGION="${{ inputs.aws-region }}"
AWS_REGION="${AWS_REGION:-us-east-1}"  # Default if empty
echo "AWS_REGION=${AWS_REGION}" >> $GITHUB_ENV
echo "aws-region=${AWS_REGION}" >> $GITHUB_OUTPUT
```

### Environment Configuration by Target

| Environment | `PROJECT_ENV` | `LOG_LEVEL` | Notes |
|-------------|---------------|-------------|-------|
| sandbox | `sandbox` | `debug` or `trace` | Shared testing |
| development | `development` | `debug` | Validates multi-env deployment |
| production | `production` | `info` | Less verbose logging |

## Step 4: Configure AWS OIDC

Create an IAM role in AWS that trusts GitHub Actions OIDC provider.

### Trust Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
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

### Required Permissions

The role needs permissions for:
- CDK deployment (CloudFormation, IAM, Lambda, etc.)
- Any resources your stack creates

## Step 5: Verify Setup

1. Push to a feature branch to trigger sandbox deployment
2. Merge to main to trigger development deployment
3. Create a version tag to trigger production deployment

```bash
# Test sandbox
git checkout -b feat/test-cicd
git push origin feat/test-cicd

# Test development
git checkout main
git push origin main

# Test production
git tag v0.1.0
git push origin v0.1.0
```

## Customization

### Adding Application Secrets

Pass secrets to the CDK deploy action by extending `cdk-deploy/action.yml`:

```yaml
inputs:
  api-key:
    description: API key for external service
    required: false

# In the Deploy step:
env:
  API_KEY: ${{ inputs.api-key }}
```

Then in workflows:

```yaml
- name: Deploy CDK Stack
  uses: ./.github/actions/cdk-deploy
  with:
    stack-name: AppStack
    api-key: ${{ secrets.API_KEY }}
```

### Adding Framework-Specific Caching

Extend `setup-node-and-cache/action.yml` for framework builds:

```yaml
- name: Cache Next.js build
  id: cache-nextjs
  uses: actions/cache@v4
  with:
    path: packages/nextjs/.next
    key: ${{ runner.os }}-nextjs-${{ hashFiles('packages/nextjs/**/*.ts', 'packages/nextjs/**/*.tsx') }}
```

### Personal Builds

For personal sandbox builds, create `deploy-personal-build.yml`:

```yaml
name: Personal Build

on:
  push:
    branches-ignore:
      - main
      - develop
      - nobuild-*
      - nobuild/*
      - sandbox
      - sandbox-*
      - sandbox/*

concurrency:
  group: deploy-personal-build-${{ github.actor }}
  cancel-in-progress: true

jobs:
  deploy:
    environment: sandbox
    # ... same as sandbox deploy but with PROJECT_ENV set to github.actor
```

## Troubleshooting

### "The environment 'sandbox' does not exist"

The environment must be created in GitHub repository settings before the workflow can reference it. See [Creating an Environment](#creating-an-environment).

### OIDC Authentication Fails / "Unable to assume AWS role"

- Verify `AWS_ROLE_ARN` variable is set correctly in the environment
- Verify the OIDC provider is configured in AWS IAM
- Check the trust policy matches your repository
- Ensure the workflow has `id-token: write` permission
- Verify the role has necessary permissions for CDK deployment

### Cache Miss on Every Build

- Verify `package-lock.json` is committed
- Check cache key patterns match your file structure

### CDK Deployment Fails

- Verify AWS credentials are configured correctly
- Check CDK is bootstrapped in the target account/region: `npx cdk bootstrap`
- If using Datadog, verify `DATADOG_API_KEY_ARN` points to a valid secret
- Verify the AWS role has permissions to access any Secrets Manager secrets
- Review CloudFormation events in the AWS Console for specific errors

### Variables Not Being Applied

- Composite actions cannot access `vars.*` directly
- Verify variables are passed as inputs to `setup-environment`
- Check the environment name in the job matches the GitHub environment name
- Verify variable names match exactly (case-sensitive)
