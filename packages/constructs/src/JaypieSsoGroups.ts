import { Construct } from "constructs";
import { Tags, Duration } from "aws-cdk-lib";
import * as sso from "aws-cdk-lib/aws-sso";
import { CDK } from "@jaypie/cdk";
import { ManagedPolicy } from "aws-cdk-lib/aws-iam";

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
 * IAM Policy Statement structure for inline policies
 */
export interface PolicyStatement {
  Effect: "Allow" | "Deny";
  Action: string[] | string;
  Resource: string[] | string;
  Condition?: Record<string, unknown>;
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

  /**
   * Additional inline policy statements to append to each group's permission set
   * Each group can have its own set of policy statements that will be merged
   * with the default policies.
   */
  inlinePolicyStatements?: {
    administrators?: PolicyStatement[];
    analysts?: PolicyStatement[];
    developers?: PolicyStatement[];
  };
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
  private readonly props: JaypieSsoGroupsProps;

  constructor(scope: Construct, id: string, props: JaypieSsoGroupsProps) {
    super(scope, id);

    this.instanceArn = props.instanceArn;
    this.props = props;

    // Create the permission sets
    this.createAdministratorPermissionSet();
    this.createAnalystPermissionSet();
    this.createDeveloperPermissionSet();

    // Create the assignments
    this.createPermissionSetAssignments(props);
  }

  /**
   * Creates the Administrator permission set with AdministratorAccess policy
   * and billing access
   */
  private createAdministratorPermissionSet(): void {
    const defaultInlinePolicy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: [
            "aws-portal:*",
            "budgets:*",
            "ce:*",
            "cost-optimization-hub:*",
            "cur:*",
          ],
          Resource: "*",
        },
      ],
    };

    // Merge with any additional policy statements provided for administrators
    const mergedPolicy = this.mergeInlinePolicies(
      defaultInlinePolicy,
      this.props?.inlinePolicyStatements?.administrators,
    );

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
        inlinePolicy: mergedPolicy,
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
    const defaultInlinePolicy = {
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
            "xray:*",
          ],
          Resource: "*",
        },
      ],
    };

    // Merge with any additional policy statements provided for analysts
    const mergedPolicy = this.mergeInlinePolicies(
      defaultInlinePolicy,
      this.props?.inlinePolicyStatements?.analysts,
    );

    const permissionSet = new sso.CfnPermissionSet(
      this,
      "AnalystPermissionSet",
      {
        instanceArn: this.instanceArn,
        name: PermissionSetType.ANALYST,
        description:
          "Read-only access with billing visibility and limited write access",
        sessionDuration: Duration.hours(4).toIsoString(),
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName("AmazonQDeveloperAccess")
            .managedPolicyArn,
          ManagedPolicy.fromAwsManagedPolicyName("ReadOnlyAccess")
            .managedPolicyArn,
        ],
        inlinePolicy: mergedPolicy,
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
    const defaultInlinePolicy = {
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
            "xray:*",
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
    };

    // Merge with any additional policy statements provided for developers
    const mergedPolicy = this.mergeInlinePolicies(
      defaultInlinePolicy,
      this.props?.inlinePolicyStatements?.developers,
    );

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
          ManagedPolicy.fromAwsManagedPolicyName("AmazonQDeveloperAccess")
            .managedPolicyArn,
          ManagedPolicy.fromAwsManagedPolicyName("ReadOnlyAccess")
            .managedPolicyArn,
          ManagedPolicy.fromAwsManagedPolicyName(
            "job-function/SystemAdministrator",
          ).managedPolicyArn,
        ],
        inlinePolicy: mergedPolicy,
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

  /**
   * Merges default inline policies with additional user-provided policy statements
   *
   * @param defaultPolicy - The default policy object with Version and Statement properties
   * @param additionalStatements - Optional additional policy statements to merge
   * @returns The merged policy object
   */
  private mergeInlinePolicies(
    defaultPolicy: Record<string, unknown>,
    additionalStatements?: PolicyStatement[],
  ): Record<string, unknown> {
    if (!additionalStatements || additionalStatements.length === 0) {
      return defaultPolicy;
    }

    // Create a deep copy of the default policy to avoid modifying the original
    const mergedPolicy = JSON.parse(JSON.stringify(defaultPolicy));

    // Add the additional statements to the existing statements
    mergedPolicy.Statement = [
      ...mergedPolicy.Statement,
      ...additionalStatements,
    ];

    return mergedPolicy;
  }

  /**
   * Creates assignments between permission sets, groups, and accounts
   * based on the provided configuration
   */
  private createPermissionSetAssignments(props: JaypieSsoGroupsProps): void {
    // Administrator assignments
    this.assignAdministratorPermissions(props);

    // Analyst assignments
    this.assignAnalystPermissions(props);

    // Developer assignments
    this.assignDeveloperPermissions(props);
  }

  /**
   * Assigns Administrator permissions to appropriate accounts
   */
  private assignAdministratorPermissions(props: JaypieSsoGroupsProps): void {
    const administratorGroup = props.groupMap.administrators;
    const administratorPermissionSet =
      this.permissionSets[PermissionSetType.ADMINISTRATOR];

    // Administrators get access to all accounts
    const allAccounts = [
      ...props.accountMap.development,
      ...props.accountMap.management,
      ...props.accountMap.operations,
      ...props.accountMap.production,
      ...props.accountMap.sandbox,
      ...props.accountMap.security,
      ...props.accountMap.stage,
    ];

    // Create assignments for each account
    allAccounts.forEach((accountId, index) => {
      const assignment = new sso.CfnAssignment(
        this,
        `AdministratorAssignment${index}`,
        {
          instanceArn: this.instanceArn,
          permissionSetArn: administratorPermissionSet.attrPermissionSetArn,
          principalId: administratorGroup,
          principalType: "GROUP",
          targetId: accountId,
          targetType: "AWS_ACCOUNT",
        },
      );

      Tags.of(assignment).add(CDK.TAG.SERVICE, CDK.SERVICE.SSO);
      Tags.of(assignment).add("Group", "administrators");
    });
  }

  /**
   * Assigns Analyst permissions to appropriate accounts
   */
  private assignAnalystPermissions(props: JaypieSsoGroupsProps): void {
    const analystGroup = props.groupMap.analysts;
    const analystPermissionSet = this.permissionSets[PermissionSetType.ANALYST];

    // Analysts get access to development, management, sandbox, and stage accounts
    const analystAccounts = [
      ...props.accountMap.development,
      ...props.accountMap.management,
      ...props.accountMap.sandbox,
      ...props.accountMap.stage,
    ];

    // Create assignments for each account
    analystAccounts.forEach((accountId, index) => {
      const assignment = new sso.CfnAssignment(
        this,
        `AnalystAssignment${index}`,
        {
          instanceArn: this.instanceArn,
          permissionSetArn: analystPermissionSet.attrPermissionSetArn,
          principalId: analystGroup,
          principalType: "GROUP",
          targetId: accountId,
          targetType: "AWS_ACCOUNT",
        },
      );

      Tags.of(assignment).add(CDK.TAG.SERVICE, CDK.SERVICE.SSO);
      Tags.of(assignment).add("Group", "analysts");
    });
  }

  /**
   * Assigns Developer permissions to appropriate accounts
   */
  private assignDeveloperPermissions(props: JaypieSsoGroupsProps): void {
    const developerGroup = props.groupMap.developers;
    const developerPermissionSet =
      this.permissionSets[PermissionSetType.DEVELOPER];

    // Developers get access to development, sandbox, and stage accounts
    const developerAccounts = [
      ...props.accountMap.development,
      ...props.accountMap.sandbox,
      ...props.accountMap.stage,
    ];

    // Create assignments for each account
    developerAccounts.forEach((accountId, index) => {
      const assignment = new sso.CfnAssignment(
        this,
        `DeveloperAssignment${index}`,
        {
          instanceArn: this.instanceArn,
          permissionSetArn: developerPermissionSet.attrPermissionSetArn,
          principalId: developerGroup,
          principalType: "GROUP",
          targetId: accountId,
          targetType: "AWS_ACCOUNT",
        },
      );

      Tags.of(assignment).add(CDK.TAG.SERVICE, CDK.SERVICE.SSO);
      Tags.of(assignment).add("Group", "developers");
    });
  }
}
