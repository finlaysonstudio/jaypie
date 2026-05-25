# GitHub Composite Actions

| Action | Purpose | Required Inputs |
|---|---|---|
| `setup-environment` | Maps GitHub vars to env vars with defaults; outputs `aws-region` and `aws-role-arn` | GitHub Settings vars |
| `configure-aws` | OIDC role assumption; roles provisioned by `JaypieCicd` CDK stack — see `configure-aws/CLAUDE.md` | `role-arn` (from `AWS_ROLE_ARN`) |
| `setup-node-and-cache` | Checkout + Node.js + node_modules cache; includes checkout — no prior checkout step needed | none |
| `npm-install-build` | `npm ci` + `npm run build` | none |
| `cdk-deploy` | Builds CDK with content-hash cache, deploys named stacks; default `cdk-package-path` is `packages/cdk` but jaypie uses `workspaces/cdk` | `stack-name` |

## Typical Workflow Order

1. `setup-environment` — provides outputs consumed by `configure-aws`
2. `configure-aws` — consumes `aws-region` and `aws-role-arn` from step 1
3. `setup-node-and-cache` — handles checkout
4. `npm-install-build`
5. `cdk-deploy`
