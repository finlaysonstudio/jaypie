import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { JaypieApiGateway } from "../JaypieApiGateway";

describe("JaypieApiGateway", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant environment variables before each test
    delete process.env.CDK_ENV_API_HOST_NAME;
    delete process.env.CDK_ENV_API_HOSTED_ZONE;
    delete process.env.CDK_ENV_API_SUBDOMAIN;
    delete process.env.CDK_ENV_HOSTED_ZONE;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieApiGateway).toBeFunction();
    });

    it("creates required resources with Lambda handler", () => {
      const stack = new Stack();
      const fn = new lambda.Function(stack, "TestFunction", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_20_X,
      });

      const construct = new JaypieApiGateway(stack, "TestApiGateway", {
        handler: fn,
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResource("AWS::ApiGateway::RestApi", {});
    });
  });

  describe("Features", () => {
    it("sets PROJECT_BASE_URL on Lambda function when host is provided", () => {
      const stack = new Stack();
      const fn = new lambda.Function(stack, "TestFunction", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_20_X,
      });

      new JaypieApiGateway(stack, "TestApiGateway", {
        handler: fn,
        host: "api.example.com",
      });
      const template = Template.fromStack(stack);

      // Verify the Lambda function has PROJECT_BASE_URL set
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: {
            PROJECT_BASE_URL: "https://api.example.com",
          },
        },
      });
    });

    it("does not set PROJECT_BASE_URL when host is not provided", () => {
      const stack = new Stack();
      const fn = new lambda.Function(stack, "TestFunction", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_20_X,
      });

      new JaypieApiGateway(stack, "TestApiGateway", {
        handler: fn,
      });
      const template = Template.fromStack(stack);

      // Verify the Lambda function does NOT have PROJECT_BASE_URL
      const lambdaFunctions = template.findResources("AWS::Lambda::Function");
      const lambdaProps = Object.values(lambdaFunctions)[0]?.Properties;
      expect(
        lambdaProps?.Environment?.Variables?.PROJECT_BASE_URL,
      ).toBeUndefined();
    });

    it("sets PROJECT_BASE_URL from environment variables", () => {
      process.env.CDK_ENV_API_HOST_NAME = "env-api.example.com";

      const stack = new Stack();
      const fn = new lambda.Function(stack, "TestFunction", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_20_X,
      });

      new JaypieApiGateway(stack, "TestApiGateway", {
        handler: fn,
      });
      const template = Template.fromStack(stack);

      // Verify the Lambda function has PROJECT_BASE_URL set from env
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: {
            PROJECT_BASE_URL: "https://env-api.example.com",
          },
        },
      });
    });
  });
});
