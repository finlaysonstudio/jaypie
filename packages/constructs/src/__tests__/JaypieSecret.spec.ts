import { ConfigurationError } from "@jaypie/errors";
import { expect, it, describe, afterEach } from "vitest";
import { RemovalPolicy, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { JaypieEnvSecret } from "../JaypieEnvSecret.js";
import { JaypieSecret } from "../JaypieSecret.js";
import { CDK } from "../constants";

describe("JaypieSecret", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(JaypieSecret).toBeFunction();
    });

    it("creates a secret", () => {
      const stack = new Stack();
      const secret = new JaypieSecret(stack, "TestSecret");
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::SecretsManager::Secret", {});
      expect(secret).toBeDefined();
    });

    it("is a JaypieSecret and JaypieEnvSecret extends it", () => {
      const stack = new Stack();
      const secret = new JaypieSecret(stack, "TestSecret");
      const envSecret = new JaypieEnvSecret(stack, "TestEnvSecret");

      expect(secret).toBeInstanceOf(JaypieSecret);
      expect(envSecret).toBeInstanceOf(JaypieSecret);
      expect(envSecret).toBeInstanceOf(JaypieEnvSecret);
    });
  });

  describe("Features", () => {
    it("adds role tag", () => {
      const stack = new Stack();
      const secret = new JaypieSecret(stack, "TestSecret", {
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

    it("adds vendor tag", () => {
      const stack = new Stack();
      new JaypieSecret(stack, "TestSecret", {
        vendorTag: CDK.VENDOR.MONGODB,
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::SecretsManager::Secret", {
        Tags: [
          {
            Key: CDK.TAG.VENDOR,
            Value: CDK.VENDOR.MONGODB,
          },
        ],
      });
    });

    it("uses environment variable value when envKey is set", () => {
      process.env.TEST_SECRET_VALUE = "env-secret-value";
      const stack = new Stack();
      const secret = new JaypieSecret(stack, "TestSecret", {
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
      const secret = new JaypieSecret(stack, "TestSecret", {
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

    it("sets string value when value is string", () => {
      const stack = new Stack();
      const secret = new JaypieSecret(stack, "TestSecret", {
        value: "secret-value",
      });
      const template = Template.fromStack(stack);

      expect(secret).toBeDefined();
      template.resourceCountIs("AWS::SecretsManager::Secret", 1);
      template.hasResourceProperties("AWS::SecretsManager::Secret", {
        SecretString: "secret-value",
      });
    });

    it("exposes envKey through getter", () => {
      process.env.TEST_ENV_KEY = "test-value";
      const stack = new Stack();
      const secret = new JaypieSecret(stack, "TestSecret", {
        envKey: "TEST_ENV_KEY",
      });

      expect(secret.envKey).toBe("TEST_ENV_KEY");
      delete process.env.TEST_ENV_KEY;
    });

    it("applies RETAIN removal policy when removalPolicy is true", () => {
      const stack = new Stack();
      new JaypieSecret(stack, "TestSecret", {
        removalPolicy: true,
      });
      const template = Template.fromStack(stack);

      template.hasResource("AWS::SecretsManager::Secret", {
        DeletionPolicy: "Retain",
        UpdateReplacePolicy: "Retain",
      });
    });

    it("applies DESTROY removal policy when removalPolicy is false", () => {
      const stack = new Stack();
      new JaypieSecret(stack, "TestSecret", {
        removalPolicy: false,
      });
      const template = Template.fromStack(stack);

      template.hasResource("AWS::SecretsManager::Secret", {
        DeletionPolicy: "Delete",
        UpdateReplacePolicy: "Delete",
      });
    });

    it("accepts RemovalPolicy enum directly", () => {
      const stack = new Stack();
      new JaypieSecret(stack, "TestSecret", {
        removalPolicy: RemovalPolicy.RETAIN,
      });
      const template = Template.fromStack(stack);

      template.hasResource("AWS::SecretsManager::Secret", {
        DeletionPolicy: "Retain",
        UpdateReplacePolicy: "Retain",
      });
    });
  });

  describe("No producer/consumer behavior", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("never imports a secret, even in a personal (consumer) environment", () => {
      process.env.MY_SECRET = "my-value";
      process.env.PROJECT_ENV = CDK.ENV.PERSONAL;
      process.env.PROJECT_KEY = "testproject";

      const stack = new Stack();
      new JaypieSecret(stack, "MY_SECRET");
      const template = Template.fromStack(stack);

      // A real secret is created rather than imported via Fn::ImportValue
      template.resourceCountIs("AWS::SecretsManager::Secret", 1);
    });

    it("never emits a cross-stack export, even in a sandbox (provider) environment", () => {
      process.env.MY_SECRET = "my-value";
      process.env.PROJECT_ENV = CDK.ENV.SANDBOX;
      process.env.PROJECT_KEY = "testproject";

      const stack = new Stack();
      new JaypieSecret(stack, "MY_SECRET");
      const template = Template.fromStack(stack);

      const outputs = template.findOutputs("*");
      expect(Object.keys(outputs).length).toBe(0);
    });
  });

  describe("Error Cases", () => {
    it("throws ConfigurationError when envKey is set but env var is missing and no value or generateSecretString", () => {
      delete process.env.MISSING_SECRET;
      const stack = new Stack();
      expect(() => {
        new JaypieSecret(stack, "TestSecret", {
          envKey: "MISSING_SECRET",
        });
      }).toThrow(ConfigurationError);
    });

    it("throws ConfigurationError when envKey is set but env var is empty string", () => {
      process.env.EMPTY_SECRET = "";
      const stack = new Stack();
      expect(() => {
        new JaypieSecret(stack, "TestSecret", {
          envKey: "EMPTY_SECRET",
        });
      }).toThrow(ConfigurationError);
      delete process.env.EMPTY_SECRET;
    });

    it("does not throw when envKey is missing but value is provided", () => {
      delete process.env.MISSING_SECRET;
      const stack = new Stack();
      expect(() => {
        new JaypieSecret(stack, "TestSecret", {
          envKey: "MISSING_SECRET",
          value: "fallback",
        });
      }).not.toThrow();
    });

    it("does not throw when envKey is missing but generateSecretString is provided", () => {
      delete process.env.MISSING_SECRET;
      const stack = new Stack();
      expect(() => {
        new JaypieSecret(stack, "TestSecret", {
          envKey: "MISSING_SECRET",
          generateSecretString: {},
        });
      }).not.toThrow();
    });

    it("does not throw when no envKey is set (plain secret)", () => {
      const stack = new Stack();
      expect(() => {
        new JaypieSecret(stack, "TestSecret");
      }).not.toThrow();
    });

    it("throws ConfigurationError when shorthand env key is missing from process.env", () => {
      delete process.env.MISSING_SHORTHAND_SECRET;
      const stack = new Stack();
      expect(() => {
        new JaypieSecret(stack, "MISSING_SHORTHAND_SECRET");
      }).toThrow(ConfigurationError);
    });

    it("does not throw when shorthand env key is missing but value is provided", () => {
      delete process.env.MISSING_SHORTHAND_SECRET;
      const stack = new Stack();
      expect(() => {
        new JaypieSecret(stack, "MISSING_SHORTHAND_SECRET", {
          value: "fallback",
        });
      }).not.toThrow();
    });
  });
});
