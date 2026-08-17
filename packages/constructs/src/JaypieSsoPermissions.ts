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
   * Google Workspace group GUID for agents
   * Example: "c4d8a1b2-3e4f-5a6b-7c8d-9e0f1a2b3c4d"
   */
  agentGroupId?: string;

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
   * Account assignments for agent group
   * Maps account IDs to arrays of permission set names
   * Example:
   * {
   *   "211125635435": ["Agent"],
   * }
   */
  agentAccountAssignments?: AccountAssignments;

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
 *   agentGroupId: "c4d8a1b2-3e4f-5a6b-7c8d-9e0f1a2b3c4d",
 *   analystGroupId: "2488f4e8-d061-708e-abe1-c315f0e30005",
 *   developerGroupId: "b438a4f8-e0e1-707c-c6e8-21841daf9ad1",
 *   administratorAccountAssignments: {
 *     "211125635435": ["Administrator", "Analyst", "Developer"],
 *     "381492033431": ["Administrator", "Analyst"],
 *   },
 *   agentAccountAssignments: {
 *     "211125635435": ["Agent"],
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
  public readonly agentPermissionSet?: CfnPermissionSet;
  public readonly analystPermissionSet?: CfnPermissionSet;
  public readonly developerPermissionSet?: CfnPermissionSet;

  constructor(scope: Construct, id: string, props: JaypieSsoPermissionsProps) {
    super(scope, id);

    const {
      iamIdentityCenterArn: iamIdentityCenterArnProp,
      administratorGroupId,
      agentGroupId,
      analystGroupId,
      developerGroupId,
      administratorAccountAssignments,
      agentAccountAssignments,
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

    // Agent sits between Analyst and Developer: every Analyst read, plus the
    // data-plane and operational writes an automated agent needs, minus
    // deletion and identity change. IAM cannot express "every write except
    // deletes" — wildcards apply only inside an action name, after a literal
    // service prefix — so the destructive actions are enumerated as Deny.
    this.agentPermissionSet = new CfnPermissionSet(this, "AgentPermissionSet", {
      // Required
      instanceArn: iamIdentityCenterArn,
      name: "Agent",

      // Optional
      description:
        "Read access with data-plane and operational writes; no deletion, no identity change",
      inlinePolicy: {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "AgentWrite",
            Effect: "Allow",
            Action: [
              "bedrock-agentcore:Invoke*",
              "bedrock:ApplyGuardrail",
              "bedrock:Converse*",
              "bedrock:Invoke*",
              "bedrock:Retrieve*",
              "cloudwatch:PutMetricData",
              "dynamodb:BatchGet*",
              "dynamodb:BatchWrite*",
              "dynamodb:ConditionCheckItem",
              "dynamodb:DeleteItem",
              "dynamodb:ExecuteStatement",
              "dynamodb:ExecuteTransaction",
              "dynamodb:GetItem",
              "dynamodb:PartiQL*",
              "dynamodb:PutItem",
              "dynamodb:Query",
              "dynamodb:Scan",
              "dynamodb:TagResource",
              "dynamodb:UpdateItem",
              "ecr:BatchCheckLayerAvailability",
              "ecr:BatchGetImage",
              "ecr:CompleteLayerUpload",
              "ecr:GetAuthorizationToken",
              "ecr:GetDownloadUrlForLayer",
              "ecr:InitiateLayerUpload",
              "ecr:PutImage",
              "ecr:TagResource",
              "ecr:UploadLayerPart",
              "ecs:RegisterTaskDefinition",
              "ecs:RunTask",
              "ecs:StartTask",
              "ecs:StopTask",
              "ecs:TagResource",
              "ecs:UpdateService",
              "iam:Get*",
              "iam:List*",
              "iam:PassRole",
              "lambda:CreateEventSourceMapping",
              "lambda:Invoke*",
              "lambda:PublishVersion",
              "lambda:PutFunctionConcurrency",
              "lambda:TagResource",
              "lambda:UpdateAlias",
              "lambda:UpdateEventSourceMapping",
              "lambda:UpdateFunctionCode",
              "lambda:UpdateFunctionConfiguration",
              "logs:CreateLogGroup",
              "logs:CreateLogStream",
              "logs:FilterLogEvents",
              "logs:PutLogEvents",
              "logs:PutRetentionPolicy",
              "logs:StartQuery",
              "logs:StopQuery",
              "logs:TagResource",
              "pipes:StartPipe",
              "pipes:StopPipe",
              "pipes:TagResource",
              "s3:AbortMultipartUpload",
              "s3:DeleteObject",
              "s3:DeleteObjectTagging",
              "s3:PutObject",
              "s3:PutObjectTagging",
              "s3:RestoreObject",
              "secretsmanager:GetSecretValue",
              "sns:Publish",
              "sns:TagResource",
              "sqs:ChangeMessageVisibility*",
              "sqs:DeleteMessage*",
              "sqs:ReceiveMessage",
              "sqs:SendMessage*",
              "sqs:TagQueue",
              "ssm:AddTagsToResource",
              "ssm:GetParameter*",
              "ssm:PutParameter",
              "states:SendTask*",
              "states:StartExecution",
              "states:StartSyncExecution",
              "states:StopExecution",
              "states:TagResource",
              "tag:*",
              "uxc:*",
              "xray:*",
            ],
            Resource: "*",
          },
          {
            // Deletion, mass-expiry, and resource-policy writes. Item-level
            // deletes stay allowed above; the vectors denied here empty a store
            // in one call (lifecycle rules, TTL, queue purge, version delete)
            // or hand access to a principal outside this boundary.
            Sid: "AgentDenyDestructive",
            Effect: "Deny",
            Action: [
              "backup:Delete*",
              "backup:Stop*",
              "bedrock-agent:Delete*",
              "bedrock-agentcore:Delete*",
              "bedrock:Delete*",
              "cloudformation:Cancel*",
              "cloudformation:Continue*",
              "cloudformation:Create*",
              "cloudformation:Delete*",
              "cloudformation:Execute*",
              "cloudformation:Import*",
              "cloudformation:Rollback*",
              "cloudformation:Set*",
              "cloudformation:Stop*",
              "cloudformation:Update*",
              "cloudtrail:Delete*",
              "cloudtrail:Put*",
              "cloudtrail:Stop*",
              "cloudtrail:Update*",
              "cloudwatch:Delete*",
              "cloudwatch:DisableAlarmActions",
              "config:Delete*",
              "config:Stop*",
              "dynamodb:DeleteBackup",
              "dynamodb:DeleteResourcePolicy",
              "dynamodb:DeleteTable",
              "dynamodb:DisableKinesisStreamingDestination",
              "dynamodb:PutResourcePolicy",
              "dynamodb:UpdateContinuousBackups",
              "dynamodb:UpdateTimeToLive",
              "ec2:Authorize*",
              "ec2:Delete*",
              "ec2:Release*",
              "ec2:Revoke*",
              "ec2:Terminate*",
              "ecr:BatchDeleteImage",
              "ecr:Delete*",
              "ecr:PutLifecyclePolicy",
              "ecr:SetRepositoryPolicy",
              "ecs:Delete*",
              "ecs:Deregister*",
              "guardduty:Delete*",
              "guardduty:Disable*",
              "guardduty:Update*",
              "kms:Delete*",
              "kms:DisableKey",
              "kms:PutKeyPolicy",
              "kms:ScheduleKeyDeletion",
              "lambda:AddPermission",
              "lambda:CreateFunctionUrlConfig",
              "lambda:Delete*",
              "lambda:RemovePermission",
              "logs:Delete*",
              "logs:PutResourcePolicy",
              "route53:Change*",
              "route53:Delete*",
              "s3:BypassGovernanceRetention",
              "s3:DeleteBucket*",
              "s3:DeleteObjectVersion*",
              "s3:PutAccountPublicAccessBlock",
              "s3:PutBucketAcl",
              "s3:PutBucketPolicy",
              "s3:PutBucketPublicAccessBlock",
              "s3:PutBucketVersioning",
              "s3:PutLifecycleConfiguration",
              "s3:PutObjectAcl",
              "s3:PutObjectVersionAcl",
              "secretsmanager:Delete*",
              "secretsmanager:PutResourcePolicy",
              "secretsmanager:RemoveRegionsFromReplication",
              "securityhub:Delete*",
              "securityhub:Disable*",
              "securityhub:Update*",
              "sns:AddPermission",
              "sns:Delete*",
              "sns:RemovePermission",
              "sns:SetTopicAttributes",
              "sns:Unsubscribe",
              "sqs:AddPermission",
              "sqs:DeleteQueue",
              "sqs:PurgeQueue",
              "sqs:RemovePermission",
              "sqs:SetQueueAttributes",
              "ssm:Delete*",
              "ssm:Deregister*",
              "states:Delete*",
            ],
            Resource: "*",
          },
          {
            // Identity stays fixed. sts:AssumeRole is denied so the boundary
            // cannot be stepped out of by assuming a role that lacks it,
            // including the CDK bootstrap roles — deploys run in CI.
            Sid: "AgentDenyIdentity",
            Effect: "Deny",
            Action: [
              "account:Delete*",
              "account:Disable*",
              "account:Enable*",
              "account:Put*",
              "iam:Add*",
              "iam:Attach*",
              "iam:Change*",
              "iam:Create*",
              "iam:Deactivate*",
              "iam:Delete*",
              "iam:Detach*",
              "iam:Enable*",
              "iam:Put*",
              "iam:Remove*",
              "iam:Reset*",
              "iam:Set*",
              "iam:Tag*",
              "iam:Untag*",
              "iam:Update*",
              "iam:Upload*",
              "identitystore:Create*",
              "identitystore:Delete*",
              "identitystore:Update*",
              "organizations:Attach*",
              "organizations:Close*",
              "organizations:Create*",
              "organizations:Delete*",
              "organizations:Detach*",
              "organizations:Disable*",
              "organizations:Enable*",
              "organizations:Invite*",
              "organizations:Leave*",
              "organizations:Move*",
              "organizations:Put*",
              "organizations:Remove*",
              "organizations:Update*",
              "sso-directory:Create*",
              "sso-directory:Delete*",
              "sso-directory:Update*",
              "sso:Associate*",
              "sso:Create*",
              "sso:Delete*",
              "sso:Disassociate*",
              "sso:Provision*",
              "sso:Put*",
              "sso:Update*",
              "sts:AssumeRole",
            ],
            Resource: "*",
          },
          {
            // lambda:UpdateFunctionConfiguration plus iam:PassRole would let a
            // function be repointed at a more privileged role and invoked.
            // These roles are the ones that would make that an escalation.
            Sid: "AgentDenyPrivilegedPassRole",
            Effect: "Deny",
            Action: ["iam:PassRole"],
            Resource: [
              "arn:aws:iam::*:role/OrganizationAccountAccessRole",
              "arn:aws:iam::*:role/aws-reserved/sso.amazonaws.com/*",
              "arn:aws:iam::*:role/cdk-*-cfn-exec-role-*",
              "arn:aws:iam::*:role/cdk-*-deploy-role-*",
            ],
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
      sessionDuration: Duration.hours(8).toIsoString(),
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
    });

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
                "bedrock-agent:*",
                "bedrock-agentcore:*",
                "bedrock:*",
                "budgets:*",
                "ce:*",
                "cloudformation:*",
                "cloudwatch:*",
                "cost-optimization-hub:*",
                "dynamodb:*",
                "ec2:*",
                "ecr:*",
                "ecs:*",
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
                "ssm:*",
                "states:*",
                "support-console:*",
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
      Agent: {
        arn: this.agentPermissionSet.attrPermissionSetArn,
        label: "Agent",
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
    createAssignments(agentGroupId, agentAccountAssignments);
    createAssignments(analystGroupId, analystAccountAssignments);
    createAssignments(developerGroupId, developerAccountAssignments);
  }
}
