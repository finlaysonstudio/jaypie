import { Construct } from "constructs";
import { Tags, Duration } from "aws-cdk-lib";
import * as sso from "aws-cdk-lib/aws-sso";
import { CDK } from "@jaypie/cdk";

/**
 * Account categories for SSO group assignments
 */
export interface JaypieSsoAccountMap {
  development: string[];
  management: string[];
  operations: string[];
  production: string[];
  sandbox: string[];
  security: string[];
  stage: string[];
}

/**
 * Mapping of group types to Google Workspace group GUIDs
 */
export interface JaypieSsoGroupMap {
  administrators: string;
  analysts: string;
  developers: string;
}

/**
 * Properties for the JaypieSsoGroups construct
 */
export interface JaypieSsoGroupsProps {
  /**
   * ARN of the IAM Identity Center instance
   */
  instanceArn: string;

  /**
   * Mapping of account categories to AWS account IDs
   */
  accountMap: JaypieSsoAccountMap;

  /**
   * Mapping of group types to Google Workspace group GUIDs
   */
  groupMap: JaypieSsoGroupMap;
}

/**
 * Permission set types with corresponding AWS managed policies
 */
export enum PermissionSetType {
  ADMINISTRATOR = "Administrator",
  ANALYST = "Analyst",
  DEVELOPER = "Developer",
}

/**
 * Construct to simplify AWS SSO group management.
 * This construct encapsulates the complexity of creating permission sets
 * and assigning them to groups across multiple AWS accounts.
 */
export class JaypieSsoGroups extends Construct {
  private readonly permissionSets: Record<
    PermissionSetType,
    sso.CfnPermissionSet
  > = {} as Record<PermissionSetType, sso.CfnPermissionSet>;
  private readonly instanceArn: string;

  constructor(scope: Construct, id: string, props: JaypieSsoGroupsProps) {
    super(scope, id);

    this.instanceArn = props.instanceArn;

    // Create the permission sets
    this.createAdministratorPermissionSet();
    this.createAnalystPermissionSet();
    this.createDeveloperPermissionSet();

    // Group assignment implementation will be added in the next task
  }

  /**
   * Creates the Administrator permission set with AdministratorAccess policy
   * and billing access
   */
  private createAdministratorPermissionSet(): void {
    const permissionSet = new sso.CfnPermissionSet(
      this,
      "AdministratorPermissionSet",
      {
        instanceArn: this.instanceArn,
        name: PermissionSetType.ADMINISTRATOR,
        description:
          "Full administrative access to all AWS services and resources",
        sessionDuration: Duration.hours(8).toIsoString(),
        managedPolicies: ["arn:aws:iam::aws:policy/AdministratorAccess"],
        inlinePolicy: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "aws-portal:ViewBilling",
                "aws-portal:ModifyBilling",
                "aws-portal:ViewAccount",
                "aws-portal:ModifyAccount",
                "budgets:ViewBudget",
                "budgets:ModifyBudget",
              ],
              Resource: "*",
            },
          ],
        },
      },
    );

    Tags.of(permissionSet).add(CDK.TAG.SERVICE, CDK.SERVICE.SSO);

    this.permissionSets[PermissionSetType.ADMINISTRATOR] = permissionSet;
  }

  /**
   * Creates the Analyst permission set with ReadOnlyAccess policy
   * and limited write access
   */
  private createAnalystPermissionSet(): void {
    const permissionSet = new sso.CfnPermissionSet(
      this,
      "AnalystPermissionSet",
      {
        instanceArn: this.instanceArn,
        name: PermissionSetType.ANALYST,
        description:
          "Read-only access with billing visibility and limited write access",
        sessionDuration: Duration.hours(4).toIsoString(),
        managedPolicies: ["arn:aws:iam::aws:policy/ReadOnlyAccess"],
        inlinePolicy: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "aws-portal:ViewBilling",
                "aws-portal:ViewAccount",
                "budgets:ViewBudget",
                "cloudwatch:PutDashboard",
                "cloudwatch:PutMetricData",
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket",
              ],
              Resource: "*",
            },
          ],
        },
      },
    );

    Tags.of(permissionSet).add(CDK.TAG.SERVICE, CDK.SERVICE.SSO);

    this.permissionSets[PermissionSetType.ANALYST] = permissionSet;
  }

  /**
   * Creates the Developer permission set with SystemAdministrator policy
   * and expanded write access
   */
  private createDeveloperPermissionSet(): void {
    const permissionSet = new sso.CfnPermissionSet(
      this,
      "DeveloperPermissionSet",
      {
        instanceArn: this.instanceArn,
        name: PermissionSetType.DEVELOPER,
        description:
          "System administrator access with expanded write permissions",
        sessionDuration: Duration.hours(8).toIsoString(),
        managedPolicies: [
          "arn:aws:iam::aws:policy/job-function/SystemAdministrator",
        ],
        inlinePolicy: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "cloudwatch:*",
                "logs:*",
                "lambda:*",
                "apigateway:*",
                "dynamodb:*",
                "s3:*",
                "sns:*",
                "sqs:*",
                "events:*",
                "ecr:*",
                "ecs:*",
                "codebuild:*",
              ],
              Resource: "*",
            },
            {
              Effect: "Deny",
              Action: [
                "iam:*User*",
                "iam:*Role*",
                "iam:*Policy*",
                "organizations:*",
                "account:*",
              ],
              Resource: "*",
            },
          ],
        },
      },
    );

    Tags.of(permissionSet).add(CDK.TAG.SERVICE, CDK.SERVICE.SSO);

    this.permissionSets[PermissionSetType.DEVELOPER] = permissionSet;
  }

  /**
   * Gets the permission set for the specified type
   */
  public getPermissionSet(type: PermissionSetType): sso.CfnPermissionSet {
    return this.permissionSets[type];
  }
}
