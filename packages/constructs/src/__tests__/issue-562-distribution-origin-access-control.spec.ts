import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Stack } from "aws-cdk-lib";
import { Annotations, Match, Template } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";

import { JaypieDistribution } from "../JaypieDistribution";

//
//
// Helpers
//

interface PermissionProperties {
  Action: string;
  InvokedViaFunctionUrl?: boolean;
  Principal: string;
}

function functionUrlAuthTypes(template: Template): string[] {
  return Object.values(template.findResources("AWS::Lambda::Url")).map(
    (resource) =>
      (resource as { Properties: { AuthType: string } }).Properties.AuthType,
  );
}

function originAccessControlCount(template: Template): number {
  return Object.keys(
    template.findResources("AWS::CloudFront::OriginAccessControl"),
  ).length;
}

function permissions(
  template: Template,
  { principal }: { principal: string },
): PermissionProperties[] {
  return Object.values(template.findResources("AWS::Lambda::Permission"))
    .map(
      (resource) =>
        (resource as { Properties: PermissionProperties }).Properties,
    )
    .filter((properties) => properties.Principal === principal);
}

function synthDistribution({
  originAccessControl,
}: { originAccessControl?: boolean } = {}) {
  const stack = new Stack();
  const handler = new lambda.Function(stack, "TestFunction", {
    code: lambda.Code.fromInline("exports.handler = () => {}"),
    handler: "index.handler",
    runtime: lambda.Runtime.NODEJS_22_X,
  });
  new JaypieDistribution(stack, "TestDistribution", {
    handler,
    ...(originAccessControl === undefined ? {} : { originAccessControl }),
  });
  return Template.fromStack(stack);
}

//
//
// Tests
//

describe("Issue #562: JaypieDistribution origin access control", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.CDK_ENV_API_HOST_NAME;
    delete process.env.CDK_ENV_API_HOSTED_ZONE;
    delete process.env.CDK_ENV_API_SUBDOMAIN;
    delete process.env.CDK_ENV_HOSTED_ZONE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Backward compatibility", () => {
    it("creates an unauthenticated Function URL by default", () => {
      const template = synthDistribution();
      expect(functionUrlAuthTypes(template)).toEqual(["NONE"]);
      expect(originAccessControlCount(template)).toBe(0);
    });

    it("creates an unauthenticated Function URL when explicitly false", () => {
      const template = synthDistribution({ originAccessControl: false });
      expect(functionUrlAuthTypes(template)).toEqual(["NONE"]);
    });
  });

  describe("Features", () => {
    it("creates an AWS_IAM Function URL when originAccessControl is true", () => {
      const template = synthDistribution({ originAccessControl: true });
      expect(functionUrlAuthTypes(template)).toEqual(["AWS_IAM"]);
    });

    it("creates a CloudFront origin access control", () => {
      const template = synthDistribution({ originAccessControl: true });
      expect(originAccessControlCount(template)).toBe(1);
    });

    it("grants CloudFront both invoke permissions", () => {
      const template = synthDistribution({ originAccessControl: true });
      const actions = permissions(template, {
        principal: "cloudfront.amazonaws.com",
      }).map((properties) => properties.Action);
      expect(actions).toContain("lambda:InvokeFunction");
      expect(actions).toContain("lambda:InvokeFunctionUrl");
    });

    it("marks the InvokeFunction permission as invoked via the function URL", () => {
      const template = synthDistribution({ originAccessControl: true });
      const invokeFunction = permissions(template, {
        principal: "cloudfront.amazonaws.com",
      }).filter((properties) => properties.Action === "lambda:InvokeFunction");
      expect(invokeFunction).toHaveLength(1);
      expect(invokeFunction[0].InvokedViaFunctionUrl).toBe(true);
    });

    it("grants no wildcard principal any invoke permission", () => {
      const template = synthDistribution({ originAccessControl: true });
      expect(permissions(template, { principal: "*" })).toHaveLength(0);
    });
  });

  describe("Observability", () => {
    it("warns when originAccessControl is set with a non-IFunction handler", () => {
      const stack = new Stack();
      const origin = new origins.HttpOrigin("example.com");
      new JaypieDistribution(stack, "TestDistribution", {
        handler: origin,
        originAccessControl: true,
      });
      expect(
        Annotations.fromStack(stack).findWarning(
          "*",
          Match.stringLikeRegexp("originAccessControl applies only"),
        ),
      ).toHaveLength(1);
    });

    it("emits no warning when originAccessControl is set with an IFunction handler", () => {
      const stack = new Stack();
      const handler = new lambda.Function(stack, "TestFunction", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_22_X,
      });
      new JaypieDistribution(stack, "TestDistribution", {
        handler,
        originAccessControl: true,
      });
      expect(
        Annotations.fromStack(stack).findWarning(
          "*",
          Match.stringLikeRegexp("originAccessControl applies only"),
        ),
      ).toHaveLength(0);
    });
  });
});
