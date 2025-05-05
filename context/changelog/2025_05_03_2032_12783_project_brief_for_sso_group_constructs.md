# Project Brief for SSO Group Constructs

I would like to add a new constructs to ./packages/constructs

packages/constructs/src/JaypieSsoGroups.ts

That can be used like this:

```typescript
import { JaypieSsoGroups } from "@jaypie/constructs";

const ssoGroups = new JaypieSsoGroups(this, id, {
  instanceArn,
  accountMap: {
    development: [""], // Amazon account id strings
    management: [],
    operations: [],
    production: [],
    sandbox: [],
    security: [],
    stage: [],
  },
  groupMap: {
    administrators: "", // Google Workspace group GUID strings
    analysts: "",
    developers: "",
  }
  // ...any other things we will need
})
```

## ↔️ Guidance

### Out of Scope

* Do not add the ability to customize group properties like description, session duration, and tags
* Do not add the ability to extend or override default groups (allow for future optionality)
* Do not add the ability to extend or override group managedPolicies or inlinePolicyStatements (allow for future optionality)

## 🖇️ Context

### Sample Client Code without Construct

```typescript
import { CDK } from "@jaypie/cdk";
import * as cdk from "aws-cdk-lib";
import { ManagedPolicy, Policy, PolicyStatement, Role } from "aws-cdk-lib/aws-iam";
import { CfnAssignment, CfnPermissionSet } from "aws-cdk-lib/aws-sso";
import { Construct } from "constructs";

import { ACCOUNT_ID } from "./constants";

//
//
// Constants
//

const CONFIG = {
  SSO: {
    GROUP: {
      ADMINISTRATORS: "c4f87458-e021-7053-669c-4dc2a2ceaadf", // Google Workspace group GUID
      ANALYSTS: "949844c8-60b1-7046-0328-9ad0806336f1", // Google Workspace group GUID
      DEVELOPERS: "5488a468-5031-7001-64d6-9ba1f377ee6d", // Google Workspace group GUID
    } as {
      [key: string]: string;
    },
  },
  TTL: cdk.Duration.minutes(5),
} as const;

//
//
// Interfaces
//

interface ManagementAccountConfig {
  account: string;
  datadog: {
    forwarderRole: string;
    integrationRole: string;
  };
  iamIdentityCenterArn: string;
}

interface AccountStackProps extends cdk.StackProps {
  env: {
    account: string;
    region: string;
  };
  stackName: string;
}

//
//
// Class
//

/**
 * This account stack is deployed by bin/cdk.js
 * The scope is the CDK App
 * The id is the stack name (e.g., "ManagementAccountStack")
 * The props should include:
 * - env: { account, region }
 * - stackName: `cdk-...-${nonce}`
 */
export default class ManagementAccountStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: AccountStackProps = {
      env: { account: "", region: "" },
      stackName: "cdk-UNKNOWN",
    },
  ) {
    super(scope, id, props);

    //
    //
    // Setup
    //

    const output: { [key: string]: string } = {};

    // * Convert all CDK_ENV vars to local instances
    // * Do not use CDK_ENV vars past this section

    const config: ManagementAccountConfig = {
      datadog: {
        forwarderRole: process.env.CDK_ENV_DATADOG_FORWARDER_ARN ?? "",
        integrationRole:
          process.env.CDK_ENV_DATADOG_INTEGRATION_ROLE_ARN ??
          `arn:aws:sts::${props?.env?.account}:assumed-role/DatadogIntegrationRole`,
      },
      account: process.env.CDK_ENV_ACCOUNT ?? "unknown",
      iamIdentityCenterArn: process.env.CDK_ENV_IAM_IDENTITY_CENTER_ARN ?? "",
    };

    // * Do not use CDK_ENV vars past this point

    //
    //
    // Datadog: Role Extras
    //

    if (config.datadog.integrationRole) {
      // Lookup the role
      const datadogRole = Role.fromRoleArn(this, "DatadogRole", config.datadog.integrationRole);

      // Special policy for extra permissions specific to management account
      const datadogCustomPolicy = new Policy(this, "DatadogCustomPolicy", {
        statements: [
          // Allow view budget
          new PolicyStatement({
            actions: ["budgets:Describe*", "budgets:View*"],
            resources: ["*"],
          }),
        ],
        roles: [datadogRole],
      });
      cdk.Tags.of(datadogCustomPolicy).add(CDK.TAG.SERVICE, CDK.SERVICE.DATADOG);
      cdk.Tags.of(datadogCustomPolicy).add(CDK.TAG.ROLE, CDK.ROLE.MONITORING);
      cdk.Tags.of(datadogCustomPolicy).add(CDK.TAG.SERVICE, CDK.VENDOR.DATADOG);
      cdk.Tags.of(datadogCustomPolicy).add(CDK.TAG.VENDOR, CDK.VENDOR.DATADOG);
    }

    //
    //
    // SSO: Permission Sets
    //

    let ssoGroupAssignments;
    if (config.iamIdentityCenterArn) {
      const administratorPermissionSet = new CfnPermissionSet(this, "AdministratorPermissionSet", {
        // Required
        instanceArn: config.iamIdentityCenterArn,
        name: "Administrator",

        // Optional
        description: "Unrestricted access",
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess").managedPolicyArn,
        ],
        // customerManagedPolicyReferences: // To attach company policies
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
        sessionDuration: "PT30M", // 30 minutes, ISO_8601#Durations format
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
      output.administratorPermissionSetArn = administratorPermissionSet.attrPermissionSetArn;

      const analystPermissionSet = new CfnPermissionSet(this, "AnalystPermissionSet", {
        // Required
        instanceArn: config.iamIdentityCenterArn,
        name: "Analyst",

        // Optional
        description: "Read-only access; may expand to limited write access",
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName("AmazonQDeveloperAccess").managedPolicyArn,
          ManagedPolicy.fromAwsManagedPolicyName("ReadOnlyAccess").managedPolicyArn,
        ],
        // customerManagedPolicyReferences: // To attach company policies
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
                "xray:*",
              ],
              Resource: "*",
            },
          ],
        },
        sessionDuration: "PT12H", // 12 hours, ISO_8601#Durations format
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
      output.analystPermissionSet = analystPermissionSet.attrPermissionSetArn;

      const developerPermissionSet = new CfnPermissionSet(this, "DeveloperPermissionSet", {
        // Required
        instanceArn: config.iamIdentityCenterArn,
        name: "Developer",

        // Optional
        description: "Administrative access with limited restrictions",
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName("AmazonQDeveloperAccess").managedPolicyArn,
          ManagedPolicy.fromAwsManagedPolicyName("ReadOnlyAccess").managedPolicyArn,
          ManagedPolicy.fromAwsManagedPolicyName("job-function/SystemAdministrator")
            .managedPolicyArn,
        ],
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
                "xray:*",
              ],
              Resource: "*",
            },
          ],
        },
        sessionDuration: "PT4H",
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
      output.developerPermissionSetArn = developerPermissionSet.attrPermissionSetArn;

      // Convenience Variables
      const administratorSet = {
        arn: administratorPermissionSet.attrPermissionSetArn,
        label: "Administrator", // CamelCase AWS resource names
      };
      const analystSet = {
        arn: analystPermissionSet.attrPermissionSetArn,
        label: "Analyst", // CamelCase AWS resource names
      };

      const developerSet = {
        arn: developerPermissionSet.attrPermissionSetArn,
        label: "Developer", // CamelCase AWS resource names
      };

      // Assign permission sets to groups
      // Each key is a GUID for a group in IAM Identity Center
      // Each value is an object with account IDs as keys and permission set ARNs as values
      ssoGroupAssignments = {
        // Group "AWS Administrators" in Google Workspace
        ADMINISTRATORS: {
          [CDK.ACCOUNT_ID.DEVELOPMENT]: [
            administratorSet,
            analystSet,
            developerSet,
          ],
          [CDK.ACCOUNT_ID.MANAGEMENT]: [administratorSet, analystSet],
          [CDK.ACCOUNT_ID.OPERATIONS]: [
            administratorSet,
            analystSet,
            developerSet,
          ],
          [CDK.ACCOUNT_ID.PRODUCTION]: [administratorSet, analystSet],
          [CDK.ACCOUNT_ID.STAGE]: [administratorSet, analystSet, developerSet],
          [CDK.ACCOUNT_ID.SECURITY]: [administratorSet, analystSet],
          [CDK.ACCOUNT_ID.SANDBOX]: [
            administratorSet,
            analystSet,
            developerSet,
          ],
        },
        // Group "AWS Analysts" in Google Workspace
        ANALYSTS: {
          [CDK.ACCOUNT_ID.DEVELOPMENT]: [analystSet],
          [CDK.ACCOUNT_ID.MANAGEMENT]: [], // Intentionally empty
          [CDK.ACCOUNT_ID.OPERATIONS]: [analystSet],
          [CDK.ACCOUNT_ID.PRODUCTION]: [analystSet],
          [CDK.ACCOUNT_ID.STAGE]: [analystSet],
          [CDK.ACCOUNT_ID.SECURITY]: [], // Intentionally empty
          [CDK.ACCOUNT_ID.SANDBOX]: [
            administratorSet,
            analystSet,
            developerSet,
          ],
        },
        // Group "AWS Developers" in Google Workspace
        DEVELOPERS: {
          [CDK.ACCOUNT_ID.DEVELOPMENT]: [
            administratorSet,
            analystSet,
            developerSet,
          ],
          [CDK.ACCOUNT_ID.MANAGEMENT]: [], // Intentionally empty
          [CDK.ACCOUNT_ID.OPERATIONS]: [analystSet, developerSet],
          [CDK.ACCOUNT_ID.PRODUCTION]: [analystSet],
          [CDK.ACCOUNT_ID.STAGE]: [analystSet, developerSet],
          [CDK.ACCOUNT_ID.SECURITY]: [], // Intentionally empty
          [CDK.ACCOUNT_ID.SANDBOX]: [
            administratorSet,
            analystSet,
            developerSet,
          ],
        },
      };
    }

    //
    //
    // SSO: Account-Group-PermissionSet Assignments
    //

    // Apply permissions defined above
    if (ssoGroupAssignments && config.iamIdentityCenterArn !== undefined) {
      // Define a type for permission sets
      type PermissionSet = {
        arn: string;
        label: string;
      };

      // Loop over each { groupGuid: { accountId: [ { arn, label } ] } }
      Object.keys(ssoGroupAssignments).forEach((groupKey) => {
        const groupGuid = CONFIG.SSO.GROUP[groupKey];
        // Loop over each account
        Object.keys(ssoGroupAssignments[groupKey]).forEach((accountId) => {
          // Explicitly type the permissionSet parameter
          ssoGroupAssignments[groupKey][accountId].forEach((permissionSet: PermissionSet) => {
            // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_sso.CfnAccountAssignment.html
            // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-sso-accountassignment.html
            const accountAssignment = new CfnAssignment(
              this,
              `AccountAssignment-${accountId}-${permissionSet.label}Role-${CONFIG.SSO.GROUP[groupKey]}Group`,
              {
                // Required
                instanceArn: config.iamIdentityCenterArn || "",
                permissionSetArn: permissionSet.arn,
                principalId: groupGuid,
                principalType: CDK.PRINCIPAL_TYPE.GROUP,
                targetId: accountId,
                targetType: CDK.TARGET_TYPE.AWS_ACCOUNT,
                // Optional
                // N/A
              },
            );
            cdk.Tags.of(accountAssignment).add(CDK.TAG.SERVICE, CDK.SERVICE.SSO);
            cdk.Tags.of(accountAssignment).add(CDK.TAG.ROLE, CDK.ROLE.SECURITY);
          });
        });
      });
    }
  }
}
```

### Sample Client Code with New Construct

```typescript
import { JaypieSsoGroups } from "@jaypie/constructs";

const ssoGroups = new JaypieSsoGroups(this, id, {
  instanceArn,
  accountMap: {
    development: [""], // Amazon account id strings
    management: [],
    operations: [],
    production: [],
    sandbox: [],
    security: [],
    stage: [],
  },
  groupMap: {
    administrators: "", // Google Workspace group GUID strings
    analysts: "",
    developers: "",
  }
  // ...any other things we will need
})
```