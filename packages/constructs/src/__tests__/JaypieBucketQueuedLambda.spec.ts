import { CDK } from "@jaypie/cdk";
import { describe, expect, it } from "vitest";
import { Stack, RemovalPolicy, Duration } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { JaypieBucketQueuedLambda } from "../JaypieBucketQueuedLambda.js";
import { JaypieEnvSecret } from "../JaypieEnvSecret.js";

describe("JaypieBucketQueuedLambda", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieBucketQueuedLambda).toBeFunction();
    });

    it("creates required resources", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResource("AWS::SQS::Queue", {});
      template.hasResource("AWS::Lambda::Function", {});
      template.hasResource("AWS::S3::Bucket", {});
      template.hasResourceProperties("AWS::SQS::Queue", {
        FifoQueue: true,
      });
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.handler",
        Runtime: "nodejs20.x",
      });
      template.hasResourceProperties("AWS::S3::Bucket", {
        VersioningConfiguration: {
          Status: "Suspended",
        },
      });
    });
  });

  describe("Features", () => {
    it("adds role tag to all resources when provided", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
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

      template.hasResourceProperties("AWS::S3::Bucket", {
        Tags: [
          {
            Key: CDK.TAG.ROLE,
            Value: "TEST_ROLE",
          },
        ],
      });
    });

    it("adds vendor tag to all resources when provided", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
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

      template.hasResourceProperties("AWS::S3::Bucket", {
        Tags: [
          {
            Key: CDK.TAG.VENDOR,
            Value: "TEST_VENDOR",
          },
        ],
      });
    });

    it("adds both role and vendor tags to all resources when provided", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        roleTag: "TEST_ROLE",
        vendorTag: "TEST_VENDOR",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();

      // Check tags on SQS Queue
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

      // Check tags on Lambda Function
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

      // Check tags on S3 Bucket
      template.hasResourceProperties("AWS::S3::Bucket", {
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

      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
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
            CDK_ENV_QUEUE_URL: Match.anyValue(),
            CDK_ENV_BUCKET_NAME: Match.anyValue(),
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

    it("sets environment variables including bucket name", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
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
            CDK_ENV_QUEUE_URL: Match.anyValue(),
            CDK_ENV_BUCKET_NAME: Match.anyValue(),
          },
        },
      });
    });

    it("configures S3 bucket with provided properties", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
        bucketName: "test-bucket",
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        versioned: true,
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::S3::Bucket", {
        BucketName: "test-bucket",
        VersioningConfiguration: {
          Status: "Enabled",
        },
      });
    });

    it("sets up S3 to SQS event notification", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::S3::BucketNotification", {
        NotificationConfiguration: {
          QueueConfigurations: [
            {
              Events: ["s3:ObjectCreated:*"],
              QueueArn: {
                "Fn::GetAtt": [
                  Match.stringLikeRegexp("TestConstructQueue.*"),
                  "Arn",
                ],
              },
            },
          ],
        },
      });
    });

    it("grants the lambda access to the bucket", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: [
                "s3:GetObject*",
                "s3:GetBucket*",
                "s3:List*",
                "s3:DeleteObject*",
                "s3:PutObject*",
                "s3:Abort*",
              ],
              Effect: "Allow",
              Resource: [
                {
                  "Fn::GetAtt": [
                    Match.stringLikeRegexp("TestConstructBucket.*"),
                    "Arn",
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      {
                        "Fn::GetAtt": [
                          Match.stringLikeRegexp("TestConstructBucket.*"),
                          "Arn",
                        ],
                      },
                      "/*",
                    ],
                  ],
                },
              ],
            }),
          ]),
        },
      });
    });

    it("applies removal policy to all resources", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        removalPolicy: RemovalPolicy.DESTROY,
      });

      expect(construct).toBeDefined();

      // Verify default removal policy on resources
      const template = Template.fromStack(stack);

      // S3 bucket should have the provided removal policy
      template.hasResource("AWS::S3::Bucket", {
        DeletionPolicy: "Delete",
      });

      // Apply a different policy and verify it propagates to all resources
      construct.applyRemovalPolicy(RemovalPolicy.RETAIN);

      const updatedTemplate = Template.fromStack(stack);

      updatedTemplate.hasResource("AWS::Lambda::Function", {
        DeletionPolicy: "Retain",
      });

      updatedTemplate.hasResource("AWS::SQS::Queue", {
        DeletionPolicy: "Retain",
      });

      updatedTemplate.hasResource("AWS::S3::Bucket", {
        DeletionPolicy: "Retain",
      });
    });
  });

  describe("IBucket Implementation", () => {
    it("implements IBucket by delegating to underlying bucket", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      // Test key IBucket properties
      expect(construct.bucketArn).toBeDefined();
      expect(construct.bucketName).toBeDefined();
      expect(construct.bucketDomainName).toBeDefined();
      expect(construct.env).toEqual({
        account: stack.account,
        region: stack.region,
      });
      expect(construct.stack).toBe(stack);

      // Verify the bucket exists with expected properties
      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::S3::Bucket", {
        VersioningConfiguration: {
          Status: "Suspended",
        },
      });
    });

    it("grants bucket permissions", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      // Create a role to test grants
      const role = new iam.Role(stack, "TestRole", {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      });

      // Test various bucket permissions
      construct.grantRead(role);
      construct.grantWrite(role);
      construct.grantDelete(role);

      const template = Template.fromStack(stack);

      // Verify the IAM policy was created with S3 permissions
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ["s3:GetObject*", "s3:GetBucket*", "s3:List*"],
              Effect: "Allow",
              Resource: [
                {
                  "Fn::GetAtt": [
                    Match.stringLikeRegexp("TestConstructBucket.*"),
                    "Arn",
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      {
                        "Fn::GetAtt": [
                          Match.stringLikeRegexp("TestConstructBucket.*"),
                          "Arn",
                        ],
                      },
                      "/*",
                    ],
                  ],
                },
              ],
            }),
            Match.objectLike({
              Action: ["s3:DeleteObject*"],
              Effect: "Allow",
              Resource: [
                {
                  "Fn::GetAtt": [
                    Match.stringLikeRegexp("TestConstructBucket.*"),
                    "Arn",
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      {
                        "Fn::GetAtt": [
                          Match.stringLikeRegexp("TestConstructBucket.*"),
                          "Arn",
                        ],
                      },
                      "/*",
                    ],
                  ],
                },
              ],
            }),
            Match.objectLike({
              Action: ["s3:PutObject*", "s3:Abort*"],
              Effect: "Allow",
              Resource: [
                {
                  "Fn::GetAtt": [
                    Match.stringLikeRegexp("TestConstructBucket.*"),
                    "Arn",
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      {
                        "Fn::GetAtt": [
                          Match.stringLikeRegexp("TestConstructBucket.*"),
                          "Arn",
                        ],
                      },
                      "/*",
                    ],
                  ],
                },
              ],
            }),
          ]),
        },
      });
    });
  });
});
