import { CDK } from "../constants";
import { describe, expect, it } from "vitest";
import { Stack } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { JaypieSsoPermissions } from "../JaypieSsoPermissions.js";

describe("JaypieSsoPermissions", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieSsoPermissions).toBeFunction();
    });

    it("creates no resources when instanceArn is not provided", () => {
      const stack = new Stack();
      const permissionSets = new JaypieSsoPermissions(
        stack,
        "TestPermissionSets",
        {},
      );

      const template = Template.fromStack(stack);

      expect(permissionSets).toBeDefined();
      template.resourceCountIs("AWS::SSO::PermissionSet", 0);
      template.resourceCountIs("AWS::SSO::Assignment", 0);
    });

    it("creates permission sets but no assignments when assignments not provided", () => {
      const stack = new Stack();
      const permissionSets = new JaypieSsoPermissions(
        stack,
        "TestPermissionSets",
        {
          iamIdentityCenterArn:
            "arn:aws:sso:::instance/ssoins-1234567890abcdef",
        },
      );

      const template = Template.fromStack(stack);

      expect(permissionSets).toBeDefined();
      template.resourceCountIs("AWS::SSO::PermissionSet", 4);
      template.resourceCountIs("AWS::SSO::Assignment", 0);
    });

    it("creates required resources with full configuration", () => {
      const stack = new Stack();
      const permissionSets = new JaypieSsoPermissions(
        stack,
        "TestPermissionSets",
        {
          iamIdentityCenterArn:
            "arn:aws:sso:::instance/ssoins-1234567890abcdef",
          administratorGroupId: "b4c8b438-4031-7000-782d-5046945fb956",
          agentGroupId: "c4d8a1b2-3e4f-5a6b-7c8d-9e0f1a2b3c4d",
          analystGroupId: "2488f4e8-d061-708e-abe1-c315f0e30005",
          developerGroupId: "b438a4f8-e0e1-707c-c6e8-21841daf9ad1",
          administratorAccountAssignments: {
            "211125635435": ["Administrator", "Analyst", "Developer"],
            "381492033431": ["Administrator", "Analyst"],
          },
          agentAccountAssignments: {
            "211125635435": ["Agent"],
          },
          analystAccountAssignments: {
            "211125635435": ["Analyst", "Developer"],
            "381492033431": [],
          },
          developerAccountAssignments: {
            "211125635435": ["Analyst", "Developer"],
            "381492033431": [],
          },
        },
      );

      const template = Template.fromStack(stack);

      expect(permissionSets).toBeDefined();

      // Verify permission sets were created
      template.resourceCountIs("AWS::SSO::PermissionSet", 4);

      // Verify assignments were created
      // ADMINISTRATORS group: 3 + 2 = 5 assignments
      // AGENTS group: 1 assignment
      // ANALYSTS group: 2 + 0 = 2 assignments
      // DEVELOPERS group: 2 + 0 = 2 assignments
      // Total: 10 assignments
      template.resourceCountIs("AWS::SSO::Assignment", 10);
    });
  });

  describe("Error Conditions", () => {
    it("throws ConfigurationError when unknown permission set is referenced", () => {
      const stack = new Stack();

      expect(() => {
        new JaypieSsoPermissions(stack, "TestPermissionSets", {
          iamIdentityCenterArn:
            "arn:aws:sso:::instance/ssoins-1234567890abcdef",
          administratorGroupId: "b4c8b438-4031-7000-782d-5046945fb956",
          administratorAccountAssignments: {
            "211125635435": ["UnknownPermissionSet"],
          },
        });
      }).toThrow(/Unknown permission set: UnknownPermissionSet/);
    });
  });

  describe("Features", () => {
    it("creates four permission sets with correct properties", () => {
      const stack = new Stack();
      const permissionSets = new JaypieSsoPermissions(
        stack,
        "TestPermissionSets",
        {
          iamIdentityCenterArn:
            "arn:aws:sso:::instance/ssoins-1234567890abcdef",
        },
      );

      const template = Template.fromStack(stack);

      expect(permissionSets).toBeDefined();

      // Verify Administrator permission set
      template.hasResourceProperties("AWS::SSO::PermissionSet", {
        Description: "Unrestricted access",
        InstanceArn: "arn:aws:sso:::instance/ssoins-1234567890abcdef",
        Name: "Administrator",
        SessionDuration: "PT1H",
      });

      // Verify Agent permission set
      template.hasResourceProperties("AWS::SSO::PermissionSet", {
        Description:
          "Read access with data-plane and operational writes; no deletion, no identity change",
        InstanceArn: "arn:aws:sso:::instance/ssoins-1234567890abcdef",
        Name: "Agent",
        SessionDuration: "PT8H",
      });

      // Verify Analyst permission set
      template.hasResourceProperties("AWS::SSO::PermissionSet", {
        Description: "Read-only access; may expand to limited write access",
        InstanceArn: "arn:aws:sso:::instance/ssoins-1234567890abcdef",
        Name: "Analyst",
        SessionDuration: "PT12H",
      });

      // Verify Developer permission set
      template.hasResourceProperties("AWS::SSO::PermissionSet", {
        Description: "Administrative access with limited restrictions",
        InstanceArn: "arn:aws:sso:::instance/ssoins-1234567890abcdef",
        Name: "Developer",
        SessionDuration: "PT4H",
      });
    });

    it("creates assignments based on configuration", () => {
      const stack = new Stack();
      const instanceArn = "arn:aws:sso:::instance/ssoins-1234567890abcdef";
      const adminGroupId = "b4c8b438-4031-7000-782d-5046945fb956";

      const permissionSets = new JaypieSsoPermissions(
        stack,
        "TestPermissionSets",
        {
          iamIdentityCenterArn: instanceArn,
          administratorGroupId: adminGroupId,
          administratorAccountAssignments: {
            "211125635435": ["Administrator"],
            "381492033431": ["Administrator"],
          },
        },
      );

      const template = Template.fromStack(stack);

      expect(permissionSets).toBeDefined();

      // Verify Administrator assignment for first account
      template.hasResourceProperties("AWS::SSO::Assignment", {
        InstanceArn: instanceArn,
        PermissionSetArn: {
          "Fn::GetAtt": [
            Match.stringLikeRegexp(".*AdministratorPermissionSet.*"),
            "PermissionSetArn",
          ],
        },
        PrincipalId: adminGroupId,
        PrincipalType: CDK.PRINCIPAL_TYPE.GROUP,
        TargetId: "211125635435",
        TargetType: CDK.TARGET_TYPE.AWS_ACCOUNT,
      });

      // Verify Administrator assignment for second account
      template.hasResourceProperties("AWS::SSO::Assignment", {
        InstanceArn: instanceArn,
        PermissionSetArn: {
          "Fn::GetAtt": [
            Match.stringLikeRegexp(".*AdministratorPermissionSet.*"),
            "PermissionSetArn",
          ],
        },
        PrincipalId: adminGroupId,
        PrincipalType: CDK.PRINCIPAL_TYPE.GROUP,
        TargetId: "381492033431",
        TargetType: CDK.TARGET_TYPE.AWS_ACCOUNT,
      });
    });

    it("creates multiple permission set assignments per account", () => {
      const stack = new Stack();
      const instanceArn = "arn:aws:sso:::instance/ssoins-1234567890abcdef";
      const adminGroupId = "b4c8b438-4031-7000-782d-5046945fb956";

      const permissionSets = new JaypieSsoPermissions(
        stack,
        "TestPermissionSets",
        {
          iamIdentityCenterArn: instanceArn,
          administratorGroupId: adminGroupId,
          administratorAccountAssignments: {
            "211125635435": ["Administrator", "Analyst", "Developer"],
          },
        },
      );

      const template = Template.fromStack(stack);

      expect(permissionSets).toBeDefined();

      // Verify we have 3 assignments for the same account
      template.resourceCountIs("AWS::SSO::Assignment", 3);

      // Verify Administrator assignment
      template.hasResourceProperties("AWS::SSO::Assignment", {
        PermissionSetArn: {
          "Fn::GetAtt": [
            Match.stringLikeRegexp(".*AdministratorPermissionSet.*"),
            "PermissionSetArn",
          ],
        },
        PrincipalId: adminGroupId,
        TargetId: "211125635435",
      });

      // Verify Analyst assignment
      template.hasResourceProperties("AWS::SSO::Assignment", {
        PermissionSetArn: {
          "Fn::GetAtt": [
            Match.stringLikeRegexp(".*AnalystPermissionSet.*"),
            "PermissionSetArn",
          ],
        },
        PrincipalId: adminGroupId,
        TargetId: "211125635435",
      });

      // Verify Developer assignment
      template.hasResourceProperties("AWS::SSO::Assignment", {
        PermissionSetArn: {
          "Fn::GetAtt": [
            Match.stringLikeRegexp(".*DeveloperPermissionSet.*"),
            "PermissionSetArn",
          ],
        },
        PrincipalId: adminGroupId,
        TargetId: "211125635435",
      });
    });

    it("skips assignments for groups without group GUIDs", () => {
      const stack = new Stack();
      const instanceArn = "arn:aws:sso:::instance/ssoins-1234567890abcdef";

      const permissionSets = new JaypieSsoPermissions(
        stack,
        "TestPermissionSets",
        {
          iamIdentityCenterArn: instanceArn,
          administratorGroupId: "b4c8b438-4031-7000-782d-5046945fb956",
          // analystGroupId is missing
          administratorAccountAssignments: {
            "211125635435": ["Administrator"],
          },
          analystAccountAssignments: {
            "211125635435": ["Analyst"],
          },
        },
      );

      const template = Template.fromStack(stack);

      expect(permissionSets).toBeDefined();

      // Verify only 1 assignment was created (for ADMINISTRATORS)
      template.resourceCountIs("AWS::SSO::Assignment", 1);
    });

    it("handles empty permission set arrays", () => {
      const stack = new Stack();
      const instanceArn = "arn:aws:sso:::instance/ssoins-1234567890abcdef";

      const permissionSets = new JaypieSsoPermissions(
        stack,
        "TestPermissionSets",
        {
          iamIdentityCenterArn: instanceArn,
          administratorGroupId: "b4c8b438-4031-7000-782d-5046945fb956",
          administratorAccountAssignments: {
            "211125635435": [],
          },
        },
      );

      const template = Template.fromStack(stack);

      expect(permissionSets).toBeDefined();

      // Verify no assignments were created
      template.resourceCountIs("AWS::SSO::Assignment", 0);
    });

    it("adds correct tags to assignments", () => {
      const stack = new Stack();
      const instanceArn = "arn:aws:sso:::instance/ssoins-1234567890abcdef";

      const permissionSets = new JaypieSsoPermissions(
        stack,
        "TestPermissionSets",
        {
          iamIdentityCenterArn: instanceArn,
          administratorGroupId: "b4c8b438-4031-7000-782d-5046945fb956",
          administratorAccountAssignments: {
            "211125635435": ["Administrator"],
          },
        },
      );

      expect(permissionSets).toBeDefined();

      // TODO: Verify assignment tags
      // Note: Tags.of().add() may not work as expected for CfnAssignment resources
      // in the CloudFormation template. This is a known limitation.
    });
  });

  describe("Agent Permission Set", () => {
    const agentStatements = () => {
      const stack = new Stack();
      new JaypieSsoPermissions(stack, "TestPermissionSets", {
        iamIdentityCenterArn: "arn:aws:sso:::instance/ssoins-1234567890abcdef",
      });
      const permissionSets = Template.fromStack(stack).findResources(
        "AWS::SSO::PermissionSet",
      );
      const agent = Object.values(permissionSets).find(
        (resource) => resource.Properties.Name === "Agent",
      );
      return {
        managedPolicies: agent!.Properties.ManagedPolicies as unknown[],
        statements: agent!.Properties.InlinePolicy.Statement as Array<{
          Action: string[];
          Effect: string;
          Sid: string;
        }>,
      };
    };

    const actionsFor = (sid: string) => {
      const { statements } = agentStatements();
      return statements.find((statement) => statement.Sid === sid)!.Action;
    };

    it("allows the data-plane and operational writes agents need", () => {
      const allowed = actionsFor("AgentWrite");
      expect(allowed).toContain("dynamodb:PutItem");
      expect(allowed).toContain("dynamodb:DeleteItem");
      expect(allowed).toContain("lambda:Invoke*");
      expect(allowed).toContain("lambda:UpdateFunctionConfiguration");
      expect(allowed).toContain("s3:DeleteObject");
      expect(allowed).toContain("s3:PutObject");
      expect(allowed).toContain("secretsmanager:GetSecretValue");
      expect(allowed).toContain("sqs:ReceiveMessage");
      expect(allowed).toContain("sqs:SendMessage*");
    });

    it("denies deletion of stacks and resources", () => {
      const denied = actionsFor("AgentDenyDestructive");
      expect(denied).toContain("cloudformation:Delete*");
      expect(denied).toContain("cloudformation:Update*");
      expect(denied).toContain("dynamodb:DeleteTable");
      expect(denied).toContain("lambda:Delete*");
      expect(denied).toContain("s3:DeleteBucket*");
      expect(denied).toContain("sqs:DeleteQueue");
    });

    it("denies the mass-expiry paths that empty a store without a delete call", () => {
      const denied = actionsFor("AgentDenyDestructive");
      expect(denied).toContain("dynamodb:UpdateTimeToLive");
      expect(denied).toContain("s3:DeleteObjectVersion*");
      expect(denied).toContain("s3:PutLifecycleConfiguration");
      expect(denied).toContain("sqs:PurgeQueue");
    });

    it("denies resource policy writes that grant access outside the boundary", () => {
      const denied = actionsFor("AgentDenyDestructive");
      expect(denied).toContain("lambda:AddPermission");
      expect(denied).toContain("s3:PutBucketPolicy");
      expect(denied).toContain("secretsmanager:PutResourcePolicy");
      expect(denied).toContain("sqs:AddPermission");
    });

    it("denies identity change and role assumption", () => {
      const denied = actionsFor("AgentDenyIdentity");
      expect(denied).toContain("iam:Create*");
      expect(denied).toContain("iam:Attach*");
      expect(denied).toContain("organizations:Update*");
      expect(denied).toContain("sso:Create*");
      expect(denied).toContain("sts:AssumeRole");
    });

    it("passes roles except the privileged ones", () => {
      const { statements } = agentStatements();
      const allowed = statements.find(
        (statement) => statement.Sid === "AgentWrite",
      )!;
      const denied = statements.find(
        (statement) => statement.Sid === "AgentDenyPrivilegedPassRole",
      ) as unknown as { Action: string[]; Resource: string[] };
      expect(allowed.Action).toContain("iam:PassRole");
      expect(denied.Action).toEqual(["iam:PassRole"]);
      expect(denied.Resource).toContain(
        "arn:aws:iam::*:role/aws-reserved/sso.amazonaws.com/*",
      );
    });

    it("does not carry the SystemAdministrator managed policy", () => {
      // ARNs render as Fn::Join intrinsics, so compare the serialized form
      const managedPolicies = JSON.stringify(agentStatements().managedPolicies);
      expect(managedPolicies).not.toContain("SystemAdministrator");
      expect(managedPolicies).toContain("ReadOnlyAccess");
    });
  });

  describe("Specific Scenarios", () => {
    it("handles complex multi-group multi-account configuration", () => {
      const stack = new Stack();
      const permissionSets = new JaypieSsoPermissions(
        stack,
        "TestPermissionSets",
        {
          iamIdentityCenterArn:
            "arn:aws:sso:::instance/ssoins-1234567890abcdef",
          administratorGroupId: "b4c8b438-4031-7000-782d-5046945fb956",
          analystGroupId: "2488f4e8-d061-708e-abe1-c315f0e30005",
          developerGroupId: "b438a4f8-e0e1-707c-c6e8-21841daf9ad1",
          administratorAccountAssignments: {
            "111111111111": ["Administrator"],
            "222222222222": ["Administrator"],
            "333333333333": ["Administrator"],
          },
          analystAccountAssignments: {
            "111111111111": ["Analyst"],
            "222222222222": ["Analyst"],
          },
          developerAccountAssignments: {
            "111111111111": ["Developer"],
          },
        },
      );

      const template = Template.fromStack(stack);

      expect(permissionSets).toBeDefined();

      // Calculate expected total assignments
      // ADMINISTRATORS: 3 assignments
      // ANALYSTS: 2 assignments
      // DEVELOPERS: 1 assignment
      // Total: 6 assignments
      template.resourceCountIs("AWS::SSO::Assignment", 6);
    });
  });

  describe("Public Interface", () => {
    it("exposes permission sets as public properties", () => {
      const stack = new Stack();
      const permissionSets = new JaypieSsoPermissions(
        stack,
        "TestPermissionSets",
        {
          iamIdentityCenterArn:
            "arn:aws:sso:::instance/ssoins-1234567890abcdef",
        },
      );

      // Verify we can access permission sets
      expect(permissionSets.administratorPermissionSet).toBeDefined();
      expect(permissionSets.agentPermissionSet).toBeDefined();
      expect(permissionSets.analystPermissionSet).toBeDefined();
      expect(permissionSets.developerPermissionSet).toBeDefined();
    });

    it("has undefined permission sets when no instanceArn provided", () => {
      const stack = new Stack();
      const permissionSets = new JaypieSsoPermissions(
        stack,
        "TestPermissionSets",
        {},
      );

      // Verify permission sets are undefined
      expect(permissionSets.administratorPermissionSet).toBeUndefined();
      expect(permissionSets.agentPermissionSet).toBeUndefined();
      expect(permissionSets.analystPermissionSet).toBeUndefined();
      expect(permissionSets.developerPermissionSet).toBeUndefined();
    });
  });
});
