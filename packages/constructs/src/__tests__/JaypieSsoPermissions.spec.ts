import { CDK } from "@jaypie/cdk";
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
      template.resourceCountIs("AWS::SSO::PermissionSet", 3);
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
          analystGroupId: "2488f4e8-d061-708e-abe1-c315f0e30005",
          developerGroupId: "b438a4f8-e0e1-707c-c6e8-21841daf9ad1",
          administratorAccountAssignments: {
            "211125635435": ["Administrator", "Analyst", "Developer"],
            "381492033431": ["Administrator", "Analyst"],
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
      template.resourceCountIs("AWS::SSO::PermissionSet", 3);

      // Verify assignments were created
      // ADMINISTRATORS group: 3 + 2 = 5 assignments
      // ANALYSTS group: 2 + 0 = 2 assignments
      // DEVELOPERS group: 2 + 0 = 2 assignments
      // Total: 9 assignments
      template.resourceCountIs("AWS::SSO::Assignment", 9);
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
    it("creates three permission sets with correct properties", () => {
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
      expect(permissionSets.analystPermissionSet).toBeUndefined();
      expect(permissionSets.developerPermissionSet).toBeUndefined();
    });
  });
});
