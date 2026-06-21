import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extendDatadogRole } from "../extendDatadogRole.js";

const DATADOG_ROLE_ARN =
  "arn:aws:iam::123456789012:role/DatadogIntegrationRole";

describe("extendDatadogRole", () => {
  let originalRoleArn: string | undefined;

  beforeEach(() => {
    originalRoleArn = process.env.CDK_ENV_DATADOG_ROLE_ARN;
  });

  afterEach(() => {
    if (originalRoleArn === undefined) {
      delete process.env.CDK_ENV_DATADOG_ROLE_ARN;
    } else {
      process.env.CDK_ENV_DATADOG_ROLE_ARN = originalRoleArn;
    }
  });

  describe("Base Cases", () => {
    it("returns undefined when CDK_ENV_DATADOG_ROLE_ARN is not set", () => {
      delete process.env.CDK_ENV_DATADOG_ROLE_ARN;
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");

      expect(extendDatadogRole(stack)).toBeUndefined();
    });

    it("creates a policy when CDK_ENV_DATADOG_ROLE_ARN is set", () => {
      process.env.CDK_ENV_DATADOG_ROLE_ARN = DATADOG_ROLE_ARN;
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");

      expect(extendDatadogRole(stack)).toBeDefined();
    });
  });

  describe("Happy Paths", () => {
    it("grants the expected Datadog read permissions", () => {
      process.env.CDK_ENV_DATADOG_ROLE_ARN = DATADOG_ROLE_ARN;
      const app = new cdk.App();
      const stack = new cdk.Stack(app, "TestStack");

      extendDatadogRole(stack);

      const template = Template.fromStack(stack);
      expect(() =>
        template.hasResourceProperties("AWS::IAM::Policy", {
          PolicyDocument: {
            Statement: [
              { Action: "budgets:ViewBudget", Effect: "Allow", Resource: "*" },
              {
                Action: "logs:DescribeLogGroups",
                Effect: "Allow",
                Resource: "*",
              },
              {
                Action: "trustedadvisor:ListRecommendations",
                Effect: "Allow",
                Resource: "*",
              },
            ],
          },
        }),
      ).not.toThrow();
    });
  });
});
