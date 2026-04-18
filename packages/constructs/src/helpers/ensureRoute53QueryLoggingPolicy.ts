import { Stack } from "aws-cdk-lib";
import { CfnResourcePolicy } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

const SINGLETON_ID = "JaypieRoute53QueryLoggingPolicy";
const ROUTE53_LOG_GROUP_PREFIX = "/aws/route53";
const ROUTE53_SERVICE_PRINCIPAL = "route53.amazonaws.com";

/**
 * Create (or return the existing) stack-level CloudWatch Logs resource policy
 * that grants Route53 permission to write query logs to any `/aws/route53/*`
 * log group in the stack's account and region.
 *
 * Consolidates what would otherwise be one `AWS::Logs::ResourcePolicy` per
 * hosted zone into a single wildcard policy, keeping the stack well clear of
 * the 10-resource-policy-per-region account quota.
 */
export function ensureRoute53QueryLoggingPolicy(
  scope: Construct,
): CfnResourcePolicy {
  const stack = Stack.of(scope);
  const existing = stack.node.tryFindChild(SINGLETON_ID);
  if (existing) return existing as CfnResourcePolicy;

  const policyDocument = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: ROUTE53_SERVICE_PRINCIPAL },
        Action: ["logs:CreateLogStream", "logs:PutLogEvents"],
        Resource: `arn:${stack.partition}:logs:${stack.region}:${stack.account}:log-group:${ROUTE53_LOG_GROUP_PREFIX}/*:*`,
      },
    ],
  };

  return new CfnResourcePolicy(stack, SINGLETON_ID, {
    policyName: `${stack.stackName}-Route53QueryLogging`,
    policyDocument: JSON.stringify(policyDocument),
  });
}
