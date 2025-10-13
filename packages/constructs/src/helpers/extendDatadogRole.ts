import { CDK } from "../constants";
import * as cdk from "aws-cdk-lib";
import { Policy, PolicyStatement, Role } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface ExtendDatadogRoleOptions {
  /**
   * Optional construct ID for the policy
   * @default "DatadogCustomPolicy"
   */
  id?: string;

  /**
   * The service tag value
   * @default CDK.SERVICE.DATADOG
   */
  service?: string;

  /**
   * Optional project tag value
   */
  project?: string;
}

/**
 * Extends the Datadog IAM role with additional permissions
 *
 * Checks for CDK_ENV_DATADOG_ROLE_ARN environment variable.
 * If found, creates a custom policy with:
 * - budgets:ViewBudget
 * - logs:DescribeLogGroups
 *
 * @param scope - The construct scope
 * @param options - Configuration options
 * @returns The created Policy, or undefined if CDK_ENV_DATADOG_ROLE_ARN is not set
 */
export function extendDatadogRole(
  scope: Construct,
  options?: ExtendDatadogRoleOptions,
): Policy | undefined {
  const datadogRoleArn = process.env.CDK_ENV_DATADOG_ROLE_ARN;

  // Early return if no Datadog role ARN is configured
  if (!datadogRoleArn) {
    return undefined;
  }

  const {
    id = "DatadogCustomPolicy",
    project,
    service = CDK.SERVICE.DATADOG,
  } = options || {};

  // Lookup the Datadog role
  const datadogRole = Role.fromRoleArn(scope, "DatadogRole", datadogRoleArn);

  // Build policy statements
  const statements: PolicyStatement[] = [
    // Allow view budget
    new PolicyStatement({
      actions: ["budgets:ViewBudget"],
      resources: ["*"],
    }),
    // Allow describe log groups
    new PolicyStatement({
      actions: ["logs:DescribeLogGroups"],
      resources: ["*"],
    }),
  ];

  // Create the custom policy
  const datadogCustomPolicy = new Policy(scope, id, {
    roles: [datadogRole],
    statements,
  });

  // Add tags
  cdk.Tags.of(datadogCustomPolicy).add(CDK.TAG.SERVICE, service);
  cdk.Tags.of(datadogCustomPolicy).add(CDK.TAG.ROLE, CDK.ROLE.MONITORING);
  cdk.Tags.of(datadogCustomPolicy).add(CDK.TAG.VENDOR, CDK.VENDOR.DATADOG);
  if (project) {
    cdk.Tags.of(datadogCustomPolicy).add(CDK.TAG.PROJECT, project);
  }

  return datadogCustomPolicy;
}
