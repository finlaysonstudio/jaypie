import { CDK } from "../constants";
import { describe, expect, it } from "vitest";
import { Stack, Duration } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { JaypieExpressLambda } from "../JaypieExpressLambda.js";

describe("JaypieExpressLambda", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieExpressLambda).toBeFunction();
    });

    it("creates required resources", () => {
      const stack = new Stack();
      const construct = new JaypieExpressLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResource("AWS::Lambda::Function", {});
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.handler",
      });
    });
  });

  describe("Features", () => {
    it("defaults timeout to EXPRESS_API duration", () => {
      const stack = new Stack();
      const construct = new JaypieExpressLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::Lambda::Function", {
        Timeout: CDK.DURATION.EXPRESS_API,
      });
    });

    it("defaults role tag to API role", () => {
      const stack = new Stack();
      const construct = new JaypieExpressLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::Lambda::Function", {
        Tags: [
          {
            Key: CDK.TAG.ROLE,
            Value: CDK.ROLE.API,
          },
        ],
      });
    });

    it("allows overriding default timeout", () => {
      const stack = new Stack();
      const customTimeout = Duration.seconds(60);
      const construct = new JaypieExpressLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        timeout: customTimeout,
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::Lambda::Function", {
        Timeout: 60,
      });
    });

    it("allows overriding default role tag", () => {
      const stack = new Stack();
      const construct = new JaypieExpressLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        roleTag: "CUSTOM_ROLE",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::Lambda::Function", {
        Tags: [
          {
            Key: CDK.TAG.ROLE,
            Value: "CUSTOM_ROLE",
          },
        ],
      });
    });

    it("inherits all JaypieLambda functionality", () => {
      const stack = new Stack();
      const construct = new JaypieExpressLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        environment: {
          TEST_VAR: "test-value",
        },
        handler: "index.handler",
        memorySize: 256,
        vendorTag: "TEST_VENDOR",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: {
            TEST_VAR: "test-value",
          },
        },
        Handler: "index.handler",
        MemorySize: 256,
        Tags: [
          {
            Key: CDK.TAG.ROLE,
            Value: CDK.ROLE.API,
          },
          {
            Key: CDK.TAG.VENDOR,
            Value: "TEST_VENDOR",
          },
        ],
        Timeout: CDK.DURATION.EXPRESS_API,
      });
    });
  });

  describe("Specific Scenarios", () => {
    it("has shorter default timeout than JaypieLambda", () => {
      expect(CDK.DURATION.EXPRESS_API).toBeLessThan(CDK.DURATION.LAMBDA_WORKER);
    });
  });
});
