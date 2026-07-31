---
description: Reusable composite actions for GitHub Actions workflows
related: cicd, cicd-deploy, cicd-environments
---

# Composite Actions

Jaypie projects use composite actions to share common workflow steps. Place these in `.github/actions/`.

## Directory Structure

```
.github/
├── actions/
│   ├── setup-environment/
│   │   └── action.yml
│   ├── configure-aws/
│   │   └── action.yml
│   ├── setup-node-and-cache/
│   │   └── action.yml
│   ├── npm-install-build/
│   │   └── action.yml
│   ├── cdk-deploy/
│   │   └── action.yml
│   └── web-deploy/
│       └── action.yml
└── workflows/
    ├── deploy-sandbox.yml
    └── deploy-production.yml
```

## setup-environment/action.yml

Sets Jaypie environment variables with bash parameter expansion defaults.

```yaml
name: 'Setup Environment'
description: 'Set environment variables for Jaypie deployment'

inputs:
  project-env:
    description: 'Environment name (sandbox, production)'
    required: false
    default: 'sandbox'
  project-key:
    description: 'Project identifier'
    required: true
  project-sponsor:
    description: 'Sponsor segment of the generated stack name'
    required: true
  project-nonce:
    description: 'Unique resource identifier'
    required: false
    default: ''
  log-level:
    description: 'Log level (trace, debug, info, warn, error)'
    required: false
    default: ''
  project-chaos:
    description: 'Chaos mode (none, partial, full)'
    required: false
    default: ''

outputs:
  project-env:
    description: 'Resolved PROJECT_ENV'
    value: ${{ steps.env.outputs.project-env }}
  project-nonce:
    description: 'Resolved PROJECT_NONCE'
    value: ${{ steps.env.outputs.project-nonce }}
  log-level:
    description: 'Resolved LOG_LEVEL'
    value: ${{ steps.env.outputs.log-level }}
  project-chaos:
    description: 'Resolved PROJECT_CHAOS'
    value: ${{ steps.env.outputs.project-chaos }}

runs:
  using: 'composite'
  steps:
    - name: Set environment variables
      id: env
      shell: bash
      run: |
        # Resolve PROJECT_ENV
        PROJECT_ENV="${{ inputs.project-env }}"
        echo "project-env=${PROJECT_ENV}" >> $GITHUB_OUTPUT
        echo "PROJECT_ENV=${PROJECT_ENV}" >> $GITHUB_ENV

        # Resolve PROJECT_KEY and PROJECT_SPONSOR
        # Both feed the generated stack name; an empty value yields "undefined"
        echo "PROJECT_KEY=${{ inputs.project-key }}" >> $GITHUB_ENV
        echo "PROJECT_SPONSOR=${{ inputs.project-sponsor }}" >> $GITHUB_ENV

        # Resolve PROJECT_NONCE (default: branch name or 'prod')
        NONCE="${{ inputs.project-nonce }}"
        if [ -z "$NONCE" ]; then
          if [ "$PROJECT_ENV" = "production" ]; then
            NONCE="prod"
          else
            NONCE="${GITHUB_REF_NAME//\//-}"
          fi
        fi
        echo "project-nonce=${NONCE}" >> $GITHUB_OUTPUT
        echo "PROJECT_NONCE=${NONCE}" >> $GITHUB_ENV

        # Resolve LOG_LEVEL (default: trace for sandbox, info for production)
        LOG_LEVEL="${{ inputs.log-level }}"
        if [ -z "$LOG_LEVEL" ]; then
          if [ "$PROJECT_ENV" = "production" ]; then
            LOG_LEVEL="info"
          else
            LOG_LEVEL="trace"
          fi
        fi
        echo "log-level=${LOG_LEVEL}" >> $GITHUB_OUTPUT
        echo "LOG_LEVEL=${LOG_LEVEL}" >> $GITHUB_ENV

        # Resolve PROJECT_CHAOS (default: none for production, full for sandbox)
        CHAOS="${{ inputs.project-chaos }}"
        if [ -z "$CHAOS" ]; then
          if [ "$PROJECT_ENV" = "production" ]; then
            CHAOS="none"
          else
            CHAOS="full"
          fi
        fi
        echo "project-chaos=${CHAOS}" >> $GITHUB_OUTPUT
        echo "PROJECT_CHAOS=${CHAOS}" >> $GITHUB_ENV
```

`project-sponsor` is `required: true` on purpose. `PROJECT_SPONSOR` is the first segment of the generated stack name (`cdk-{PROJECT_SPONSOR}-{PROJECT_KEY}-{PROJECT_ENV}-{PROJECT_NONCE}`), and an optional input with an empty default deploys `cdk-undefined-...` silently. A stack name is immutable, so correcting it later means a stack replacement. See `skill("cdk")` for stack naming and `skill("variables")` for the full variable reference.

## configure-aws/action.yml

Configures AWS credentials via OIDC.

```yaml
name: 'Configure AWS'
description: 'Configure AWS credentials via OIDC'

inputs:
  role-arn:
    description: 'AWS IAM Role ARN to assume'
    required: true
  region:
    description: 'AWS region'
    required: false
    default: 'us-east-1'
  role-session-name:
    description: 'Session name for assumed role'
    required: false
    default: 'github-actions'

runs:
  using: 'composite'
  steps:
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v6
      with:
        role-to-assume: ${{ inputs.role-arn }}
        aws-region: ${{ inputs.region }}
        role-session-name: ${{ inputs.role-session-name }}
```

## setup-node-and-cache/action.yml

Sets up Node.js with multi-layer caching.

```yaml
name: 'Setup Node and Cache'
description: 'Setup Node.js with npm caching'

inputs:
  node-version:
    description: 'Node.js version'
    required: false
    default: '24'
  cache-builds:
    description: 'Cache build outputs'
    required: false
    default: 'true'

runs:
  using: 'composite'
  steps:
    - name: Setup Node.js
      uses: actions/setup-node@v6
      with:
        node-version: ${{ inputs.node-version }}
        cache: 'npm'

    - name: Cache node_modules
      uses: actions/cache@v5
      with:
        path: |
          node_modules
          packages/*/node_modules
          workspaces/*/node_modules
        key: ${{ runner.os }}-node-${{ inputs.node-version }}-${{ hashFiles('**/package-lock.json') }}
        restore-keys: |
          ${{ runner.os }}-node-${{ inputs.node-version }}-

    - name: Cache build outputs
      if: inputs.cache-builds == 'true'
      uses: actions/cache@v5
      with:
        path: |
          packages/*/dist
          workspaces/*/dist
          workspaces/*/.open-next
        key: ${{ runner.os }}-build-${{ github.sha }}
        restore-keys: |
          ${{ runner.os }}-build-
```

## npm-install-build/action.yml

Installs dependencies and builds packages.

```yaml
name: 'NPM Install and Build'
description: 'Install npm dependencies and build packages'

inputs:
  install-command:
    description: 'Install command to run'
    required: false
    default: 'npm ci'
  build-command:
    description: 'Build command to run'
    required: false
    default: 'npm run build'
  skip-build:
    description: 'Skip build step'
    required: false
    default: 'false'

runs:
  using: 'composite'
  steps:
    - name: Install dependencies
      shell: bash
      run: ${{ inputs.install-command }}

    - name: Build packages
      if: inputs.skip-build != 'true'
      shell: bash
      run: ${{ inputs.build-command }}
```

## cdk-deploy/action.yml

Deploys CDK stack with proper configuration.

```yaml
name: 'CDK Deploy'
description: 'Deploy CDK stack'

inputs:
  stack-name:
    description: 'CDK stack name or pattern'
    required: true
  working-directory:
    description: 'Working directory for CDK commands'
    required: false
    default: 'workspaces/cdk'
  require-approval:
    description: 'CDK approval mode (never, any-change, broadening)'
    required: false
    default: 'never'
  extra-args:
    description: 'Additional CDK deploy arguments'
    required: false
    default: ''

runs:
  using: 'composite'
  steps:
    - name: Install CDK CLI
      shell: bash
      run: npm install -g aws-cdk

    - name: CDK Deploy
      shell: bash
      working-directory: ${{ inputs.working-directory }}
      run: |
        cdk deploy "${{ inputs.stack-name }}" \
          --require-approval ${{ inputs.require-approval }} \
          --outputs-file cdk-outputs.json \
          ${{ inputs.extra-args }}

    - name: Upload CDK outputs
      uses: actions/upload-artifact@v7
      with:
        name: cdk-outputs
        path: ${{ inputs.working-directory }}/cdk-outputs.json
        if-no-files-found: ignore
```

## web-deploy/action.yml

Ships built web assets to a `JaypieWebDeploymentBucket` and invalidates CloudFront. This is the second half of the deployment model in `skill("web")`: CDK provisions the bucket, distribution, and deploy role, and this action moves the content. Jaypie deliberately avoids `s3deploy.BucketDeployment`, so a project that does not run this step has a bucket with nothing in it.

Run it immediately after `cdk-deploy`, which writes the `cdk-outputs.json` this action reads.

```yaml
name: 'Web Deploy'
description: 'Sync built web assets to the S3 deployment bucket and invalidate CloudFront'

inputs:
  outputs-file:
    description: 'Path to cdk-outputs.json produced by cdk deploy'
    required: false
    default: 'workspaces/cdk/cdk-outputs.json'
  prefix:
    description: 'Output name prefix when exportOutputs({ prefix }) was used (e.g., "App")'
    required: false
    default: ''
  source:
    description: 'Directory of built assets to sync'
    required: false
    default: 'workspaces/web/dist'
  region:
    description: 'AWS region'
    required: false
    default: 'us-east-1'
  role-session-name:
    description: 'Session name for the deploy role'
    required: false
    default: 'github-actions-web-deploy'
  immutable-cache-control:
    description: 'Cache-Control applied to fingerprinted assets'
    required: false
    default: 'public, max-age=31536000, immutable'
  document-cache-control:
    description: 'Cache-Control applied to HTML documents'
    required: false
    default: 'public, max-age=0, must-revalidate'
  invalidation-paths:
    description: 'Space-separated CloudFront invalidation paths'
    required: false
    default: '/*'

outputs:
  bucket:
    description: 'Destination bucket name'
    value: ${{ steps.resolve.outputs.bucket }}
  distribution-id:
    description: 'CloudFront distribution id'
    value: ${{ steps.resolve.outputs.distribution-id }}
  invalidation-id:
    description: 'CloudFront invalidation id'
    value: ${{ steps.invalidate.outputs.invalidation-id }}

runs:
  using: 'composite'
  steps:
    - name: Resolve stack outputs
      id: resolve
      shell: bash
      run: |
        set -euo pipefail
        FILE="${{ inputs.outputs-file }}"
        PREFIX="${{ inputs.prefix }}"
        if [ ! -f "$FILE" ]; then
          echo "::error::CDK outputs file not found: $FILE"
          exit 1
        fi

        read_output() {
          jq -re --arg key "${PREFIX}$1" \
            'to_entries | map(.value) | add | .[$key] // empty' "$FILE"
        }

        BUCKET="$(read_output DestinationBucketName)" || {
          echo "::error::${PREFIX}DestinationBucketName missing from $FILE (did the stack call exportOutputs()?)"
          exit 1
        }
        ROLE_ARN="$(read_output DestinationBucketDeployRoleArn)" || {
          echo "::error::${PREFIX}DestinationBucketDeployRoleArn missing from $FILE (is CDK_ENV_REPO set at synth time?)"
          exit 1
        }
        DISTRIBUTION_ID="$(read_output DistributionId)" || DISTRIBUTION_ID=""

        echo "bucket=${BUCKET}" >> $GITHUB_OUTPUT
        echo "role-arn=${ROLE_ARN}" >> $GITHUB_OUTPUT
        echo "distribution-id=${DISTRIBUTION_ID}" >> $GITHUB_OUTPUT

    - name: Assume deploy role
      uses: aws-actions/configure-aws-credentials@v6
      with:
        role-to-assume: ${{ steps.resolve.outputs.role-arn }}
        aws-region: ${{ inputs.region }}
        role-session-name: ${{ inputs.role-session-name }}

    - name: Sync assets
      shell: bash
      run: |
        set -euo pipefail
        SOURCE="${{ inputs.source }}"
        BUCKET="${{ steps.resolve.outputs.bucket }}"
        if [ ! -d "$SOURCE" ]; then
          echo "::error::Source directory not found: $SOURCE"
          exit 1
        fi

        # Fingerprinted assets first so documents never reference missing files
        aws s3 sync "$SOURCE" "s3://${BUCKET}" \
          --delete \
          --exclude "*.html" --exclude "*.json" --exclude "*.xml" --exclude "*.txt" \
          --cache-control "${{ inputs.immutable-cache-control }}"

        # Documents last, revalidated on every request
        aws s3 sync "$SOURCE" "s3://${BUCKET}" \
          --delete \
          --exclude "*" \
          --include "*.html" --include "*.json" --include "*.xml" --include "*.txt" \
          --cache-control "${{ inputs.document-cache-control }}"

    - name: Invalidate CloudFront
      id: invalidate
      if: steps.resolve.outputs.distribution-id != ''
      shell: bash
      run: |
        set -euo pipefail
        INVALIDATION_ID="$(aws cloudfront create-invalidation \
          --distribution-id "${{ steps.resolve.outputs.distribution-id }}" \
          --paths ${{ inputs.invalidation-paths }} \
          --query 'Invalidation.Id' \
          --output text)"
        echo "invalidation-id=${INVALIDATION_ID}" >> $GITHUB_OUTPUT
```

Notes:

- The `jq` expression is stack-name agnostic. `cdk-outputs.json` is keyed by the resolved stack name, so the expression flattens one level and reads the flat key. No workflow needs to know the generated stack name.
- `jq -re` exits nonzero on a missing key, which drives the explicit error messages.
- `prefix` covers stacks with more than one bucket, matching `exportOutputs({ prefix })`.
- Both sync passes use `--delete`. `--delete` respects the same include/exclude filters, so the asset pass does not remove documents and the document pass does not remove assets.
- Assets upload before documents so a freshly published document never references an asset that has not landed.
- The deploy job needs `permissions: id-token: write`. This action performs a fresh OIDC exchange rather than chaining from the `configure-aws` credentials, which matches the trust policy the construct writes.

## Using Composite Actions

Reference actions in workflows:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: sandbox
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v6

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
          stack-name: 'my-stack-*'
```

## Customization

Override defaults as needed:

```yaml
- uses: ./.github/actions/setup-environment
  with:
    project-key: my-project
    project-env: production
    log-level: warn
    project-chaos: none
```
