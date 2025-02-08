import { CDK } from "@jaypie/cdk";
import { describe, expect, it } from "vitest";
import { Stack, RemovalPolicy } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { JaypieQueuedLambda } from "../JaypieQueuedLambda";
import * as iam from "aws-cdk-lib/aws-iam";

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

  describe("IFunction Implementation", () => {
    it("implements IFunction by delegating to underlying lambda", () => {
      const stack = new Stack();
      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      // Test key IFunction properties
      expect(construct.functionArn).toBeDefined();
      expect(construct.functionName).toBeDefined();
      expect(construct.grantPrincipal).toBeDefined();
      expect(construct.role).toBeDefined();
      expect(construct.env).toEqual({
        account: stack.account,
        region: stack.region,
      });
      expect(construct.stack).toBe(stack);

      // Verify the function exists with expected properties
      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.handler",
        Runtime: "nodejs20.x",
      });
    });

    it("grants invoke permissions", () => {
      const stack = new Stack();
      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      // Create a role to test grantInvoke
      const role = new iam.Role(stack, "TestRole", {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      });

      // Grant invoke permissions
      construct.grantInvoke(role);

      const template = Template.fromStack(stack);

      // Verify the IAM policy was created with lambda:InvokeFunction permission
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: "lambda:InvokeFunction",
              Effect: "Allow",
              Resource: [{}, {}],
            }),
          ]),
        },
      });

      // Test assertions to satisfy linter
      expect(template).toBeDefined();
    });

    it("grants invoke permissions for latest version", () => {
      const stack = new Stack();
      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      // Create a role to test grantInvokeLatestVersion
      const role = new iam.Role(stack, "TestRole", {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      });

      // Grant invoke permissions for latest version
      construct.grantInvokeLatestVersion(role);

      const template = Template.fromStack(stack);

      // Verify the IAM policy was created with lambda:InvokeFunction permission
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: "lambda:InvokeFunction",
              Effect: "Allow",
              Resource: Match.anyValue(),
            }),
          ]),
        },
      });

      // Test assertions to satisfy linter
      expect(template).toBeDefined();
    });
  });

  describe("IQueue Implementation", () => {
    it("implements IQueue by delegating to underlying queue", () => {
      const stack = new Stack();
      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      // Test key IQueue properties
      expect(construct.fifo).toBe(true);
      expect(construct.queueArn).toBeDefined();
      expect(construct.queueName).toBeDefined();
      expect(construct.queueUrl).toBeDefined();
      expect(construct.env).toEqual({
        account: stack.account,
        region: stack.region,
      });
      expect(construct.stack).toBe(stack);

      // Verify the queue exists with expected properties
      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::SQS::Queue", {
        FifoQueue: true,
      });
    });

    it("grants queue permissions", () => {
      const stack = new Stack();
      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      // Create a role to test grants
      const role = new iam.Role(stack, "TestRole", {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      });

      // Test various queue permissions
      construct.grantConsumeMessages(role);
      construct.grantSendMessages(role);
      construct.grantPurge(role);

      const template = Template.fromStack(stack);

      // Verify the IAM policy was created with SQS permissions
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                "sqs:ReceiveMessage",
                "sqs:ChangeMessageVisibility",
                "sqs:GetQueueUrl",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes",
              ]),
              Effect: "Allow",
              Resource: {
                "Fn::GetAtt": [
                  Match.stringLikeRegexp("TestConstructQueue.*"),
                  "Arn",
                ],
              },
            }),
            Match.objectLike({
              Action: [
                "sqs:SendMessage",
                "sqs:GetQueueAttributes",
                "sqs:GetQueueUrl",
              ],
              Effect: "Allow",
              Resource: {
                "Fn::GetAtt": [
                  Match.stringLikeRegexp("TestConstructQueue.*"),
                  "Arn",
                ],
              },
            }),
            Match.objectLike({
              Action: [
                "sqs:PurgeQueue",
                "sqs:GetQueueAttributes",
                "sqs:GetQueueUrl",
              ],
              Effect: "Allow",
              Resource: {
                "Fn::GetAtt": [
                  Match.stringLikeRegexp("TestConstructQueue.*"),
                  "Arn",
                ],
              },
            }),
          ]),
        },
      });

      // Test assertions to satisfy linter
      expect(template).toBeDefined();
    });

    it("applies removal policy to both resources", () => {
      const stack = new Stack();
      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      construct.applyRemovalPolicy(RemovalPolicy.DESTROY);

      const template = Template.fromStack(stack);
      template.hasResource("AWS::Lambda::Function", {
        DeletionPolicy: "Delete",
      });
      template.hasResource("AWS::SQS::Queue", {
        DeletionPolicy: "Delete",
      });

      // Test assertions to satisfy linter
      expect(template).toBeDefined();
    });
  });
});
