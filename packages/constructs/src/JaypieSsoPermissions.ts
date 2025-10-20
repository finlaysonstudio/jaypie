import { Construct } from "constructs";
import { Duration, Tags } from "aws-cdk-lib";
import { CfnAssignment, CfnPermissionSet } from "aws-cdk-lib/aws-sso";
import { ManagedPolicy } from "aws-cdk-lib/aws-iam";
import { ConfigurationError } from "@jaypie/errors";

import { CDK } from "./constants";

/**
 * Mapping of account IDs to permission set names
 * Key: AWS account ID
 * Value: Array of permission set names to assign to this account
 */
export interface AccountAssignments {
  [accountId: string]: string[];
}

/**
 * Properties for the JaypieSsoPermissions construct
 */
export interface JaypieSsoPermissionsProps {
  /**
   * ARN of the IAM Identity Center instance
   * If not provided, falls back to CDK_ENV_IAM_IDENTITY_CENTER_ARN
   * If neither is set, SSO setup will be skipped
   */
  iamIdentityCenterArn?: string;

  /**
   * Google Workspace group GUID for administrators
   * Example: "b4c8b438-4031-7000-782d-5046945fb956"
   */
  administratorGroupId?: string;

  /**
   * Google Workspace group GUID for analysts
   * Example: "2488f4e8-d061-708e-abe1-c315f0e30005"
   */
  analystGroupId?: string;

  /**
   * Google Workspace group GUID for developers
   * Example: "b438a4f8-e0e1-707c-c6e8-21841daf9ad1"
   */
  developerGroupId?: string;

  /**
   * Account assignments for administrator group
   * Maps account IDs to arrays of permission set names
   * Example:
   * {
   *   "211125635435": ["Administrator", "Analyst"],
   *   "381492033431": ["Administrator"],
   * }
   */
  administratorAccountAssignments?: AccountAssignments;

  /**
   * Account assignments for analyst group
   * Maps account IDs to arrays of permission set names
   * Example:
   * {
   *   "211125635435": ["Analyst"],
   *   "381492033431": ["Analyst"],
   * }
   */
  analystAccountAssignments?: AccountAssignments;

  /**
   * Account assignments for developer group
   * Maps account IDs to arrays of permission set names
   * Example:
   * {
   *   "211125635435": ["Developer"],
   * }
   */
  developerAccountAssignments?: AccountAssignments;
}

/**
 * JaypieSsoPermissions Construct
 *
 * Creates and manages AWS IAM Identity Center (SSO) permission sets and assignments
 *
 * @example
 * const permissionSets = new JaypieSsoPermissions(this, "PermissionSets", {
 *   iamIdentityCenterArn: "arn:aws:sso:::instance/...",
 *   administratorGroupId: "b4c8b438-4031-7000-782d-5046945fb956",
 *   analystGroupId: "2488f4e8-d061-708e-abe1-c315f0e30005",
 *   developerGroupId: "b438a4f8-e0e1-707c-c6e8-21841daf9ad1",
 *   administratorAccountAssignments: {
 *     "211125635435": ["Administrator", "Analyst", "Developer"],
 *     "381492033431": ["Administrator", "Analyst"],
 *   },
 *   analystAccountAssignments: {
 *     "211125635435": ["Analyst", "Developer"],
 *     "381492033431": [],
 *   },
 *   developerAccountAssignments: {
 *     "211125635435": ["Analyst", "Developer"],
 *     "381492033431": [],
 *   },
 * });
 */
export class JaypieSsoPermissions extends Construct {
  public readonly administratorPermissionSet?: CfnPermissionSet;
  public readonly analystPermissionSet?: CfnPermissionSet;
  public readonly developerPermissionSet?: CfnPermissionSet;

  constructor(scope: Construct, id: string, props: JaypieSsoPermissionsProps) {
    super(scope, id);

    const {
      iamIdentityCenterArn: iamIdentityCenterArnProp,
      administratorGroupId,
      analystGroupId,
      developerGroupId,
      administratorAccountAssignments,
      analystAccountAssignments,
      developerAccountAssignments,
    } = props;

    const iamIdentityCenterArn =
      iamIdentityCenterArnProp || process.env.CDK_ENV_IAM_IDENTITY_CENTER_ARN;

    if (!iamIdentityCenterArn) {
      // If no IAM Identity Center ARN provided, skip SSO setup
      return;
    }

    //
    // Permission Sets
    //

    this.administratorPermissionSet = new CfnPermissionSet(
      this,
      "AdministratorPermissionSet",
      {
        // Required
        instanceArn: iamIdentityCenterArn,
        name: "Administrator",

        // Optional
        description: "Unrestricted access",
        inlinePolicy: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "aws-portal:ViewUsage",
                "aws-portal:ViewBilling",
                "budgets:*",
                "cur:DescribeReportDefinitions",
                "cur:PutReportDefinition",
                "cur:DeleteReportDefinition",
                "cur:ModifyReportDefinition",
              ],
              Resource: "*",
            },
          ],
        },
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")
            .managedPolicyArn,
          ManagedPolicy.fromAwsManagedPolicyName(
            "AWSManagementConsoleBasicUserAccess",
          ).managedPolicyArn,
        ],
        sessionDuration: Duration.hours(1).toIsoString(),
        tags: [
          {
            key: CDK.TAG.SERVICE,
            value: CDK.SERVICE.SSO,
          },
          {
            key: CDK.TAG.ROLE,
            value: CDK.ROLE.SECURITY,
          },
        ],
      },
    );

    this.analystPermissionSet = new CfnPermissionSet(
      this,
      "AnalystPermissionSet",
      {
        // Required
        instanceArn: iamIdentityCenterArn,
        name: "Analyst",

        // Optional
        description: "Read-only access; may expand to limited write access",
        inlinePolicy: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "aws-portal:ViewUsage",
                "aws-portal:ViewBilling",
                "budgets:Describe*",
                "budgets:View*",
                "ce:Get*",
                "ce:List*",
                "cloudformation:Describe*",
                "cloudformation:Get*",
                "cloudformation:List*",
                "cloudwatch:BatchGet*",
                "cloudwatch:Get*",
                "cloudwatch:List*",
                "cost-optimization-hub:Get*",
                "cost-optimization-hub:List*",
                "ec2:Describe*",
                "ec2:Get*",
                "ec2:List*",
                "ec2:Search*",
                "iam:Get*",
                "iam:List*",
                "iam:PassRole",
                "lambda:Get*",
                "lambda:List*",
                "logs:Describe*",
                "logs:Get*",
                "logs:List*",
                "pipes:Describe*",
                "pipes:List*",
                "s3:Get*",
                "s3:List*",
                "secretsmanager:GetRandomPassword",
                "secretsmanager:GetResourcePolicy",
                "secretsmanager:List*",
                "securityhub:Describe*",
                "securityhub:Get*",
                "securityhub:List*",
                "servicecatalog:Describe*",
                "sns:Get*",
                "sns:List*",
                "sqs:Get*",
                "sqs:List*",
                "states:Describe*",
                "states:Get*",
                "states:List*",
                "tag:*",
                "uxc:*",
                "xray:*",
              ],
              Resource: "*",
            },
          ],
        },
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName("AmazonQDeveloperAccess")
            .managedPolicyArn,
          ManagedPolicy.fromAwsManagedPolicyName(
            "AWSManagementConsoleBasicUserAccess",
          ).managedPolicyArn,
          ManagedPolicy.fromAwsManagedPolicyName("ReadOnlyAccess")
            .managedPolicyArn,
        ],
        sessionDuration: Duration.hours(12).toIsoString(),
        tags: [
          {
            key: CDK.TAG.SERVICE,
            value: CDK.SERVICE.SSO,
          },
          {
            key: CDK.TAG.ROLE,
            value: CDK.ROLE.SECURITY,
          },
        ],
      },
    );

    this.developerPermissionSet = new CfnPermissionSet(
      this,
      "DeveloperPermissionSet",
      {
        // Required
        instanceArn: iamIdentityCenterArn,
        name: "Developer",

        // Optional
        description: "Administrative access with limited restrictions",
        inlinePolicy: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "budgets:*",
                "ce:*",
                "cloudformation:*",
                "cloudwatch:*",
                "cost-optimization-hub:*",
                "ec2:*",
                "iam:Get*",
                "iam:List*",
                "iam:PassRole",
                "lambda:*",
                "logs:*",
                "pipes:*",
                "s3:*",
                "secretsmanager:*",
                "securityhub:*",
                "servicecatalog:*",
                "sns:*",
                "sqs:*",
                "states:*",
                "tag:*",
                "uxc:*",
                "xray:*",
              ],
              Resource: "*",
            },
          ],
        },
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName("AmazonQDeveloperAccess")
            .managedPolicyArn,
          ManagedPolicy.fromAwsManagedPolicyName(
            "AWSManagementConsoleBasicUserAccess",
          ).managedPolicyArn,
          ManagedPolicy.fromAwsManagedPolicyName("ReadOnlyAccess")
            .managedPolicyArn,
          ManagedPolicy.fromAwsManagedPolicyName(
            "job-function/SystemAdministrator",
          ).managedPolicyArn,
        ],
        sessionDuration: Duration.hours(4).toIsoString(),
        tags: [
          {
            key: CDK.TAG.SERVICE,
            value: CDK.SERVICE.SSO,
          },
          {
            key: CDK.TAG.ROLE,
            value: CDK.ROLE.SECURITY,
          },
        ],
      },
    );

    // Map permission set names to their ARNs and labels
    const permissionSetMap: Record<string, { arn: string; label: string }> = {
      Administrator: {
        arn: this.administratorPermissionSet.attrPermissionSetArn,
        label: "Administrator",
      },
      Analyst: {
        arn: this.analystPermissionSet.attrPermissionSetArn,
        label: "Analyst",
      },
      Developer: {
        arn: this.developerPermissionSet.attrPermissionSetArn,
        label: "Developer",
      },
    };

    //
    // Assignments
    //

    // Helper function to create assignments for a group
    const createAssignments = (
      groupId: string | undefined,
      accountAssignments: AccountAssignments | undefined,
    ) => {
      if (!groupId || !accountAssignments) {
        return; // Skip if group ID or assignments not provided
      }

      Object.keys(accountAssignments).forEach((accountId) => {
        const permissionSetNames = accountAssignments[accountId];

        permissionSetNames.forEach((permissionSetName) => {
          const permissionSet = permissionSetMap[permissionSetName];

          if (!permissionSet) {
            throw new ConfigurationError(
              `Unknown permission set: ${permissionSetName}. Valid options: ${Object.keys(permissionSetMap).join(", ")}`,
            );
          }

          const accountAssignment = new CfnAssignment(
            this,
            `AccountAssignment-${accountId}-${permissionSet.label}Role-${groupId}Group`,
            {
              // Required
              instanceArn: iamIdentityCenterArn,
              permissionSetArn: permissionSet.arn,
              principalId: groupId,
              principalType: CDK.PRINCIPAL_TYPE.GROUP,
              targetId: accountId,
              targetType: CDK.TARGET_TYPE.AWS_ACCOUNT,
            },
          );
          Tags.of(accountAssignment).add(CDK.TAG.SERVICE, CDK.SERVICE.SSO);
          Tags.of(accountAssignment).add(CDK.TAG.ROLE, CDK.ROLE.SECURITY);
        });
      });
    };

    // Create assignments for each group
    createAssignments(administratorGroupId, administratorAccountAssignments);
    createAssignments(analystGroupId, analystAccountAssignments);
    createAssignments(developerGroupId, developerAccountAssignments);
  }
}
