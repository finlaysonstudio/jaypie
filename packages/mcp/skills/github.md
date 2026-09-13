---
description: GitHub repository standard for branch rulesets, environments, and layered secrets and variables
related: cicd, cicd-actions, cicd-deploy, cicd-environments, secrets, variables
---

# GitHub Repository Standard

Configuration for a Jaypie repository on GitHub. Values are layered in three scopes:

| Scope | Holds |
|-------|-------|
| Organization | Values shared by every repository: region, sponsor, log levels, per-account AWS references, CI credentials, shared integrations |
| Repository | Project identity and defaults for the lower environments |
| Environment | Per-environment deployment targets and overrides, most heavily in production-class environments |

Resolution order for `vars.*` and `secrets.*` is **environment → repository → organization**. A name defined at a narrower scope shadows the broader one for any job that targets that environment. Jobs with no `environment:` resolve repository, then organization.

## Repository Settings

| Setting | Value |
|---------|-------|
| Default branch | `main` |
| Merge methods | merge, squash, and rebase allowed |
| Delete branch on merge | off |
| Auto-merge | off |
| Allowed actions | all |

## Branch Protection

Protect `main` with a repository ruleset named `main`.

| Field | Value |
|-------|-------|
| Target | `branch` |
| Enforcement | `active` |
| Include | `~DEFAULT_BRANCH`, `refs/heads/main` |
| Bypass actors | Organization admins and the repository admin role (`RepositoryRole` 5), or a development team, `always` |

| Rule | Setting |
|------|---------|
| `deletion` | blocked |
| `non_fast_forward` | blocked |
| `pull_request` | required; stale reviews dismissed on push; extra approval for unattributed changes |
| `required_status_checks` | job names from the check workflow; strict (branch up to date) |

Required status check contexts are the `name:` of jobs in the check workflow. Matrix jobs append the matrix value (`Test (24)`).

```json
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["~DEFAULT_BRANCH", "refs/heads/main"], "exclude": [] }
  },
  "bypass_actors": [
    { "actor_id": null, "actor_type": "OrganizationAdmin", "bypass_mode": "always" },
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "allowed_merge_methods": ["merge", "squash", "rebase"],
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_extra_approval_for_unattributed_changes": true,
        "require_last_push_approval": false,
        "required_approving_review_count": 0,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "do_not_enforce_on_create": false,
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "Lint", "integration_id": 15368 },
          { "context": "Typecheck", "integration_id": 15368 },
          { "context": "Test (24)", "integration_id": 15368 }
        ]
      }
    }
  ]
}
```

`integration_id` 15368 is GitHub Actions.

```bash
gh api repos/<org>/<repo>/rulesets --method POST --input ruleset.json
gh api repos/<org>/<repo>/rules/branches/main   # effective rules, including org rulesets
```

## Environments

Environment names are lowercase and match `PROJECT_ENV`.

| Environment | Class | Protection | Deployment refs |
|-------------|-------|------------|-----------------|
| `sandbox` | lower | none | any branch or tag |
| `development` | lower | none | any branch or tag |
| `test` | production-class | branch policy | custom |
| `demo` | production-class | branch policy | `branch/*`, `feat/*`, `fix/*`, `main`; tags `demo-*`, `v0.*`, `v1.*` |
| `production` | production-class | branch policy | `main`; tags `production-*`, `v0.*`, `v1.*.*` |

Production may instead use the "protected branches only" policy (`protected_branches: true`), which admits `main` through its ruleset.

```bash
# Custom deployment policy
gh api repos/<org>/<repo>/environments/production --method PUT \
  -F "deployment_branch_policy[protected_branches]=false" \
  -F "deployment_branch_policy[custom_branch_policies]=true"
gh api repos/<org>/<repo>/environments/production/deployment-branch-policies \
  --method POST -f name=main -f type=branch
gh api repos/<org>/<repo>/environments/production/deployment-branch-policies \
  --method POST -f name='production-*' -f type=tag
```

## Organization

Values every repository can assume.

### Variables

| Variable | Example | Purpose |
|----------|---------|---------|
| `AWS_REGION` | `us-east-1` | Deployment region |
| `LOG_LEVEL` | `trace` | Application log level default |
| `MODULE_LOG_LEVEL` | `warn` | Dependency log level default |
| `PROJECT_SPONSOR` | `<org>` | Sponsor segment of stack names |
| `ACCOUNT_AWS_ROLE_ARN` | sandbox account role | Default account deploy role |
| `ACCOUNT_DATADOG_API_KEY_ARN` | sandbox account secret | Default account Datadog key secret |
| `ACCOUNT_<ENV>_AWS_ROLE_ARN` | per-account role | Deploy role for the account hosting `<ENV>` |
| `ACCOUNT_<ENV>_DATADOG_API_KEY_ARN` | per-account secret | Datadog key secret in the account hosting `<ENV>` |
| `ACCOUNT_<ENV>_<SERVICE>_*` | `ACCOUNT_DEVELOPMENT_AUTH0_DOMAIN` | Other per-account references |
| Shared public identifiers | `HUBSPOT_PORTAL_ID`, `SLACK_TEAM_ID`, `CLOUDFLARE_TURNSTILE_SITE` | Integrations common to the organization |

`ACCOUNT_*` variables are the organization record of each AWS account. `<ENV>` is `SANDBOX`, `DEVELOPMENT`, `TEST`, `DEMO`, or `PRODUCTION`; environments sharing an account carry the same values. Unprefixed `ACCOUNT_*` values point at the sandbox account.

### Secrets

| Secret | Purpose |
|--------|---------|
| `CICD_<PROVIDER>_API_KEY` | LLM provider keys for CI test jobs (`CICD_ANTHROPIC_API_KEY`, `CICD_OPENAI_API_KEY`, ...) |
| `DATADOG_CICD_API_KEY`, `DATADOG_CICD_APP_KEY` | Datadog CI visibility |
| `NPM_TOKEN` | Private package install |
| `SLACK_WEBHOOK_<CHANNEL>` | Notification channels (`SLACK_WEBHOOK_NONPRODUCTION_DEPLOYMENT`, `SLACK_WEBHOOK_PRODUCTION_DEPLOYMENT`) |
| Shared service credentials | Licenses and tokens used across repositories (`NUXT_UI_PRO_LICENSE`, `POSTMAN_API_KEY`, `SLACK_BOT_TOKEN`) |

The `CICD_` prefix separates keys consumed by CI from runtime keys deployed into applications (`ANTHROPIC_API_KEY`).

## Repository

Project identity and the defaults that lower environments inherit.

### Variables

| Variable | Example | Purpose |
|----------|---------|---------|
| `PROJECT_KEY` | `mockpay` | Project identifier |
| `PROJECT_SERVICE` | `mockpay` | Service identifier |
| `AWS_HOSTED_ZONE` | `example.com` | Apex zone |
| `AWS_SUBDOMAIN` | `evaluations` | Subdomain within the zone |
| Lower-environment service config | `AUTH0_CLIENT_ID`, `AUTH0_DOMAIN` | Development tenant used unless an environment overrides |
| Public client identifiers | `DATADOG_APPLICATION_ID`, `DATADOG_CLIENT_TOKEN`, Turnstile site keys | Browser-exposed values |
| Feature flags | `LLM_EXCHANGE_ENABLED` | Project-wide toggles |

A repository variable may shadow an organization default for the whole project (`MODULE_LOG_LEVEL`).

### Secrets

| Secret | Purpose |
|--------|---------|
| Lower-environment service secrets | `AUTH0_CLIENT_SECRET` for the development tenant |
| Project integration credentials | Third-party keys specific to the project |

## Environment

Deployment targets live on every environment. Overrides concentrate on production-class environments.

### Variables on Every Environment

| Variable | Example | Purpose |
|----------|---------|---------|
| `AWS_ROLE_ARN` | `ACCOUNT_<ENV>_AWS_ROLE_ARN` value | OIDC deploy role |
| `DATADOG_API_KEY_ARN` | `ACCOUNT_<ENV>_DATADOG_API_KEY_ARN` value | Datadog key secret in the target account |
| `PROJECT_ENV` | `production` | Environment identifier; matches the environment name |
| `PROJECT_NONCE` | `ba342b91` | 8 hex characters, unique per environment |

Workflows may also read `vars.ACCOUNT_<ENV>_AWS_ROLE_ARN` from the organization directly in a workflow-level `env:` block, one workflow per environment.

### Overrides

| Override | Scope | Example |
|----------|-------|---------|
| Service tenant | production-class | `AUTH0_CLIENT_ID`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_SECRET` for the production tenant |
| Hosted zone | per environment | `AWS_HOSTED_ZONE` = `sandbox.example.com` |
| Runtime keys | production | `ANTHROPIC_API_KEY` shadowing the repository key |
| Environment-only resources | per environment | Additional role ARNs, bastion IDs, vendor endpoints |

## Values in Secrets or Variables

| Kind | Scope type |
|------|------------|
| Credentials, signing keys, private keys | secret |
| AWS ARNs, including Secrets Manager ARNs | variable |
| Public client identifiers (Auth0 client ID, Datadog RUM client token, Turnstile site key) | variable |
| Secret material the application reads at runtime | AWS Secrets Manager, referenced by a `*_ARN` variable |

## Workflows

### Environment Selection

| Pattern | Shape |
|---------|-------|
| One workflow per environment | `deploy-env-<env>.yml` with literal `environment: <env>` |
| Reusable deploy | `deploy.yml` on `workflow_call` with `environment: ${{ inputs.environment }}`; callers pass `secrets: inherit` |
| Manual | `workflow_dispatch` with a `choice` input listing environments |

### Triggers

| Environment | Branches | Tags |
|-------------|----------|------|
| `sandbox` | `branch/*`, `claude/*`, `feat/*`, `fix/*`, `sandbox/*` | `sandbox-*` |
| `development` | `main`, `development/*` | `development-*` |
| `production` | `main` | `production-*` |

Deploy workflows set `concurrency: deploy-env-<env>` with `cancel-in-progress: false`. Production deploy jobs declare `needs: [lint, test]`.

### Deploy Job

```yaml
jobs:
  deploy:
    environment: production
    permissions:
      contents: read
      id-token: write
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/setup-environment
        with:
          aws-region: ${{ vars.AWS_REGION }}
          hosted-zone: ${{ vars.AWS_HOSTED_ZONE }}
          log-level: ${{ vars.LOG_LEVEL }}
          module-log-level: ${{ vars.MODULE_LOG_LEVEL }}
          project-env: ${{ vars.PROJECT_ENV }}
          project-key: ${{ vars.PROJECT_KEY }}
          project-nonce: ${{ vars.PROJECT_NONCE }}
          project-sponsor: ${{ vars.PROJECT_SPONSOR }}
      - uses: ./.github/actions/configure-aws
        with:
          aws-region: ${{ vars.AWS_REGION }}
          role-arn: ${{ vars.AWS_ROLE_ARN }}
```

- Deploy jobs declare `permissions` with `contents: read` and `id-token: write`
- Composite actions under `.github/actions` receive every value through `inputs` and never reference `vars.*` or `secrets.*`
- `setup-environment` supplies fallback defaults when an input is empty
- The OIDC subject for an environment job is `repo:<org>/<repo>:environment:<env>` (see ~cicd-environments for the trust policy)

## Audit

```bash
gh api repos/<org>/<repo>/rulesets
gh api repos/<org>/<repo>/environments --jq '.environments[]|{name,protection_rules,deployment_branch_policy}'
gh api repos/<org>/<repo>/environments/<env>/deployment-branch-policies
gh api repos/<org>/<repo>/actions/variables
gh api repos/<org>/<repo>/actions/secrets
gh api repos/<org>/<repo>/environments/<env>/variables
gh api repos/<org>/<repo>/environments/<env>/secrets
gh api "repos/<org>/<repo>/actions/organization-variables?per_page=100"
gh api "repos/<org>/<repo>/actions/organization-secrets?per_page=100"
```

Organization-scoped listings (`orgs/<org>/actions/*`, `orgs/<org>/rulesets`) require the `admin:org` token scope. The `repos/.../organization-*` endpoints list what the repository can read without it and paginate at 10.
