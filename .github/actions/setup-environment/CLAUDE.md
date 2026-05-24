# setup-environment

Composite action that maps GitHub vars/secrets to environment variables for CDK deployments.

## Inputs

Inputs mirror GitHub Settings scopes (org, repo, env):

**Org-level:**
- `aws-region` (default: `us-east-1`)
- `log-level` (default: `debug`)
- `module-log-level` (default: `warn`)
- `project-sponsor` (default: `finlaysonstudio`)

**Repo-level:**
- `aws-hosted-zone` (default: `jaypie.net`)
- `project-key` (default: `jaypie`)
- `project-service` (default: `workspaces`)

**Env-level:**
- `aws-role-arn`
- `datadog-api-key-arn`
- `project-env` (default: `sandbox`)
- `project-nonce` (random 8-char hex if not set)

## Derived Values

Set automatically, not passed as inputs:

- `CDK_DEFAULT_ACCOUNT` — extracted from `aws-role-arn` (5th colon-delimited field)
- `PROJECT_VERSION` — from `package.json` via `node -p`
- `PROJECT_COMMIT` — from `github.sha`
- `CDK_ENV_REPO` — from `github.repository`

## Outputs

- `aws-region`
- `aws-role-arn`
- `project-env`

## Environment Variables Set

`AWS_REGION`, `AWS_ROLE_ARN`, `CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION`, `CDK_ENV_DATADOG_API_KEY_ARN`, `CDK_ENV_HOSTED_ZONE`, `CDK_ENV_REPO`, `LOG_LEVEL`, `MODULE_LOG_LEVEL`, `PROJECT_COMMIT`, `PROJECT_ENV`, `PROJECT_KEY`, `PROJECT_NONCE`, `PROJECT_SERVICE`, `PROJECT_SPONSOR`, `PROJECT_VERSION`
