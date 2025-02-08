import { CDK } from "@jaypie/cdk";
import { describe, expect, it } from "vitest";
import { Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { JaypieQueuedLambda } from "../JaypieQueuedLambda";

describe("JaypieQueuedLambda", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieQueuedLambda).toBeFunction();
    });

    it("creates required resources", () => {
      const stack = new Stack();
      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResource("AWS::SQS::Queue", {});
      template.hasResource("AWS::Lambda::Function", {});
      template.hasResourceProperties("AWS::SQS::Queue", {
        FifoQueue: true,
      });
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.handler",
        Runtime: "nodejs20.x",
      });
    });
  });

  describe("Features", () => {
    it("adds role tag when provided", () => {
      const stack = new Stack();
      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        role: "TEST_ROLE",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::SQS::Queue", {
        Tags: [
          {
            Key: CDK.TAG.ROLE,
            Value: "TEST_ROLE",
          },
        ],
      });

      template.hasResourceProperties("AWS::Lambda::Function", {
        Tags: [
          {
            Key: CDK.TAG.ROLE,
            Value: "TEST_ROLE",
          },
        ],
      });
    });

    it("sets environment variables", () => {
      const stack = new Stack();
      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        environment: {
          TEST_VAR: "test-value",
        },
        handler: "index.handler",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: {
            TEST_VAR: "test-value",
            APP_JOB_QUEUE_URL: {},
          },
        },
      });
    });

    it("configures FIFO queue", () => {
      const stack = new Stack();
      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.resourceCountIs("AWS::SQS::Queue", 1);
      template.hasResourceProperties("AWS::SQS::Queue", {
        FifoQueue: true,
      });
    });
  });
});
