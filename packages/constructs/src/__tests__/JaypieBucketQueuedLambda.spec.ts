import { CDK } from "@jaypie/cdk";
import { describe, expect, it } from "vitest";
import { Stack, RemovalPolicy, Duration } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { JaypieBucketQueuedLambda } from "../JaypieBucketQueuedLambda.js";

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
      template.hasResourceProperties("AWS::SQS::Queue", {});
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.handler",
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
      template.resourcePropertiesCountIs(
        "AWS::IAM::Policy",
        {
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
            ]),
          },
        },
        1,
      );

      template.resourcePropertiesCountIs(
        "AWS::IAM::Policy",
        {
          PolicyDocument: {
            Statement: Match.arrayWith([
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
        },
        1,
      );

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
        bucketOptions: {
          versioned: true,
        },
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

    it("applies additional bucket options through bucketOptions", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
        bucketName: "test-bucket",
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        bucketOptions: {
          cors: [
            {
              allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
              allowedOrigins: ["https://example.com"],
              allowedHeaders: ["*"],
            },
          ],
          lifecycleRules: [
            {
              expiration: Duration.days(365),
              id: "ExpireAfterOneYear",
            },
          ],
        },
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::S3::Bucket", {
        BucketName: "test-bucket",
        CorsConfiguration: {
          CorsRules: [
            {
              AllowedHeaders: ["*"],
              AllowedMethods: ["GET", "PUT"],
              AllowedOrigins: ["https://example.com"],
            },
          ],
        },
        LifecycleConfiguration: {
          Rules: [
            {
              ExpirationInDays: 365,
              Id: "ExpireAfterOneYear",
              Status: "Enabled",
            },
          ],
        },
      });
    });

    it("bucketName in bucketOptions overrides top-level bucketName", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
        bucketName: "test-bucket",
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        bucketOptions: {
          bucketName: "override-bucket",
        },
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::S3::Bucket", {
        BucketName: "override-bucket",
      });
    });

    it("verifies bucket notification setup", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();

      // Find S3 Notification handler resource - CDK creates a custom resource for notifications
      const resources = template.findResources("Custom::S3BucketNotifications");
      expect(Object.keys(resources).length).toBeGreaterThan(0);

      // Find BucketNotificationsHandler Lambda
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.handler",
        Runtime: lambda.Runtime.NODEJS_LATEST.name,
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

      // Check that the Lambda function has S3 permissions
      const resources = template.findResources("AWS::IAM::Policy");

      // Find policy by function role reference pattern
      const functionPolicies = Object.values(resources).filter((resource) =>
        resource.Properties?.Roles?.[0]?.Ref?.includes(
          "TestConstructFunctionServiceRole",
        ),
      );

      // Verify at least one policy exists
      expect(functionPolicies.length).toBeGreaterThan(0);

      // Verify policy gives access to the bucket
      const policy = functionPolicies[0];
      const statements = policy.Properties.PolicyDocument.Statement;

      // Find statement with S3 actions
      const s3Statement = statements.find((statement) =>
        statement.Action.some((action) => action.startsWith("s3:")),
      );

      // Verify statement exists and has the right effect
      expect(s3Statement).toBeDefined();
      expect(s3Statement.Effect).toBe("Allow");

      // Verify it references the bucket
      expect(
        s3Statement.Resource.some(
          (resource) =>
            typeof resource === "object" &&
            resource["Fn::GetAtt"]?.[0]?.includes("TestConstructBucket"),
        ),
      ).toBe(true);
    });

    it("adds environment variable for bucket name", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: Match.objectLike({
            CDK_ENV_BUCKET_NAME: Match.anyValue(),
          }),
        },
      });
    });

    it("applies removal policy to resources", () => {
      const stack = new Stack();
      const construct = new JaypieBucketQueuedLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        bucketOptions: {
          removalPolicy: RemovalPolicy.DESTROY,
        },
      });

      expect(construct).toBeDefined();

      // Check removal policy was applied to bucket
      const template = Template.fromStack(stack);
      const bucketResources = template.findResources("AWS::S3::Bucket");
      const bucketId = Object.keys(bucketResources)[0];

      // Verify bucket has deletion policy
      expect(bucketResources[bucketId].DeletionPolicy).toBe("Delete");
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

      // Verify the bucket exists
      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::S3::Bucket", 1);
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

      const template = Template.fromStack(stack);

      // Check for any IAM policy that grants the test role access to the bucket
      const resources = template.findResources("AWS::IAM::Policy");

      // Find policy by role reference pattern
      const rolePolicies = Object.values(resources).filter((resource) =>
        resource.Properties?.Roles?.[0]?.Ref?.includes("TestRole"),
      );

      // Verify at least one policy exists
      expect(rolePolicies.length).toBeGreaterThan(0);

      // There's a policy attached to the role that we created
      expect(rolePolicies[0].Properties.Roles[0].Ref).toMatch(/TestRole/);
    });
  });
});
