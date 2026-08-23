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
import { githubOidcSubjects } from "./helpers";

export interface JaypieGitHubDeployRoleProps {
  ecr?: boolean;
  oidcProviderArn?: string;
  /**
   * Numeric GitHub organization id, pinning the id-embedded subject pattern
   * the derived default would otherwise wildcard. Ignored when
   * `repoRestriction` is provided.
   *
   * @default CDK_ENV_REPO_ORGANIZATION_ID || PROJECT_REPO_ORGANIZATION_ID
   */
  organizationId?: string;
  output?: boolean | string;
  /**
   * Trusted GitHub OIDC `sub` patterns. An array trusts any one of them.
   *
   * @default both patterns from `githubOidcSubjects` for the organization in
   * CDK_ENV_REPO || PROJECT_REPO
   */
  repoRestriction?: string | string[];
  sponsor?: string;
}

const ECR_PUSH_ACTIONS = [
  "ecr:BatchCheckLayerAvailability",
  "ecr:BatchGetImage",
  "ecr:CompleteLayerUpload",
  "ecr:CreateRepository",
  "ecr:DescribeRepositories",
  "ecr:InitiateLayerUpload",
  "ecr:PutImage",
  "ecr:UploadLayerPart",
];

export class JaypieGitHubDeployRole extends Construct {
  private readonly _role: Role;

  constructor(
    scope: Construct,
    id: string = "GitHubDeployRole",
    props: JaypieGitHubDeployRoleProps = {},
  ) {
    super(scope, id);

    const {
      ecr = true,
      oidcProviderArn = Fn.importValue(CDK.IMPORT.OIDC_PROVIDER),
      organizationId: propsOrganizationId,
      output = true,
      repoRestriction: propsRepoRestriction,
      sponsor: propsSponsor,
    } = props;

    // Extract account ID from the scope
    const accountId = Stack.of(this).account;

    // Resolve repoRestriction and sponsor from props or environment variables
    const envRepo = process.env.CDK_ENV_REPO || process.env.PROJECT_REPO;
    const envRepoOrganization = envRepo ? envRepo.split("/")[0] : undefined;

    // GitHub issues newer repositories an id-embedded subject
    // (`repo:<org>@<org-id>/<repo>@<repo-id>:*`) while older ones still present
    // the plain form, so the default trusts both.
    let repoRestriction = propsRepoRestriction;
    if (!repoRestriction) {
      if (!envRepoOrganization) {
        throw new ConfigurationError(
          "No repoRestriction provided. Set repoRestriction prop, CDK_ENV_REPO, or PROJECT_REPO environment variable",
        );
      }
      repoRestriction = githubOidcSubjects({
        organization: envRepoOrganization,
        organizationId:
          propsOrganizationId ||
          process.env.CDK_ENV_REPO_ORGANIZATION_ID ||
          process.env.PROJECT_REPO_ORGANIZATION_ID,
      });
    }

    const sponsor =
      propsSponsor || process.env.PROJECT_SPONSOR || envRepoOrganization;

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
          "cloudformation:Describe*",
          "cloudformation:GetTemplate",
          "cloudformation:SetStackPolicy",
          "cloudformation:UpdateStack",
          "cloudformation:ValidateTemplate",
          "ec2:Describe*",
          "iam:PassRole",
          "route53:ListHostedZones*",
          "s3:GetObject", // TODO: this should be restricted by bucket
          "s3:ListBucket",
          "ssm:GetParameter",
          "ssm:GetParameters",
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
          "arn:aws:iam::*:role/cdk-hnb659fds-lookup-role-*",
          "arn:aws:iam::*:role/cdk-readOnlyRole",
        ],
      }),
    );

    // Grant ECR auth + push scoped to <sponsor>-* repositories
    if (ecr) {
      if (!sponsor) {
        throw new ConfigurationError(
          "Cannot grant default ECR permissions without a sponsor. Set sponsor prop, PROJECT_SPONSOR, CDK_ENV_REPO, or PROJECT_REPO, or pass `ecr: false`",
        );
      }
      this._role.addToPolicy(
        new PolicyStatement({
          actions: ["ecr:GetAuthorizationToken"],
          effect: Effect.ALLOW,
          resources: ["*"],
        }),
      );
      this._role.addToPolicy(
        new PolicyStatement({
          actions: ECR_PUSH_ACTIONS,
          effect: Effect.ALLOW,
          resources: [`arn:aws:ecr:*:${accountId}:repository/${sponsor}-*`],
        }),
      );
    }

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
