import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sqs from "aws-cdk-lib/aws-sqs";

import { CDK } from "../constants";
import { JaypieLambda } from "../JaypieLambda.js";
import { JaypieQueuedLambda } from "../JaypieQueuedLambda.js";

//
//
// Constants
//

const CODE = lambda.Code.fromInline("exports.handler = () => {}");
const HANDLER = "index.handler";

//
//
// Helpers
//

function findMainLambdaFunction(template: Template) {
  const resources = template.findResources("AWS::Lambda::Function");
  return Object.values(resources).find(
    (resource: any) => resource.Properties?.Handler === HANDLER,
  ) as any;
}

function lambdaEnvironment(template: Template) {
  return findMainLambdaFunction(template)?.Properties?.Environment?.Variables;
}

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  process.env.PROJECT_ENV = "sandbox";
  process.env.PROJECT_KEY = "myapp";
  process.env.PROJECT_NONCE = "a1b2";
});
afterEach(() => {
  process.env = DEFAULT_ENV;
});

//
//
// Run tests
//

describe("Issue 443: non-secret variables hydration", () => {
  describe("Base Cases", () => {
    it("Creates no parameter without variables", () => {
      const stack = new Stack(undefined, "TestStack");
      new JaypieLambda(stack, "Api", { code: CODE, handler: HANDLER });
      const template = Template.fromStack(stack);
      expect(template.findResources("AWS::SSM::Parameter")).toEqual({});
    });
    it("Sets no pointer without variables", () => {
      const stack = new Stack(undefined, "TestStack");
      new JaypieLambda(stack, "Api", { code: CODE, handler: HANDLER });
      const template = Template.fromStack(stack);
      expect(lambdaEnvironment(template)).not.toHaveProperty(CDK.VARIABLES.ENV);
    });
    it("Creates no parameter for an empty map", () => {
      const stack = new Stack(undefined, "TestStack");
      new JaypieLambda(stack, "Api", {
        code: CODE,
        handler: HANDLER,
        variables: {},
      });
      const template = Template.fromStack(stack);
      expect(template.findResources("AWS::SSM::Parameter")).toEqual({});
    });
  });

  describe("Happy Paths", () => {
    it("Writes the variables to a parameter", () => {
      const stack = new Stack(undefined, "TestStack");
      new JaypieLambda(stack, "Api", {
        code: CODE,
        handler: HANDLER,
        variables: { APP_TENANT: "acme" },
      });
      const template = Template.fromStack(stack);
      expect(() =>
        template.hasResourceProperties("AWS::SSM::Parameter", {
          Name: "/sandbox/myapp/a1b2/Api/variables",
          Type: "String",
          Value: JSON.stringify({ APP_TENANT: "acme" }),
        }),
      ).not.toThrow();
    });
    it("Points the Lambda at the parameter", () => {
      const stack = new Stack(undefined, "TestStack");
      new JaypieLambda(stack, "Api", {
        code: CODE,
        handler: HANDLER,
        variables: { APP_TENANT: "acme" },
      });
      const template = Template.fromStack(stack);
      expect(lambdaEnvironment(template)?.[CDK.VARIABLES.ENV]).toBe(
        "/sandbox/myapp/a1b2/Api/variables",
      );
    });
    it("Keeps the values out of the Lambda environment", () => {
      const stack = new Stack(undefined, "TestStack");
      new JaypieLambda(stack, "Api", {
        code: CODE,
        handler: HANDLER,
        variables: { APP_TENANT: "acme" },
      });
      const template = Template.fromStack(stack);
      expect(lambdaEnvironment(template)).not.toHaveProperty("APP_TENANT");
    });
    it("Grants the Lambda read on the parameter", () => {
      const stack = new Stack(undefined, "TestStack");
      new JaypieLambda(stack, "Api", {
        code: CODE,
        handler: HANDLER,
        variables: { APP_TENANT: "acme" },
      });
      const template = Template.fromStack(stack);
      expect(() =>
        template.hasResourceProperties("AWS::IAM::Policy", {
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: Match.arrayWith(["ssm:GetParameter"]),
                Effect: "Allow",
              }),
            ]),
          },
        }),
      ).not.toThrow();
    });
    it("Uses intelligent tiering so the bundle can exceed 4KB", () => {
      const stack = new Stack(undefined, "TestStack");
      new JaypieLambda(stack, "Api", {
        code: CODE,
        handler: HANDLER,
        variables: { APP_TENANT: "acme" },
      });
      const template = Template.fromStack(stack);
      expect(() =>
        template.hasResourceProperties("AWS::SSM::Parameter", {
          Tier: "Intelligent-Tiering",
        }),
      ).not.toThrow();
    });
  });

  describe("Features", () => {
    describe("Input shapes", () => {
      it("Accepts a multi-key object", () => {
        const stack = new Stack(undefined, "TestStack");
        new JaypieLambda(stack, "Api", {
          code: CODE,
          handler: HANDLER,
          variables: { APP_BUCKET: "bucket", APP_TENANT: "acme" },
        });
        const template = Template.fromStack(stack);
        expect(() =>
          template.hasResourceProperties("AWS::SSM::Parameter", {
            Value: JSON.stringify({ APP_BUCKET: "bucket", APP_TENANT: "acme" }),
          }),
        ).not.toThrow();
      });
      it("Looks up bare strings in process.env", () => {
        process.env.APP_TENANT = "from-env";
        const stack = new Stack(undefined, "TestStack");
        new JaypieLambda(stack, "Api", {
          code: CODE,
          handler: HANDLER,
          variables: ["APP_TENANT"],
        });
        const template = Template.fromStack(stack);
        expect(() =>
          template.hasResourceProperties("AWS::SSM::Parameter", {
            Value: JSON.stringify({ APP_TENANT: "from-env" }),
          }),
        ).not.toThrow();
      });
      it("Accepts a mixed array", () => {
        process.env.APP_TENANT = "from-env";
        const stack = new Stack(undefined, "TestStack");
        new JaypieLambda(stack, "Api", {
          code: CODE,
          handler: HANDLER,
          variables: ["APP_TENANT", { APP_BUCKET: "bucket" }],
        });
        const template = Template.fromStack(stack);
        expect(() =>
          template.hasResourceProperties("AWS::SSM::Parameter", {
            Value: JSON.stringify({
              APP_TENANT: "from-env",
              APP_BUCKET: "bucket",
            }),
          }),
        ).not.toThrow();
      });
      it("Skips strings absent from process.env", () => {
        delete process.env.APP_MISSING;
        const stack = new Stack(undefined, "TestStack");
        new JaypieLambda(stack, "Api", {
          code: CODE,
          handler: HANDLER,
          variables: ["APP_MISSING"],
        });
        const template = Template.fromStack(stack);
        expect(template.findResources("AWS::SSM::Parameter")).toEqual({});
      });
    });

    describe("Deploy-time tokens", () => {
      it("Resolves CDK tokens inside the bundle", () => {
        const stack = new Stack(undefined, "TestStack");
        const queue = new sqs.Queue(stack, "Queue");
        new JaypieLambda(stack, "Api", {
          code: CODE,
          handler: HANDLER,
          variables: { APP_JOB_QUEUE_URL: queue.queueUrl },
        });
        const template = Template.fromStack(stack);
        const parameters = template.findResources("AWS::SSM::Parameter");
        const value = Object.values(parameters)[0] as any;
        // CloudFormation resolves the queue ref at deploy time
        expect(JSON.stringify(value.Properties.Value)).toContain("Fn::Join");
      });
    });

    describe("Naming", () => {
      it("Does not collide across wrapped lambdas in one stack", () => {
        const stack = new Stack(undefined, "TestStack");
        new JaypieQueuedLambda(stack, "Worker", {
          code: CODE,
          handler: HANDLER,
          variables: { APP_TENANT: "acme" },
        });
        new JaypieQueuedLambda(stack, "Mailer", {
          code: CODE,
          handler: HANDLER,
          variables: { APP_TENANT: "acme" },
        });
        const template = Template.fromStack(stack);
        const names = Object.values(
          template.findResources("AWS::SSM::Parameter"),
        ).map((resource: any) => resource.Properties.Name);
        expect(names).toHaveLength(2);
        expect(new Set(names).size).toBe(2);
      });
    });

    describe("Coexistence with secrets", () => {
      it("Keeps the secret pointer inline", () => {
        process.env.MOCK_SECRET = "mock-value";
        const stack = new Stack(undefined, "TestStack");
        new JaypieLambda(stack, "Api", {
          code: CODE,
          handler: HANDLER,
          secrets: ["MOCK_SECRET"],
          variables: { APP_TENANT: "acme" },
        });
        const template = Template.fromStack(stack);
        const environment = lambdaEnvironment(template);
        expect(environment).toHaveProperty("SECRET_MOCK_SECRET");
        expect(environment).toHaveProperty(CDK.VARIABLES.ENV);
      });
    });
  });
});
