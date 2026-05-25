# configure-aws

Composite action that authenticates with AWS via OIDC.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `role-arn` | yes | — | IAM role ARN to assume |
| `aws-region` | no | `us-east-1` | AWS region |
| `role-session-name` | no | `DeployRoleForGitHubSession` | Role session name |

## How It Works

Wraps `aws-actions/configure-aws-credentials@v6`. The `role-arn` value comes from the `AWS_ROLE_ARN` GitHub environment variable, set by the `setup-environment` action.

## IAM Role Provisioning

The roles assumed here are provisioned by the `JaypieCicd` CDK stack (`workspaces/cdk/lib/cicd-stack.ts`). That stack must be deployed first in any new AWS account before workflows using this action will succeed.

## Bedrock Two-Step Assumption

Bedrock integration test workflows use a two-step role assumption:

1. Assume `AWS_ROLE_ARN` via this action
2. Query the CloudFormation `jaypie-cicd` stack for `BedrockCicdRoleArn`
3. Assume that role directly via `aws-actions/configure-aws-credentials`
