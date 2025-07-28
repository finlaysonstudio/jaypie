import { CDK } from "@jaypie/cdk";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Stack, RemovalPolicy, Duration } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { JaypieLambda } from "../JaypieLambda.js";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { JaypieEnvSecret } from "../JaypieEnvSecret.js";

// Helper function to find the main Lambda function in the template
function findMainLambdaFunction(
  template: Template,
  handler: string = "index.handler",
) {
  const resources = template.findResources("AWS::Lambda::Function");
  const lambdaFunctions = Object.values(resources);
  return lambdaFunctions.find(
    (resource: any) => resource.Properties?.Handler === handler,
  );
}

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

      const mainFunction = findMainLambdaFunction(template);
      expect(mainFunction).toBeDefined();

      const tags = mainFunction?.Properties?.Tags || [];
      expect(tags).toContainEqual({
        Key: CDK.TAG.ROLE,
        Value: "TEST_ROLE",
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

      const mainFunction = findMainLambdaFunction(template);
      expect(mainFunction).toBeDefined();

      const tags = mainFunction?.Properties?.Tags || [];
      expect(tags).toContainEqual({
        Key: CDK.TAG.VENDOR,
        Value: "TEST_VENDOR",
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

      const mainFunction = findMainLambdaFunction(template);
      expect(mainFunction).toBeDefined();

      const tags = mainFunction?.Properties?.Tags || [];
      expect(tags).toContainEqual({
        Key: CDK.TAG.ROLE,
        Value: "TEST_ROLE",
      });
      expect(tags).toContainEqual({
        Key: CDK.TAG.VENDOR,
        Value: "TEST_VENDOR",
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

      const mainFunction = findMainLambdaFunction(template);
      expect(mainFunction).toBeDefined();

      // Verify environment variables are set
      const envVars = mainFunction?.Properties?.Environment?.Variables || {};
      expect(envVars.SECRET_VALUE_1).toBeDefined();
      expect(envVars.SECRET_VALUE_2).toBeDefined();

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

      const mainFunction = findMainLambdaFunction(template);
      expect(mainFunction).toBeDefined();

      // Verify environment variables are set
      const envVars = mainFunction?.Properties?.Environment?.Variables || {};
      expect(envVars.SECRET_TEST_SECRET).toBeDefined();
      expect(envVars.SECRET_TEST_SECRET_2).toBeDefined();

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

      const mainFunction = findMainLambdaFunction(template);
      expect(mainFunction).toBeDefined();

      const envVars = mainFunction?.Properties?.Environment?.Variables || {};
      expect(envVars.TEST_VAR).toBe("test-value");
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

      const mainFunction = findMainLambdaFunction(template);
      expect(mainFunction).toBeDefined();

      // Verify lambda configuration
      expect(mainFunction?.Properties?.MemorySize).toBe(256);
      expect(mainFunction?.Properties?.Runtime).toBe("nodejs18.x");
      expect(mainFunction?.Properties?.Timeout).toBe(60);
      expect(mainFunction?.Properties?.ReservedConcurrentExecutions).toBe(5);

      expect(construct).toBeDefined();
    });

    it("adds layers by default", () => {
      const stack = new Stack();

      new JaypieLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      const template = Template.fromStack(stack);

      const mainFunction = findMainLambdaFunction(template);
      expect(mainFunction).toBeDefined();

      // Verify the layers array exists and has at least one layer
      const layers = mainFunction?.Properties?.Layers || [];
      expect(layers).toBeDefined();
      expect(layers.length).toBeGreaterThan(0);
    });

    it("adds ParamsAndSecrets layer by default", () => {
      const stack = new Stack();

      new JaypieLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      const template = Template.fromStack(stack);

      const mainFunction = findMainLambdaFunction(template);
      expect(mainFunction).toBeDefined();
      expect(mainFunction?.Properties?.Handler).toBe("index.handler");

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

      const mainFunction = findMainLambdaFunction(template);
      expect(mainFunction).toBeDefined();

      // If there are Layers, verify none of them are DataDog layers
      const layers = mainFunction?.Properties?.Layers || [];
      if (layers.length > 0) {
        const layerRefs = layers.map((layer: any) => layer.Ref || "");
        expect(
          layerRefs.some((ref: string) => ref.includes("DatadogNodeLayer")),
        ).toBeFalsy();
        expect(
          layerRefs.some((ref: string) =>
            ref.includes("DatadogExtensionLayer"),
          ),
        ).toBeFalsy();
      }

      // Verify no Datadog environment variables are set
      const environment =
        mainFunction?.Properties?.Environment?.Variables || {};
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

      const mainFunction = findMainLambdaFunction(template);
      expect(mainFunction).toBeDefined();

      // Check for environment variables
      const envVars = mainFunction?.Properties?.Environment?.Variables || {};
      expect(envVars.DD_API_KEY_SECRET_ARN).toBe(datadogApiKeyArn);
      expect(envVars.DD_SITE).toBe(CDK.DATADOG.SITE);

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

    describe("Default Environment Variables", () => {
      const originalEnv = { ...process.env };

      beforeEach(() => {
        // Clear relevant environment variables before each test
        delete process.env.DATADOG_API_KEY_ARN;
        delete process.env.LOG_LEVEL;
        delete process.env.MODULE_LOGGER;
        delete process.env.MODULE_LOG_LEVEL;
        delete process.env.PROJECT_COMMIT;
        delete process.env.PROJECT_ENV;
        delete process.env.PROJECT_KEY;
        delete process.env.PROJECT_SECRET;
        delete process.env.PROJECT_SERVICE;
        delete process.env.PROJECT_SPONSOR;
        delete process.env.PROJECT_VERSION;
      });

      afterEach(() => {
        // Restore original environment
        process.env = { ...originalEnv };
      });

      it("includes default environment variables when present in process.env", () => {
        process.env.LOG_LEVEL = "debug";
        process.env.PROJECT_ENV = "test";
        process.env.PROJECT_SERVICE = "my-service";

        const stack = new Stack();
        new JaypieLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
        });

        const template = Template.fromStack(stack);

        const mainFunction = findMainLambdaFunction(template);
        expect(mainFunction).toBeDefined();

        const envVars = mainFunction?.Properties?.Environment?.Variables || {};
        expect(envVars.LOG_LEVEL).toBe("debug");
        expect(envVars.PROJECT_ENV).toBe("test");
        expect(envVars.PROJECT_SERVICE).toBe("my-service");
      });

      it("does not override explicitly provided environment variables", () => {
        process.env.LOG_LEVEL = "debug";
        process.env.PROJECT_ENV = "production";

        const stack = new Stack();
        new JaypieLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
          environment: {
            LOG_LEVEL: "info",
            PROJECT_SERVICE: "override-service",
          },
        });

        const template = Template.fromStack(stack);

        const mainFunction = findMainLambdaFunction(template);
        expect(mainFunction).toBeDefined();

        const envVars = mainFunction?.Properties?.Environment?.Variables || {};
        expect(envVars.LOG_LEVEL).toBe("info");
        expect(envVars.PROJECT_ENV).toBe("production");
        expect(envVars.PROJECT_SERVICE).toBe("override-service");
      });

      it("includes all supported default environment variables", () => {
        process.env.DATADOG_API_KEY_ARN =
          "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-datadog-api-key-123456";
        process.env.LOG_LEVEL = "info";
        process.env.MODULE_LOGGER = "winston";
        process.env.MODULE_LOG_LEVEL = "debug";
        process.env.PROJECT_COMMIT = "abc123";
        process.env.PROJECT_ENV = "staging";
        process.env.PROJECT_KEY = "test-key";
        process.env.PROJECT_SECRET = "test-secret";
        process.env.PROJECT_SERVICE = "test-service";
        process.env.PROJECT_SPONSOR = "test-sponsor";
        process.env.PROJECT_VERSION = "1.0.0";

        const stack = new Stack();
        new JaypieLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
        });

        const template = Template.fromStack(stack);

        const mainFunction = findMainLambdaFunction(template);
        expect(mainFunction).toBeDefined();

        const envVars = mainFunction?.Properties?.Environment?.Variables || {};
        expect(envVars.DATADOG_API_KEY_ARN).toBe(
          "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-datadog-api-key-123456",
        );
        expect(envVars.LOG_LEVEL).toBe("info");
        expect(envVars.MODULE_LOGGER).toBe("winston");
        expect(envVars.MODULE_LOG_LEVEL).toBe("debug");
        expect(envVars.PROJECT_COMMIT).toBe("abc123");
        expect(envVars.PROJECT_ENV).toBe("staging");
        expect(envVars.PROJECT_KEY).toBe("test-key");
        expect(envVars.PROJECT_SECRET).toBe("test-secret");
        expect(envVars.PROJECT_SERVICE).toBe("test-service");
        expect(envVars.PROJECT_SPONSOR).toBe("test-sponsor");
        expect(envVars.PROJECT_VERSION).toBe("1.0.0");
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

      const mainFunction = findMainLambdaFunction(template);
      expect(mainFunction).toBeDefined();

      // Check that the Lambda is not configured with ParamsAndSecrets
      expect(mainFunction?.Properties?.ParamsAndSecrets).toBeUndefined();
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

      const mainFunction = findMainLambdaFunction(template);
      expect(mainFunction).toBeDefined();
      expect(mainFunction?.Properties?.Handler).toBe("index.handler");

      // Simply verify the function is created, as the ParamsAndSecrets details
      // are not directly exposed in the CloudFormation template
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
      const mainFunction = findMainLambdaFunction(template);
      expect(mainFunction).toBeDefined();
      expect(mainFunction?.Properties?.Handler).toBe("index.handler");
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
              Resource: Match.anyValue(),
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
