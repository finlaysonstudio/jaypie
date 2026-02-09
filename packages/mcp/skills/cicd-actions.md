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
│   └── cdk-deploy/
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

        # Resolve PROJECT_KEY
        echo "PROJECT_KEY=${{ inputs.project-key }}" >> $GITHUB_ENV

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
      uses: aws-actions/configure-aws-credentials@v4
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
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: 'npm'

    - name: Cache node_modules
      uses: actions/cache@v4
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
      uses: actions/cache@v4
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
      uses: actions/upload-artifact@v4
      with:
        name: cdk-outputs
        path: ${{ inputs.working-directory }}/cdk-outputs.json
        if-no-files-found: ignore
```

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
