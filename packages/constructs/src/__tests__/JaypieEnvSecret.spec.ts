import { expect, it, describe } from "vitest";
import { Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { JaypieEnvSecret } from "../JaypieEnvSecret.js";
import { CDK } from "@jaypie/cdk";

describe("JaypieSecret", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieEnvSecret).toBeFunction();
    });

    it("creates a secret", () => {
      const stack = new Stack();
      const secret = new JaypieEnvSecret(stack, "TestSecret");
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::SecretsManager::Secret", {});
      expect(secret).toBeDefined();
    });
  });

  describe("Features", () => {
    it("adds role tag when not consuming", () => {
      const stack = new Stack();
      const secret = new JaypieEnvSecret(stack, "TestSecret", {
        roleTag: CDK.ROLE.API,
      });
      const template = Template.fromStack(stack);

      expect(secret).toBeDefined();
      template.resourceCountIs("AWS::SecretsManager::Secret", 1);
      template.hasResourceProperties("AWS::SecretsManager::Secret", {
        Tags: [
          {
            Key: CDK.TAG.ROLE,
            Value: CDK.ROLE.API,
          },
        ],
      });
    });

    it("uses environment variable value when envKey is set", () => {
      process.env.TEST_SECRET_VALUE = "env-secret-value";
      const stack = new Stack();
      const secret = new JaypieEnvSecret(stack, "TestSecret", {
        envKey: "TEST_SECRET_VALUE",
      });
      const template = Template.fromStack(stack);

      expect(secret).toBeDefined();
      template.resourceCountIs("AWS::SecretsManager::Secret", 1);
      template.hasResourceProperties("AWS::SecretsManager::Secret", {
        SecretString: "env-secret-value",
      });
      delete process.env.TEST_SECRET_VALUE;
    });

    it("falls back to value param when envKey is not in process.env", () => {
      const stack = new Stack();
      const secret = new JaypieEnvSecret(stack, "TestSecret", {
        envKey: "NONEXISTENT_ENV_VALUE",
        value: "fallback-value",
      });
      const template = Template.fromStack(stack);

      expect(secret).toBeDefined();
      template.resourceCountIs("AWS::SecretsManager::Secret", 1);
      template.hasResourceProperties("AWS::SecretsManager::Secret", {
        SecretString: "fallback-value",
      });
    });

    it("creates export when provider is true", () => {
      const stack = new Stack();
      new JaypieEnvSecret(stack, "TestSecret", {
        provider: true,
        export: "TestSecretExport",
      });
      const template = Template.fromStack(stack);

      const outputs = template.findOutputs("*");
      expect(outputs).toBeObject();
      expect(Object.keys(outputs)[0]).toBeString();
      expect(Object.keys(outputs)[0]).toStartWith("TestSecretProvidedName");
      expect(Object.values(outputs)[0]).toBeObject();
      expect(Object.values(outputs)[0].Export.Name).toBeString();
      expect(Object.values(outputs)[0].Export.Name).toBe("TestSecretExport");
    });

    it("imports secret when consumer is true", () => {
      const stack = new Stack();
      const secret = new JaypieEnvSecret(stack, "TestSecret", {
        consumer: true,
        export: "TestSecretExport",
      });

      expect(secret).toBeDefined();
    });

    it("sets string value when value is string", () => {
      const stack = new Stack();
      const secret = new JaypieEnvSecret(stack, "TestSecret", {
        value: "secret-value",
      });
      const template = Template.fromStack(stack);

      expect(secret).toBeDefined();
      template.resourceCountIs("AWS::SecretsManager::Secret", 1);
      template.hasResourceProperties("AWS::SecretsManager::Secret", {
        SecretString: "secret-value",
      });
    });
  });
});
