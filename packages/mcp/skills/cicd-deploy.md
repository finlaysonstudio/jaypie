---
description: CDK deployment workflows for sandbox and production
related: cicd, cicd-actions, cicd-environments, cdk
---

# CDK Deployment Workflows

Complete workflow templates for deploying CDK stacks to sandbox and production environments.

## deploy-sandbox.yml

Deploys to sandbox on feature branches and main.

```yaml
name: deploy-sandbox

on:
  push:
    branches:
      - main
      - 'feat/*'
      - 'fix/*'
      - 'sandbox/*'

concurrency:
  group: deploy-sandbox-${{ github.ref_name }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-and-cache
      - uses: ./.github/actions/npm-install-build
        with:
          skip-build: 'true'
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-and-cache
      - uses: ./.github/actions/npm-install-build
        with:
          skip-build: 'true'
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22, 24, 25]
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-and-cache
        with:
          node-version: ${{ matrix.node-version }}
      - uses: ./.github/actions/npm-install-build
      - run: npm test

  deploy:
    needs: [lint, typecheck, test]
    runs-on: ubuntu-latest
    environment: sandbox
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: ./.github/actions/setup-environment
        with:
          project-key: my-project
          project-env: sandbox

      - uses: ./.github/actions/configure-aws
        with:
          role-arn: ${{ vars.AWS_ROLE_ARN }}
          region: ${{ vars.AWS_REGION || 'us-east-1' }}

      - uses: ./.github/actions/setup-node-and-cache

      - uses: ./.github/actions/npm-install-build

      - uses: ./.github/actions/cdk-deploy
        with:
          stack-name: '*-sandbox-*'
```

## deploy-production.yml

Deploys to production on release tags.

```yaml
name: deploy-production

on:
  push:
    tags:
      - 'production-*'
      - 'v0.*'
      - 'v1.*'
      - 'v2.*'

concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-and-cache
      - uses: ./.github/actions/npm-install-build
        with:
          skip-build: 'true'
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-and-cache
      - uses: ./.github/actions/npm-install-build
        with:
          skip-build: 'true'
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22, 24, 25]
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-node-and-cache
        with:
          node-version: ${{ matrix.node-version }}
      - uses: ./.github/actions/npm-install-build
      - run: npm test

  deploy:
    needs: [lint, typecheck, test]
    runs-on: ubuntu-latest
    environment: production
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: ./.github/actions/setup-environment
        with:
          project-key: my-project
          project-env: production

      - uses: ./.github/actions/configure-aws
        with:
          role-arn: ${{ vars.AWS_ROLE_ARN }}
          region: ${{ vars.AWS_REGION || 'us-east-1' }}

      - uses: ./.github/actions/setup-node-and-cache

      - uses: ./.github/actions/npm-install-build

      - uses: ./.github/actions/cdk-deploy
        with:
          stack-name: '*-production-*'
```

## version.yml

Manually trigger version bumps across packages.

```yaml
name: version

on:
  workflow_dispatch:
    inputs:
      version_type:
        description: 'Version bump type'
        required: true
        type: choice
        options:
          - patch
          - minor
          - major
      packages:
        description: 'Packages to version (comma-separated, or "all")'
        required: false
        default: 'all'

jobs:
  version:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: ./.github/actions/setup-node-and-cache

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Bump versions
        run: |
          PACKAGES="${{ github.event.inputs.packages }}"
          VERSION_TYPE="${{ github.event.inputs.version_type }}"

          if [ "$PACKAGES" = "all" ]; then
            # Bump all packages in packages/ directory
            for pkg in packages/*/package.json; do
              dir=$(dirname "$pkg")
              echo "Bumping $dir"
              npm version $VERSION_TYPE --workspace "$dir" --no-git-tag-version
            done
          else
            # Bump specific packages
            IFS=',' read -ra PKG_ARRAY <<< "$PACKAGES"
            for pkg in "${PKG_ARRAY[@]}"; do
              pkg=$(echo "$pkg" | xargs)  # trim whitespace
              echo "Bumping packages/$pkg"
              npm version $VERSION_TYPE --workspace "packages/$pkg" --no-git-tag-version
            done
          fi

      - name: Update package-lock.json
        run: npm i --package-lock-only

      - name: Commit and push
        run: |
          git add .
          git commit -m "chore: bump versions (${{ github.event.inputs.version_type }})"
          git push
```

## Environment-Specific Stack Naming

Use consistent stack naming with environment and nonce:

```typescript
// workspaces/cdk/src/app.ts
const env = process.env.PROJECT_ENV || "sandbox";
const nonce = process.env.PROJECT_NONCE || "dev";

new ApiStack(app, `api-${env}-${nonce}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
```

This produces stack names like:
- `api-sandbox-feat-new-feature`
- `api-sandbox-main`
- `api-production-prod`

## Deployment Flow

### Sandbox Flow

```
feat/branch → push → lint/test → deploy → sandbox stack
      ↓
main branch → push → lint/test → deploy → sandbox stack
```

### Production Flow

```
main branch → tag v1.0.0 → push → lint/test → deploy → production stack
                                      ↓
                            (requires approval)
```

## Adding Approval Gates

For production, add required reviewers in GitHub Environment settings:

1. Go to **Settings** → **Environments** → **production**
2. Enable **Required reviewers**
3. Add team members who can approve deployments

## Notifications

Add Slack notifications on deploy:

```yaml
- name: Notify Slack
  if: success()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "Deployed ${{ github.repository }} to ${{ vars.PROJECT_ENV }}",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Deployment Complete*\nRepo: ${{ github.repository }}\nEnv: ${{ vars.PROJECT_ENV }}\nRef: ${{ github.ref_name }}"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Rollback Strategy

For quick rollbacks, use git tags:

```bash
# Tag current production state before deploying
git tag production-backup-$(date +%Y%m%d)

# If rollback needed, push previous tag
git push origin production-backup-20250131:refs/tags/production-rollback
```

This triggers the production workflow with the previous code.
