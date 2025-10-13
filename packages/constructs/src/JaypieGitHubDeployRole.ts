import { CfnOutput, Duration, Fn, Stack, Tags } from "aws-cdk-lib";
import {
  Effect,
  FederatedPrincipal,
  PolicyStatement,
  Role,
} from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { ConfigurationError } from "@jaypie/errors";

import { CDK } from "./constants";

export interface JaypieGitHubDeployRoleProps {
  oidcProviderArn?: string;
  output?: boolean | string;
  repoRestriction?: string;
}

export class JaypieGitHubDeployRole extends Construct {
  private readonly _role: Role;

  constructor(
    scope: Construct,
    id: string = "GitHubDeployRole",
    props: JaypieGitHubDeployRoleProps = {},
  ) {
    super(scope, id);

    const {
      oidcProviderArn = Fn.importValue(CDK.IMPORT.OIDC_PROVIDER),
      output = true,
      repoRestriction: propsRepoRestriction,
    } = props;

    // Extract account ID from the scope
    const accountId = Stack.of(this).account;

    // Resolve repoRestriction from props or environment variables
    let repoRestriction = propsRepoRestriction;
    if (!repoRestriction) {
      const envRepo = process.env.CDK_ENV_REPO || process.env.PROJECT_REPO;
      if (!envRepo) {
        throw new ConfigurationError(
          "No repoRestriction provided. Set repoRestriction prop, CDK_ENV_REPO, or PROJECT_REPO environment variable",
        );
      }
      // Extract organization from owner/repo format and create org-wide restriction
      const organization = envRepo.split("/")[0];
      repoRestriction = `repo:${organization}/*:*`;
    }

    // Create the IAM role
    this._role = new Role(this, "GitHubActionsRole", {
      assumedBy: new FederatedPrincipal(
        oidcProviderArn,
        {
          StringLike: {
            "token.actions.githubusercontent.com:sub": repoRestriction,
          },
        },
        "sts:AssumeRoleWithWebIdentity",
      ),
      maxSessionDuration: Duration.hours(1),
      path: "/",
    });
    Tags.of(this._role).add(CDK.TAG.ROLE, CDK.ROLE.DEPLOY);

    // Allow the role to access the GitHub OIDC provider
    this._role.addToPolicy(
      new PolicyStatement({
        actions: ["sts:AssumeRoleWithWebIdentity"],
        resources: [`arn:aws:iam::${accountId}:oidc-provider/*`],
      }),
    );

    // Allow the role to deploy CDK apps
    this._role.addToPolicy(
      new PolicyStatement({
        actions: [
          "cloudformation:CreateStack",
          "cloudformation:DeleteStack",
          "cloudformation:DescribeStackEvents",
          "cloudformation:DescribeStackResource",
          "cloudformation:DescribeStackResources",
          "cloudformation:DescribeStacks",
          "cloudformation:GetTemplate",
          "cloudformation:SetStackPolicy",
          "cloudformation:UpdateStack",
          "cloudformation:ValidateTemplate",
          "iam:PassRole",
          "route53:ListHostedZones*",
          "s3:GetObject",
          "s3:ListBucket",
        ],
        effect: Effect.ALLOW,
        resources: ["*"],
      }),
    );

    this._role.addToPolicy(
      new PolicyStatement({
        actions: ["iam:PassRole", "sts:AssumeRole"],
        effect: Effect.ALLOW,
        resources: [
          "arn:aws:iam::*:role/cdk-hnb659fds-deploy-role-*",
          "arn:aws:iam::*:role/cdk-hnb659fds-file-publishing-*",
          "arn:aws:iam::*:role/cdk-readOnlyRole",
        ],
      }),
    );

    // Export the ARN of the role
    if (output !== false) {
      const outputId =
        typeof output === "string" ? output : "GitHubActionsRoleArn";
      new CfnOutput(this, outputId, {
        value: this._role.roleArn,
      });
    }
  }

  public get role(): Role {
    return this._role;
  }

  public get roleArn(): string {
    return this._role.roleArn;
  }

  public get roleName(): string {
    return this._role.roleName;
  }
}
