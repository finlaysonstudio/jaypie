import { CDK, LAMBDA_WEB_ADAPTER } from "../constants";
import { describe, expect, it } from "vitest";
import { Stack, Duration } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { JaypieStreamingLambda } from "../JaypieStreamingLambda.js";

// Helper function to find the main Lambda function in the template
function findMainLambdaFunction(template: Template, handler?: string) {
  const resources = template.findResources("AWS::Lambda::Function");
  const lambdaFunctions = Object.values(resources);
  if (handler) {
    return lambdaFunctions.find(
      (resource: any) => resource.Properties?.Handler === handler,
    );
  }
  // Return the first function that has our custom environment variables
  return lambdaFunctions.find(
    (resource: any) =>
      resource.Properties?.Environment?.Variables?.AWS_LAMBDA_EXEC_WRAPPER ===
      LAMBDA_WEB_ADAPTER.EXEC_WRAPPER,
  );
}

describe("JaypieStreamingLambda", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieStreamingLambda).toBeFunction();
    });

    it("creates required resources", () => {
      const stack = new Stack();
      const construct = new JaypieStreamingLambda(stack, "TestConstruct", {
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
    describe("Lambda Web Adapter configuration", () => {
      it("adds Lambda Web Adapter layer", () => {
        const stack = new Stack(undefined, "TestStack", {
          env: { region: "us-east-1", account: "123456789012" },
        });
        new JaypieStreamingLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
        });

        const template = Template.fromStack(stack);
        const mainFunction = findMainLambdaFunction(template);
        expect(mainFunction).toBeDefined();

        // Verify that the Lambda has layers
        const layers = mainFunction?.Properties?.Layers || [];
        expect(layers.length).toBeGreaterThan(0);
      });

      it("sets AWS_LAMBDA_EXEC_WRAPPER environment variable", () => {
        const stack = new Stack();
        new JaypieStreamingLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
        });

        const template = Template.fromStack(stack);
        const mainFunction = findMainLambdaFunction(template);
        expect(mainFunction).toBeDefined();

        const envVars = mainFunction?.Properties?.Environment?.Variables || {};
        expect(envVars.AWS_LAMBDA_EXEC_WRAPPER).toBe(
          LAMBDA_WEB_ADAPTER.EXEC_WRAPPER,
        );
      });

      it("sets PORT environment variable to default 8000", () => {
        const stack = new Stack();
        new JaypieStreamingLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
        });

        const template = Template.fromStack(stack);
        const mainFunction = findMainLambdaFunction(template);
        expect(mainFunction).toBeDefined();

        const envVars = mainFunction?.Properties?.Environment?.Variables || {};
        expect(envVars.PORT).toBe("8000");
      });

      it("allows custom PORT", () => {
        const stack = new Stack();
        new JaypieStreamingLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
          port: 3000,
        });

        const template = Template.fromStack(stack);
        const mainFunction = findMainLambdaFunction(template);
        expect(mainFunction).toBeDefined();

        const envVars = mainFunction?.Properties?.Environment?.Variables || {};
        expect(envVars.PORT).toBe("3000");
      });
    });

    describe("streaming mode", () => {
      it("defaults to BUFFERED mode", () => {
        const stack = new Stack();
        const construct = new JaypieStreamingLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
        });

        const template = Template.fromStack(stack);
        const mainFunction = findMainLambdaFunction(template);
        expect(mainFunction).toBeDefined();

        const envVars = mainFunction?.Properties?.Environment?.Variables || {};
        expect(envVars.AWS_LWA_INVOKE_MODE).toBe(
          LAMBDA_WEB_ADAPTER.INVOKE_MODE.BUFFERED,
        );
        expect(construct.invokeMode).toBe(lambda.InvokeMode.BUFFERED);
      });

      it("sets RESPONSE_STREAM mode when streaming=true", () => {
        const stack = new Stack();
        const construct = new JaypieStreamingLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
          streaming: true,
        });

        const template = Template.fromStack(stack);
        const mainFunction = findMainLambdaFunction(template);
        expect(mainFunction).toBeDefined();

        const envVars = mainFunction?.Properties?.Environment?.Variables || {};
        expect(envVars.AWS_LWA_INVOKE_MODE).toBe(
          LAMBDA_WEB_ADAPTER.INVOKE_MODE.RESPONSE_STREAM,
        );
        expect(construct.invokeMode).toBe(lambda.InvokeMode.RESPONSE_STREAM);
      });

      it("exposes invokeMode for use with JaypieDistribution", () => {
        const stack = new Stack();
        const bufferedLambda = new JaypieStreamingLambda(
          stack,
          "BufferedConstruct",
          {
            code: lambda.Code.fromInline("exports.handler = () => {}"),
            handler: "index.handler",
            streaming: false,
          },
        );

        const streamingLambda = new JaypieStreamingLambda(
          stack,
          "StreamingConstruct",
          {
            code: lambda.Code.fromInline("exports.handler = () => {}"),
            handler: "index.handler",
            streaming: true,
          },
        );

        expect(bufferedLambda.invokeMode).toBe(lambda.InvokeMode.BUFFERED);
        expect(streamingLambda.invokeMode).toBe(
          lambda.InvokeMode.RESPONSE_STREAM,
        );
      });
    });

    describe("architecture", () => {
      it("defaults to X86_64 architecture", () => {
        const stack = new Stack(undefined, "TestStack", {
          env: { region: "us-east-1", account: "123456789012" },
        });
        const construct = new JaypieStreamingLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
        });

        expect(construct.architecture.name).toBe("x86_64");
      });

      it("supports ARM64 architecture", () => {
        const stack = new Stack(undefined, "TestStack", {
          env: { region: "us-east-1", account: "123456789012" },
        });
        const construct = new JaypieStreamingLambda(stack, "TestConstruct", {
          architecture: lambda.Architecture.ARM_64,
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
        });

        expect(construct.architecture.name).toBe("arm64");
      });
    });

    describe("default props", () => {
      it("defaults timeout to EXPRESS_API duration", () => {
        const stack = new Stack();
        new JaypieStreamingLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
        });
        const template = Template.fromStack(stack);

        template.hasResourceProperties("AWS::Lambda::Function", {
          Timeout: CDK.DURATION.EXPRESS_API,
        });
      });

      it("defaults role tag to API role", () => {
        const stack = new Stack();
        new JaypieStreamingLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
        });
        const template = Template.fromStack(stack);

        template.hasResourceProperties("AWS::Lambda::Function", {
          Tags: Match.arrayWith([
            {
              Key: CDK.TAG.ROLE,
              Value: CDK.ROLE.API,
            },
          ]),
        });
      });

      it("allows overriding default timeout", () => {
        const stack = new Stack();
        const customTimeout = Duration.seconds(60);
        new JaypieStreamingLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
          timeout: customTimeout,
        });
        const template = Template.fromStack(stack);

        template.hasResourceProperties("AWS::Lambda::Function", {
          Timeout: 60,
        });
      });

      it("allows overriding default role tag", () => {
        const stack = new Stack();
        new JaypieStreamingLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
          roleTag: "CUSTOM_ROLE",
        });
        const template = Template.fromStack(stack);

        template.hasResourceProperties("AWS::Lambda::Function", {
          Tags: Match.arrayWith([
            {
              Key: CDK.TAG.ROLE,
              Value: "CUSTOM_ROLE",
            },
          ]),
        });
      });
    });

    describe("inherits JaypieLambda functionality", () => {
      it("supports environment variables (object syntax)", () => {
        const stack = new Stack();
        new JaypieStreamingLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          environment: {
            CUSTOM_VAR: "custom-value",
          },
          handler: "index.handler",
        });

        const template = Template.fromStack(stack);
        const mainFunction = findMainLambdaFunction(template);
        expect(mainFunction).toBeDefined();

        const envVars = mainFunction?.Properties?.Environment?.Variables || {};
        expect(envVars.CUSTOM_VAR).toBe("custom-value");
        // Should still have Web Adapter env vars
        expect(envVars.AWS_LAMBDA_EXEC_WRAPPER).toBe(
          LAMBDA_WEB_ADAPTER.EXEC_WRAPPER,
        );
      });

      it("supports environment variables (array syntax)", () => {
        const stack = new Stack();
        new JaypieStreamingLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          environment: [{ CUSTOM_VAR: "custom-value" }],
          handler: "index.handler",
        });

        const template = Template.fromStack(stack);
        const mainFunction = findMainLambdaFunction(template);
        expect(mainFunction).toBeDefined();

        const envVars = mainFunction?.Properties?.Environment?.Variables || {};
        expect(envVars.CUSTOM_VAR).toBe("custom-value");
        // Should still have Web Adapter env vars
        expect(envVars.AWS_LAMBDA_EXEC_WRAPPER).toBe(
          LAMBDA_WEB_ADAPTER.EXEC_WRAPPER,
        );
      });

      it("supports additional layers", () => {
        const stack = new Stack(undefined, "TestStack", {
          env: { region: "us-east-1", account: "123456789012" },
        });
        const customLayer = lambda.LayerVersion.fromLayerVersionArn(
          stack,
          "CustomLayer",
          "arn:aws:lambda:us-east-1:123456789012:layer:CustomLayer:1",
        );

        new JaypieStreamingLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
          layers: [customLayer],
        });

        const template = Template.fromStack(stack);
        const mainFunction = findMainLambdaFunction(template);
        expect(mainFunction).toBeDefined();

        // Should have at least 2 layers (Web Adapter + custom)
        const layers = mainFunction?.Properties?.Layers || [];
        expect(layers.length).toBeGreaterThanOrEqual(2);
      });

      it("supports custom memory size", () => {
        const stack = new Stack();
        new JaypieStreamingLambda(stack, "TestConstruct", {
          code: lambda.Code.fromInline("exports.handler = () => {}"),
          handler: "index.handler",
          memorySize: 256,
        });

        const template = Template.fromStack(stack);
        const mainFunction = findMainLambdaFunction(template);
        expect(mainFunction).toBeDefined();

        expect(mainFunction?.Properties?.MemorySize).toBe(256);
      });
    });
  });

  describe("IFunction Implementation", () => {
    it("implements IFunction by delegating to underlying lambda", () => {
      const stack = new Stack();
      const construct = new JaypieStreamingLambda(stack, "TestConstruct", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      // Test key IFunction properties inherited from JaypieLambda
      expect(construct.functionArn).toBeDefined();
      expect(construct.functionName).toBeDefined();
      expect(construct.grantPrincipal).toBeDefined();
      expect(construct.role).toBeDefined();
      expect(construct.env).toEqual({
        account: stack.account,
        region: stack.region,
      });
      expect(construct.stack).toBe(stack);
    });
  });

  describe("Specific Scenarios", () => {
    it("can be used with default settings for a simple web app", () => {
      const stack = new Stack(undefined, "TestStack", {
        env: { region: "us-east-1", account: "123456789012" },
      });
      const construct = new JaypieStreamingLambda(stack, "WebApp", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
      });

      expect(construct).toBeDefined();
      expect(construct.invokeMode).toBe(lambda.InvokeMode.BUFFERED);

      const template = Template.fromStack(stack);
      const mainFunction = findMainLambdaFunction(template);
      expect(mainFunction).toBeDefined();

      const envVars = mainFunction?.Properties?.Environment?.Variables || {};
      expect(envVars.PORT).toBe("8000");
      expect(envVars.AWS_LAMBDA_EXEC_WRAPPER).toBe("/opt/bootstrap");
      expect(envVars.AWS_LWA_INVOKE_MODE).toBe("BUFFERED");
    });

    it("can be configured for streaming LLM responses", () => {
      const stack = new Stack(undefined, "TestStack", {
        env: { region: "us-east-1", account: "123456789012" },
      });
      const construct = new JaypieStreamingLambda(stack, "LLMApi", {
        code: lambda.Code.fromInline("exports.handler = () => {}"),
        handler: "index.handler",
        port: 3000,
        streaming: true,
        timeout: Duration.seconds(300),
      });

      expect(construct).toBeDefined();
      expect(construct.invokeMode).toBe(lambda.InvokeMode.RESPONSE_STREAM);

      const template = Template.fromStack(stack);
      const mainFunction = findMainLambdaFunction(template);
      expect(mainFunction).toBeDefined();

      const envVars = mainFunction?.Properties?.Environment?.Variables || {};
      expect(envVars.PORT).toBe("3000");
      expect(envVars.AWS_LWA_INVOKE_MODE).toBe("RESPONSE_STREAM");
      expect(mainFunction?.Properties?.Timeout).toBe(300);
    });
  });
});
