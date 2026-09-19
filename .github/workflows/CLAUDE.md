# .github/workflows

Six workflow files. All `deploy-env-*.yml` workflows use concurrency groups (by environment name) without `cancel-in-progress`, so queued runs wait rather than abort.

---

## deploy-env-sandbox.yml — Build Stacks to Sandbox

**Triggers:** push to `branch/*`, `claude/*`, `feat/*`, `fix/*`, `sandbox/*`; tags `sandbox-*`

**Path filter:** `workspaces/**`, `.github/actions/**`, `.github/workflows/deploy-env-*.yml`, `.github/workflows/deploy-stack-*.yml`

**Concurrency:** `deploy-env-sandbox`

**Jobs:** `deploy`, `lint`, `test`

- `deploy` has no `needs` — runs immediately with no lint/test gate
- Deploys stacks: `JaypieCicd JaypieDocumentation`
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
- `stacks`: choice — `all`, `JaypieDocumentation`
- `custom_stacks`: free text — overrides `stacks` if provided

`all` resolves to: `JaypieDocumentation`

`JaypieCicd` is not available here — it deploys automatically with sandbox via `deploy-env-sandbox.yml`.

No docs deployment step (unlike `deploy-env-*.yml`).

---

## npm-check.yml — NPM Check

**Triggers:** push to `branch/*`, `claude/*`, `codex/*`, `deps/*`, `devin/*`, `fix/*`, `feat/*`; tags `check-*`

**Jobs:**

| Job | Notes |
|-----|-------|
| `lint` | Node 24 |
| `typecheck` | `continue-on-error: true` |
| `test` | Node 24 (stable) + 25 (experimental, `continue-on-error: true`); passes `MISTRAL_API_KEY` and `LLAMA_CLOUD_API_KEY` so the two OCR hot specs run |
| `build-llm` | Detects changes to `packages/llm/**` via `dorny/paths-filter`; builds and uploads artifact |
| `test-llm-matrix` | Only runs when `packages/llm/**` changed; matrix: `anthropic`, `openai`, `gemini-xai`, `meta`, `fireworks`, `mistral`, `openrouter`, `bedrock`; the `mistral` shard then runs the OCR step |
| `test-llm-matrix-complete` | Aggregator job — fails if any matrix group failed |

**Mistral returned to CI on 2026-09-19.** The shard was dropped on 2026-09-04
after failing on a `Rate limit exceeded` 429 across all seven cells, and on
`This model is not available in your subscription tier` before that, neither of
which says anything about the code under test. The account was upgraded on
2026-09-19 and both cataloged models pass all seven cells, so `mistral` is a
group again in both workflows and `MISTRAL_API_KEY` is passed. Pacing comes
from `test/rateLimit.ts` and the library's rate-limit backoff; if the shard
starts failing on 429s again rather than on the code, drop the group before
chasing the matrix.

**OCR coverage (added 2026-09-19).** `MODEL.MISTRAL.OCR` and
`MODEL.LLAMAPARSE.*` are excluded from the matrix, so two things cover them.
The `test` job passes `CICD_MISTRAL_API_KEY` and `CICD_LLAMA_CLOUD_API_KEY`
(the only provider keys it carries) so the Mistral and LlamaCloud hot specs
run instead of skipping; each includes a fallback simulation from a rejected
id to the real engine. The `mistral` shard runs `npm run test:llm:ocr` after
the matrix (`Run OCR engines and fallback chain`): every native engine, one
emulated engine per chat provider (Anthropic and OpenAI keys), and a
LlamaParse-to-Haiku fallback chain. Same in `npm-deploy.yml`.

**Bedrock two-step role assumption** (matrix group `bedrock`):
1. `configure-aws` with `vars.AWS_ROLE_ARN` (sandbox environment)
2. Query CloudFormation: `aws cloudformation describe-stacks --stack-name jaypie-cicd` for `BedrockCicdRoleArn`
3. `aws-actions/configure-aws-credentials` to assume that Bedrock role

Requires `JaypieCicd` stack deployed.

---

## npm-deploy.yml — NPM Deploy

**Triggers:** push to `main`; tags `deploy-*`, `dev-*`, `rc-*`

**Jobs:** `lint`, `typecheck`, `test`, `deploy`, `build-llm`, `test-llm-matrix`

`deploy` runs independently (no `needs`). Iterates `packages/*/`, skips private packages and already-published versions.

**Tag-based publish targets:**
- `dev-*` tag + version contains `-dev.` → `--tag dev`
- `rc-*` tag + version contains `-rc.` → `--tag rc`
- otherwise → latest (no tag flag)

**test job:** optionally wraps `npm test` with Datadog tracing when `DATADOG_CICD_API_KEY` is set. Passes `MISTRAL_API_KEY` and `LLAMA_CLOUD_API_KEY` so the OCR hot specs run (see npm-check).

**test-llm-matrix:** always runs (no path filter), same matrix groups as npm-check, same OCR step on the `mistral` shard, Bedrock two-step role assumption for `bedrock` group. Owns live-model coverage (the former `test-llm-client` job was retired — its tools+structured "both" scenario is a subset of the matrix's `both` capability, and the matrix now includes each provider's default model).

**Bedrock two-step role assumption** (same pattern as npm-check):
1. `configure-aws` with `vars.AWS_ROLE_ARN` (sandbox environment)
2. Query CloudFormation `jaypie-cicd` stack for `BedrockCicdRoleArn`
3. Assume that role via `aws-actions/configure-aws-credentials`
