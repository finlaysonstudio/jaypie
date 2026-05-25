# .github — GitHub Actions

Composite actions in `actions/` and workflows in `workflows/`. See subdirectory CLAUDEs for detail.

## Structure

```
.github/
├── actions/           # Reusable composite actions — see actions/CLAUDE.md
│   ├── cdk-deploy/
│   ├── configure-aws/
│   ├── npm-install-build/
│   ├── setup-environment/
│   └── setup-node-and-cache/
└── workflows/         # CI/CD workflows — see workflows/CLAUDE.md
    ├── deploy-env-development.yml
    ├── deploy-env-production.yml
    ├── deploy-env-sandbox.yml
    ├── deploy-stacks.yml
    ├── npm-check.yml
    └── npm-deploy.yml
```

## IAM Bootstrap Prerequisite

Workflows authenticate via OIDC using `configure-aws`, which assumes the role ARN in `AWS_ROLE_ARN`. Those roles are provisioned by the `JaypieCicd` CDK stack (`workspaces/cdk/lib/cicd-stack.ts`).

**Deploy `JaypieCicd` first** in any new AWS account via Actions → "Deploy Stacks (Manual)". It is not included in `all` and is not triggered automatically.

## Adding a New IAM Role for CI/CD

1. Add the role to `workspaces/cdk/lib/cicd-stack.ts`
2. Export its ARN as a `CfnOutput`
3. Set the ARN as a GitHub environment variable in the relevant environment
4. Manually deploy `JaypieCicd` via `deploy-stacks.yml`
