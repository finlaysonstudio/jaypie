import { CDK } from "@jaypie/cdk";
import { describe, expect, it } from "vitest";
import { Stack, RemovalPolicy, Duration } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { JaypieQueuedLambda } from "../JaypieQueuedLambda.js";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { JaypieEnvSecret } from "../JaypieEnvSecret.js";

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
        roleTag: "TEST_ROLE",
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

    it("adds vendor tag when provided", () => {
      const stack = new Stack();
      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        vendorTag: "TEST_VENDOR",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::SQS::Queue", {
        Tags: [
          {
            Key: CDK.TAG.VENDOR,
            Value: "TEST_VENDOR",
          },
        ],
      });

      template.hasResourceProperties("AWS::Lambda::Function", {
        Tags: [
          {
            Key: CDK.TAG.VENDOR,
            Value: "TEST_VENDOR",
          },
        ],
      });
    });

    it("adds both role and vendor tags when provided", () => {
      const stack = new Stack();
      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        roleTag: "TEST_ROLE",
        vendorTag: "TEST_VENDOR",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::SQS::Queue", {
        Tags: Match.arrayWith([
          {
            Key: CDK.TAG.ROLE,
            Value: "TEST_ROLE",
          },
          {
            Key: CDK.TAG.VENDOR,
            Value: "TEST_VENDOR",
          },
        ]),
      });

      template.hasResourceProperties("AWS::Lambda::Function", {
        Tags: Match.arrayWith([
          {
            Key: CDK.TAG.ROLE,
            Value: "TEST_ROLE",
          },
          {
            Key: CDK.TAG.VENDOR,
            Value: "TEST_VENDOR",
          },
        ]),
      });
    });

    it("configures environment secrets", () => {
      const stack = new Stack();
      const testSecret = new secretsmanager.Secret(stack, "TestSecret", {
        secretName: "test/secret",
      });
      const testSecret2 = new secretsmanager.Secret(stack, "TestSecret2", {
        secretName: "test/secret2",
      });

      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        envSecrets: {
          VALUE_1: testSecret,
          VALUE_2: testSecret2,
        },
        handler: "index.handler",
      });

      const template = Template.fromStack(stack);

      // Verify environment variables are set
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: {
            SECRET_VALUE_1: Match.anyValue(),
            SECRET_VALUE_2: Match.anyValue(),
            APP_QUEUE_URL: Match.anyValue(),
          },
        },
      });

      // Verify IAM permissions are granted
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: [
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret",
              ],
              Effect: "Allow",
              Resource: {
                Ref: Match.stringLikeRegexp("TestSecret.*"),
              },
            }),
            Match.objectLike({
              Action: [
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret",
              ],
              Effect: "Allow",
              Resource: {
                Ref: Match.stringLikeRegexp("TestSecret2.*"),
              },
            }),
          ]),
        },
      });

      expect(construct).toBeDefined();
    });

    it("configures JaypieEnvSecrets", () => {
      const stack = new Stack();
      const testSecret = new JaypieEnvSecret(stack, "TestSecret", {
        envKey: "TEST_SECRET",
        value: "test-value",
      });
      const testSecret2 = new JaypieEnvSecret(stack, "TestSecret2", {
        envKey: "TEST_SECRET_2",
        value: "test-value-2",
      });

      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        secrets: [testSecret, testSecret2],
      });

      const template = Template.fromStack(stack);

      // Verify environment variables are set
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: {
            SECRET_TEST_SECRET: Match.anyValue(),
            SECRET_TEST_SECRET_2: Match.anyValue(),
            APP_QUEUE_URL: Match.anyValue(),
          },
        },
      });

      // Verify IAM permissions are granted
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: [
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret",
              ],
              Effect: "Allow",
              Resource: {
                Ref: Match.stringLikeRegexp("TestSecret.*"),
              },
            }),
            Match.objectLike({
              Action: [
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret",
              ],
              Effect: "Allow",
              Resource: {
                Ref: Match.stringLikeRegexp("TestSecret2.*"),
              },
            }),
          ]),
        },
      });

      expect(construct).toBeDefined();
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
            APP_QUEUE_URL: Match.anyValue(),
          },
        },
      });
    });

    it("configures FIFO queue by default", () => {
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

    it("allows configuring queue and lambda properties", () => {
      const stack = new Stack();
      const customVisibilityTimeout = Duration.seconds(300);
      const customTimeout = Duration.seconds(60);

      const construct = new JaypieQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        fifo: false,
        handler: "index.handler",
        logRetention: 7,
        memorySize: 256,
        reservedConcurrentExecutions: 5,
        runtime: lambda.Runtime.NODEJS_18_X,
        timeout: customTimeout,
        visibilityTimeout: customVisibilityTimeout,
      });

      const template = Template.fromStack(stack);

      // Verify queue configuration
      template.hasResourceProperties("AWS::SQS::Queue", {
        VisibilityTimeout: 300,
      });
      expect(
        Object.keys(template.findResources("AWS::SQS::Queue", {})).length,
      ).toBe(1);
      expect(
        Object.keys(
          template.findResources("AWS::SQS::Queue", {
            FifoQueue: true,
          }),
        ).length,
      ).toBe(0);

      // Verify lambda configuration
      template.hasResourceProperties("AWS::Lambda::Function", {
        MemorySize: 256,
        Runtime: "nodejs18.x",
        Timeout: 60,
        ReservedConcurrentExecutions: 5,
      });

      expect(construct).toBeDefined();
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
