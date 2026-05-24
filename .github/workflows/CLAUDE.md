# .github/workflows

Six workflow files. All `deploy-env-*.yml` workflows use concurrency groups (by environment name) without `cancel-in-progress`, so queued runs wait rather than abort.

---

## deploy-env-sandbox.yml — Build Stacks to Sandbox

**Triggers:** push to `branch/*`, `claude/*`, `feat/*`, `fix/*`, `sandbox/*`; tags `sandbox-*`

**Path filter:** `workspaces/**`, `.github/actions/**`, `.github/workflows/deploy-env-*.yml`, `.github/workflows/deploy-stack-*.yml`

**Concurrency:** `deploy-env-sandbox`

**Jobs:** `deploy`, `lint`, `test`

- `deploy` has no `needs` — runs immediately with no lint/test gate
- Deploys stacks: `JaypieCicd JaypieDocumentation JaypieGardenData JaypieGardenApi JaypieGardenNextjs`
- `JaypieCicd` only deploys here — not in development or production workflows
- Builds docs site (`npm run docs:build`), queries CloudFormation for bucket/role/distribution outputs, assumes `DeployRoleArn`, syncs to S3, invalidates CloudFront

---

## deploy-env-development.yml — Build Stacks to Development

**Triggers:** push to `main`, `development/*`; tags `development-*`

**Path filter:** same as sandbox

**Concurrency:** `deploy-env-development`

**Jobs:** `lint`, `test`, `deploy`

- `deploy` requires `needs: [lint, test]`
- Same stacks and docs deployment as sandbox

---

## deploy-env-production.yml — Build Stacks to Production

**Triggers:** push to `main` (path filter: `workspaces/**`); `workflow_dispatch`

**Concurrency:** `deploy-env-production`

**Jobs:** `lint`, `test`, `deploy`

- `deploy` uses `if: always() && needs.lint.result == 'success' && needs.test.result == 'success'`
- Logs version number from `package.json` at deploy time via `::notice::`
- Same stacks and docs deployment as sandbox/development

---

## deploy-stacks.yml — Deploy Stacks (Manual)

**Triggers:** `workflow_dispatch` only

**Concurrency:** `deploy-stacks-${{ github.event.inputs.environment }}`

**Inputs:**
- `environment`: choice — `sandbox` / `development` / `production` (default: `sandbox`)
- `stacks`: choice — `all`, `JaypieDocumentation`, `JaypieGardenApi`, `JaypieGardenNextjs`, `JaypieGardenData`, `JaypieGardenApi JaypieGardenNextjs`, `JaypieGardenData JaypieGardenApi JaypieGardenNextjs`
- `custom_stacks`: free text — overrides `stacks` if provided

`all` resolves to: `JaypieDocumentation JaypieGardenData JaypieGardenApi JaypieGardenNextjs`

`JaypieCicd` is not available here — it deploys automatically with sandbox via `deploy-env-sandbox.yml`.

No docs deployment step (unlike `deploy-env-*.yml`).

---

## npm-check.yml — NPM Check

**Triggers:** push to `branch/*`, `claude/*`, `codex/*`, `devin/*`, `fix/*`, `feat/*`; tags `check-*`

**Jobs:**

| Job | Notes |
|-----|-------|
| `lint` | Node 24 |
| `typecheck` | `continue-on-error: true` |
| `test` | Node 24 (stable) + 25 (experimental, `continue-on-error: true`) |
| `build-llm` | Detects changes to `packages/llm/**` via `dorny/paths-filter`; builds and uploads artifact |
| `test-llm-matrix` | Only runs when `packages/llm/**` changed; matrix: `anthropic`, `openai`, `gemini-xai`, `openrouter`, `bedrock` |
| `test-llm-matrix-complete` | Aggregator job — fails if any matrix group failed |

**Bedrock two-step role assumption** (matrix group `bedrock`):
1. `configure-aws` with `vars.AWS_ROLE_ARN` (sandbox environment)
2. Query CloudFormation: `aws cloudformation describe-stacks --stack-name jaypie-cicd` for `BedrockCicdRoleArn`
3. `aws-actions/configure-aws-credentials` to assume that Bedrock role

Requires `JaypieCicd` stack deployed.

---

## npm-deploy.yml — NPM Deploy

**Triggers:** push to `main`; tags `deploy-*`, `dev-*`, `rc-*`

**Jobs:** `lint`, `typecheck`, `test`, `deploy`, `build-llm`, `test-llm-client`, `test-llm-matrix`

`deploy` runs independently (no `needs`). Iterates `packages/*/`, skips private packages and already-published versions.

**Tag-based publish targets:**
- `dev-*` tag + version contains `-dev.` → `--tag dev`
- `rc-*` tag + version contains `-rc.` → `--tag rc`
- otherwise → latest (no tag flag)

**test job:** optionally wraps `npm test` with Datadog tracing when `DATADOG_CICD_API_KEY` is set.

**test-llm-client:** always runs (no path filter), uses sandbox environment, Bedrock two-step role assumption.

**test-llm-matrix:** always runs (no path filter), same matrix groups as npm-check, Bedrock two-step role assumption for `bedrock` group.

**Bedrock two-step role assumption** (same pattern as npm-check):
1. `configure-aws` with `vars.AWS_ROLE_ARN` (sandbox environment)
2. Query CloudFormation `jaypie-cicd` stack for `BedrockCicdRoleArn`
3. Assume that role via `aws-actions/configure-aws-credentials`
