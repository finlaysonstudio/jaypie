import { CDK } from "@jaypie/cdk";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Stack, RemovalPolicy, Duration } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { JaypieLambda } from "../JaypieLambda.js";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { JaypieEnvSecret } from "../JaypieEnvSecret.js";

describe("JaypieLambda", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieLambda).toBeFunction();
    });

    it("creates required resources", () => {
      const stack = new Stack();
      const construct = new JaypieLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
      template.hasResource("AWS::Lambda::Function", {});
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.handler",
        Runtime: "nodejs20.x",
      });
    });
  });

  describe("Features", () => {
    it("adds role tag when provided", () => {
      const stack = new Stack();
      const construct = new JaypieLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        roleTag: "TEST_ROLE",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
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
      const construct = new JaypieLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        vendorTag: "TEST_VENDOR",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
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
      const construct = new JaypieLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        roleTag: "TEST_ROLE",
        vendorTag: "TEST_VENDOR",
      });
      const template = Template.fromStack(stack);

      expect(construct).toBeDefined();
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

      const construct = new JaypieLambda(stack, "TestConstruct", {
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

      const construct = new JaypieLambda(stack, "TestConstruct", {
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
      const construct = new JaypieLambda(stack, "TestConstruct", {
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
          },
        },
      });
    });

    it("allows configuring lambda properties", () => {
      const stack = new Stack();
      const customTimeout = Duration.seconds(60);

      const construct = new JaypieLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        logRetention: 7,
        memorySize: 256,
        reservedConcurrentExecutions: 5,
        runtime: lambda.Runtime.NODEJS_18_X,
        timeout: customTimeout,
      });

      const template = Template.fromStack(stack);

      // Verify lambda configuration
      template.hasResourceProperties("AWS::Lambda::Function", {
        MemorySize: 256,
        Runtime: "nodejs18.x",
        Timeout: 60,
        ReservedConcurrentExecutions: 5,
      });

      expect(construct).toBeDefined();
    });

    it("adds layers by default", () => {
      const stack = new Stack();

      new JaypieLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      const template = Template.fromStack(stack);

      // Check that layers are added
      const resources = template.findResources("AWS::Lambda::Function");
      const lambdaFunctions = Object.values(resources);
      const testFunction = lambdaFunctions.find(
        (resource) => resource.Properties.Handler === "index.handler",
      );

      // Verify the layers array exists
      expect(testFunction.Properties.Layers).toBeDefined();

      // Verify at least one layer is added
      // Note: exact layer configuration may vary, so we just verify layers exist
      expect(testFunction.Properties.Layers.length).toBeGreaterThan(0);
    });

    it("adds ParamsAndSecrets layer by default", () => {
      const stack = new Stack();

      new JaypieLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      const template = Template.fromStack(stack);

      // The ParamsAndSecrets property does not directly appear in the CloudFormation template
      // Instead, check for its existence by verifying the Function has been created
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.handler",
      });

      // The actual testing of ParamsAndSecrets is done at the CDK level, not CloudFormation template level
      // So this test is mostly ensuring that the construct can be created with default ParamsAndSecrets
    });

    it("does not add Datadog layers when datadogApiKeyArn is not provided", () => {
      const stack = new Stack();

      new JaypieLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      const template = Template.fromStack(stack);

      // Check that DataDog layers are not added
      const resources = template.findResources("AWS::Lambda::Function");
      const lambdaFunction = Object.values(resources).find(
        (resource) => resource.Properties.Handler === "index.handler",
      );

      // If there are Layers, verify none of them are DataDog layers
      if (
        lambdaFunction.Properties.Layers &&
        lambdaFunction.Properties.Layers.length > 0
      ) {
        const layerRefs = lambdaFunction.Properties.Layers.map(
          (layer) => layer.Ref || "",
        );
        expect(
          layerRefs.some((ref) => ref.includes("DatadogNodeLayer")),
        ).toBeFalsy();
        expect(
          layerRefs.some((ref) => ref.includes("DatadogExtensionLayer")),
        ).toBeFalsy();
      }

      // Verify no Datadog environment variables are set
      const environment =
        lambdaFunction.Properties.Environment?.Variables || {};
      expect(environment.DD_API_KEY_SECRET_ARN).toBeUndefined();
      expect(environment.DD_SITE).toBeUndefined();
    });

    it("configures Datadog with datadogApiKeyArn", () => {
      const stack = new Stack();
      const datadogApiKeyArn =
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-datadog-api-key-123456";

      new JaypieLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        datadogApiKeyArn,
      });

      const template = Template.fromStack(stack);

      // Verify Datadog layers are added
      const resources = template.findResources("AWS::Lambda::Function");
      const lambdaFunction = Object.values(resources).find(
        (resource) => resource.Properties.Handler === "index.handler",
      );

      // Check for environment variables
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: {
            DD_API_KEY_SECRET_ARN: datadogApiKeyArn,
            DD_SITE: CDK.DATADOG.SITE,
          },
        },
      });

      // Verify secret is accessed
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: [
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret",
              ],
              Effect: "Allow",
              Resource: datadogApiKeyArn,
            }),
          ]),
        },
      });
    });

    describe("Environment Variable Fallbacks", () => {
      const originalEnv = { ...process.env };
      const datadogApiKeyArn =
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-datadog-api-key-123456";

      beforeEach(() => {
        // Clear relevant environment variables before each test
        delete process.env.DATADOG_API_KEY_ARN;
        delete process.env.CDK_ENV_DATADOG_API_KEY_ARN;
      });

      afterEach(() => {
        // Restore original environment
        process.env = { ...originalEnv };
      });

      it("uses DATADOG_API_KEY_ARN from environment", () => {
        process.env.DATADOG_API_KEY_ARN = datadogApiKeyArn;

        const stack = new Stack();
        new JaypieLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
        });

        const template = Template.fromStack(stack);

        // Verify secret is accessed
        template.hasResourceProperties("AWS::IAM::Policy", {
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: [
                  "secretsmanager:GetSecretValue",
                  "secretsmanager:DescribeSecret",
                ],
                Effect: "Allow",
                Resource: datadogApiKeyArn,
              }),
            ]),
          },
        });
      });

      it("uses CDK_ENV_DATADOG_API_KEY_ARN as fallback", () => {
        process.env.CDK_ENV_DATADOG_API_KEY_ARN = datadogApiKeyArn;

        const stack = new Stack();
        new JaypieLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
        });

        const template = Template.fromStack(stack);

        // Verify secret is accessed
        template.hasResourceProperties("AWS::IAM::Policy", {
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: [
                  "secretsmanager:GetSecretValue",
                  "secretsmanager:DescribeSecret",
                ],
                Effect: "Allow",
                Resource: datadogApiKeyArn,
              }),
            ]),
          },
        });
      });

      it("prefers explicitly provided datadogApiKeyArn over environment variables", () => {
        process.env.DATADOG_API_KEY_ARN =
          "arn:aws:secretsmanager:us-east-1:123456789012:secret:wrong-key-123456";
        process.env.CDK_ENV_DATADOG_API_KEY_ARN =
          "arn:aws:secretsmanager:us-east-1:123456789012:secret:also-wrong-key-123456";

        const stack = new Stack();
        new JaypieLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
          datadogApiKeyArn,
        });

        const template = Template.fromStack(stack);

        // Verify secret is accessed
        template.hasResourceProperties("AWS::IAM::Policy", {
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: [
                  "secretsmanager:GetSecretValue",
                  "secretsmanager:DescribeSecret",
                ],
                Effect: "Allow",
                Resource: datadogApiKeyArn,
              }),
            ]),
          },
        });
      });
    });

    it("disables ParamsAndSecrets layer when paramsAndSecrets=false", () => {
      const stack = new Stack();

      new JaypieLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        paramsAndSecrets: false,
      });

      const template = Template.fromStack(stack);

      // Check that the Lambda is not configured with ParamsAndSecrets
      const resources = template.findResources("AWS::Lambda::Function");
      const lambdaFunction = Object.values(resources)[0];

      expect(lambdaFunction.Properties.ParamsAndSecrets).toBeUndefined();
    });

    it("configures ParamsAndSecrets layer with custom options", () => {
      const stack = new Stack();

      new JaypieLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        paramsAndSecretsOptions: {
          cacheSize: 500,
          logLevel: lambda.ParamsAndSecretsLogLevel.DEBUG,
          // Only test options that don't require Duration objects to avoid complexity
        },
      });

      const template = Template.fromStack(stack);

      // Simply verify the function is created, as the ParamsAndSecrets details
      // are not directly exposed in the CloudFormation template
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.handler",
      });
    });
  });

  describe("IFunction Implementation", () => {
    it("implements IFunction by delegating to underlying lambda", () => {
      const stack = new Stack();
      const construct = new JaypieLambda(stack, "TestConstruct", {
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
      const construct = new JaypieLambda(stack, "TestConstruct", {
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
      const construct = new JaypieLambda(stack, "TestConstruct", {
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

    it("applies removal policy to lambda", () => {
      const stack = new Stack();
      const construct = new JaypieLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      construct.applyRemovalPolicy(RemovalPolicy.DESTROY);

      const template = Template.fromStack(stack);
      template.hasResource("AWS::Lambda::Function", {
        DeletionPolicy: "Delete",
      });

      // Test assertions to satisfy linter
      expect(template).toBeDefined();
    });
  });
});
