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
      const secret = new JaypieEnvSecret(stack, "TestSecret", { name: "test" });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::SecretsManager::Secret", {});
      expect(secret).toBeDefined();
    });
  });

  describe("Features", () => {
    it("adds role tag when not consuming", () => {
      const stack = new Stack();
      new JaypieEnvSecret(stack, "TestSecret", {
        role: CDK.ROLE.API,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::SecretsManager::Secret", {
        Tags: [
          {
            Key: CDK.TAG.ROLE,
            Value: CDK.ROLE.API,
          },
        ],
      });
    });

    it("creates export when provider is true", () => {
      const stack = new Stack();
      new JaypieEnvSecret(stack, "TestSecret", {
        provider: true,
        export: "TestSecretExport",
      });
      const template = Template.fromStack(stack);

      expect(template.template.Outputs).toBeObject();
      expect(Object.values(template.template.Outputs)[0]).toBeObject();
      expect(
        Object.values(template.template.Outputs)[0].Export.Name,
      ).toBeString();
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
      new JaypieEnvSecret(stack, "TestSecret", {
        value: "secret-value",
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::SecretsManager::Secret", {
        SecretString: "secret-value",
      });
    });
  });
});
