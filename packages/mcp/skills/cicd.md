---
description: GitHub Actions CI/CD workflows
related: cicd-actions, cicd-deploy, cicd-environments, cdk, tests
---

# CI/CD with GitHub Actions

Jaypie projects use GitHub Actions for continuous integration and deployment.

## Sub-Skills

| Skill | Description |
|-------|-------------|
| `cicd-actions` | Reusable composite actions for workflows |
| `cicd-deploy` | CDK deployment workflows (sandbox, production) |
| `cicd-environments` | GitHub Environments configuration |

## Standard Workflows

### npm-check.yml

Runs on feature branches (`feat/*`, `fix/*`, `devin/*`):

```yaml
name: npm-check

on:
  push:
    branches:
      - 'feat/*'
      - 'fix/*'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm ci
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22, 24, 25]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm run build
      - run: npm test
```

### npm-deploy.yml

Runs on `main` branch and release tags:

```yaml
name: npm-deploy

on:
  push:
    branches: [main]
    tags:
      - 'deploy-*'
      - 'rc-*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Branch Strategy

| Branch Pattern | Purpose | Triggers |
|---------------|---------|----------|
| `main` | Production releases | npm-deploy |
| `feat/*` | Feature development | npm-check |
| `fix/*` | Bug fixes | npm-check |
| `rc-*` tags | Release candidates | npm-deploy (--tag rc) |

## Testing Matrix

Test across multiple Node.js versions:

```yaml
strategy:
  matrix:
    node-version: [22, 24, 25]
```

## Secrets Configuration

Required repository secrets:

| Secret | Purpose |
|--------|---------|
| `NPM_TOKEN` | npm publish authentication |
| `DATADOG_API_KEY` | Optional: Test tracing |

## Workflow Tips

### Skip Already-Published Versions

```yaml
- run: |
    CURRENT=$(npm view ${{ github.repository }} version 2>/dev/null || echo "0.0.0")
    LOCAL=$(node -p "require('./package.json').version")
    if [ "$CURRENT" = "$LOCAL" ]; then
      echo "Version already published, skipping"
      exit 0
    fi
    npm publish --provenance
```

### Conditional Job Execution

Run jobs only when specific files change:

```yaml
- uses: dorny/paths-filter@v2
  id: changes
  with:
    filters: |
      src:
        - 'packages/llm/**'

- run: npm test -w packages/llm
  if: steps.changes.outputs.src == 'true'
```

