import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { JaypieGitHubDeployRole } from "../JaypieGitHubDeployRole";

const OIDC_ARN =
  "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com";

describe("JaypieGitHubDeployRole", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.CDK_ENV_REPO;
    delete process.env.PROJECT_REPO;
    delete process.env.PROJECT_SPONSOR;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieGitHubDeployRole).toBeFunction();
    });

    it("creates an IAM role", () => {
      const stack = new Stack();
      new JaypieGitHubDeployRole(stack, "Role", {
        oidcProviderArn: OIDC_ARN,
        repoRestriction: "repo:example-org/*:*",
        sponsor: "example-org",
      });
      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::IAM::Role", 1);
    });
  });

  describe("ECR default permissions", () => {
    it("grants ecr:GetAuthorizationToken on * with sponsor from PROJECT_SPONSOR", () => {
      process.env.PROJECT_SPONSOR = "acme";
      const stack = new Stack();
      new JaypieGitHubDeployRole(stack, "Role", {
        oidcProviderArn: OIDC_ARN,
        repoRestriction: "repo:acme/*:*",
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: "ecr:GetAuthorizationToken",
              Effect: "Allow",
              Resource: "*",
            }),
          ]),
        },
      });
    });

    it("grants ecr push actions scoped to <sponsor>-* repositories", () => {
      process.env.PROJECT_SPONSOR = "acme";
      const stack = new Stack();
      new JaypieGitHubDeployRole(stack, "Role", {
        oidcProviderArn: OIDC_ARN,
        repoRestriction: "repo:acme/*:*",
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                "ecr:BatchCheckLayerAvailability",
                "ecr:BatchGetImage",
                "ecr:CompleteLayerUpload",
                "ecr:CreateRepository",
                "ecr:DescribeRepositories",
                "ecr:InitiateLayerUpload",
                "ecr:PutImage",
                "ecr:UploadLayerPart",
              ]),
              Effect: "Allow",
              Resource: {
                "Fn::Join": [
                  "",
                  Match.arrayWith([
                    Match.stringLikeRegexp(
                      "^arn:aws:ecr:\\*:$|:repository/acme-\\*$",
                    ),
                  ]),
                ],
              },
            }),
          ]),
        },
      });
    });

    it("derives sponsor from CDK_ENV_REPO when PROJECT_SPONSOR is unset", () => {
      process.env.CDK_ENV_REPO = "widgets-inc/infra";
      const stack = new Stack();
      new JaypieGitHubDeployRole(stack, "Role", {
        oidcProviderArn: OIDC_ARN,
      });
      const template = Template.fromStack(stack);

      // Resource ARN should include "widgets-inc-*"
      const policies = template.findResources("AWS::IAM::Policy");
      const statements = Object.values(policies)
        .flatMap((p) => p.Properties.PolicyDocument.Statement as any[])
        .filter((s) =>
          Array.isArray(s.Action)
            ? s.Action.includes("ecr:PutImage")
            : s.Action === "ecr:PutImage",
        );
      expect(statements.length).toBeGreaterThan(0);
      const [joinStr, parts] = statements[0].Resource["Fn::Join"];
      expect(joinStr).toBe("");
      expect(parts.join("")).toContain(":repository/widgets-inc-*");
    });

    it("accepts sponsor prop and overrides env-derived sponsor", () => {
      process.env.PROJECT_SPONSOR = "fromenv";
      const stack = new Stack();
      new JaypieGitHubDeployRole(stack, "Role", {
        oidcProviderArn: OIDC_ARN,
        repoRestriction: "repo:fromprops/*:*",
        sponsor: "fromprops",
      });
      const template = Template.fromStack(stack);
      const policies = template.findResources("AWS::IAM::Policy");
      const statements = Object.values(policies)
        .flatMap((p) => p.Properties.PolicyDocument.Statement as any[])
        .filter((s) =>
          Array.isArray(s.Action)
            ? s.Action.includes("ecr:PutImage")
            : s.Action === "ecr:PutImage",
        );
      expect(statements.length).toBeGreaterThan(0);
      const [, parts] = statements[0].Resource["Fn::Join"];
      expect(parts.join("")).toContain(":repository/fromprops-*");
      expect(parts.join("")).not.toContain("fromenv");
    });

    it("omits ECR statements when ecr is disabled", () => {
      process.env.PROJECT_SPONSOR = "acme";
      const stack = new Stack();
      new JaypieGitHubDeployRole(stack, "Role", {
        oidcProviderArn: OIDC_ARN,
        repoRestriction: "repo:acme/*:*",
        ecr: false,
      });
      const template = Template.fromStack(stack);
      const policies = template.findResources("AWS::IAM::Policy");
      const statements = Object.values(policies).flatMap(
        (p) => p.Properties.PolicyDocument.Statement as any[],
      );
      const ecrStatements = statements.filter((s) =>
        Array.isArray(s.Action)
          ? s.Action.some((a: string) => a.startsWith("ecr:"))
          : typeof s.Action === "string" && s.Action.startsWith("ecr:"),
      );
      expect(ecrStatements).toHaveLength(0);
    });
  });
});
