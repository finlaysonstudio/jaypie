import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Stack } from "aws-cdk-lib";

import { JaypieEnvSecret } from "../../JaypieEnvSecret.js";
import { resolveSecrets, clearSecretsCache } from "../resolveSecrets";

describe("resolveSecrets", () => {
  const originalEnv = { ...process.env };
  let stack: Stack;

  beforeEach(() => {
    stack = new Stack();
    // Set up some test environment variables
    process.env.AUTH0_CLIENT_SECRET = "auth0-secret-value";
    process.env.AUTH0_SECRET = "another-auth0-secret";
    process.env.MONGODB_URI = "mongodb://localhost:27017/test";
    process.env.PROJECT_ENV = "test";
    process.env.PROJECT_KEY = "test-key";
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
    // Clear the secrets cache
    clearSecretsCache(stack);
  });

  describe("Base Cases", () => {
    it("is a function", () => {
      expect(resolveSecrets).toBeTypeOf("function");
    });

    it("returns empty array when undefined", () => {
      const result = resolveSecrets(stack, undefined);
      expect(result).toEqual([]);
    });

    it("returns empty array when empty array", () => {
      const result = resolveSecrets(stack, []);
      expect(result).toEqual([]);
    });
  });

  describe("Happy Paths", () => {
    describe("JaypieEnvSecret instances", () => {
      it("passes through single JaypieEnvSecret", () => {
        const secret = new JaypieEnvSecret(stack, "TestSecret", {
          envKey: "TEST_KEY",
          value: "test-value",
        });
        const result = resolveSecrets(stack, [secret]);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(secret);
      });

      it("passes through multiple JaypieEnvSecret instances", () => {
        const secret1 = new JaypieEnvSecret(stack, "TestSecret1", {
          envKey: "TEST_KEY_1",
          value: "test-value-1",
        });
        const secret2 = new JaypieEnvSecret(stack, "TestSecret2", {
          envKey: "TEST_KEY_2",
          value: "test-value-2",
        });
        const result = resolveSecrets(stack, [secret1, secret2]);
        expect(result).toHaveLength(2);
        expect(result[0]).toBe(secret1);
        expect(result[1]).toBe(secret2);
      });
    });

    describe("String inputs", () => {
      it("creates JaypieEnvSecret from single string", () => {
        const result = resolveSecrets(stack, ["AUTH0_CLIENT_SECRET"]);
        expect(result).toHaveLength(1);
        expect(result[0]).toBeInstanceOf(JaypieEnvSecret);
        expect(result[0].envKey).toBe("AUTH0_CLIENT_SECRET");
      });

      it("creates JaypieEnvSecrets from multiple strings", () => {
        const result = resolveSecrets(stack, [
          "AUTH0_CLIENT_SECRET",
          "AUTH0_SECRET",
        ]);
        expect(result).toHaveLength(2);
        expect(result[0]).toBeInstanceOf(JaypieEnvSecret);
        expect(result[0].envKey).toBe("AUTH0_CLIENT_SECRET");
        expect(result[1]).toBeInstanceOf(JaypieEnvSecret);
        expect(result[1].envKey).toBe("AUTH0_SECRET");
      });
    });

    describe("Mixed inputs", () => {
      it("handles mix of strings and JaypieEnvSecret instances", () => {
        const existingSecret = new JaypieEnvSecret(stack, "ExistingSecret", {
          envKey: "EXISTING_KEY",
          value: "existing-value",
        });
        const result = resolveSecrets(stack, [
          existingSecret,
          "AUTH0_CLIENT_SECRET",
        ]);
        expect(result).toHaveLength(2);
        expect(result[0]).toBe(existingSecret);
        expect(result[1]).toBeInstanceOf(JaypieEnvSecret);
        expect(result[1].envKey).toBe("AUTH0_CLIENT_SECRET");
      });
    });
  });

  describe("Features", () => {
    describe("Secret caching", () => {
      it("reuses secrets within the same scope", () => {
        const result1 = resolveSecrets(stack, ["AUTH0_CLIENT_SECRET"]);
        const result2 = resolveSecrets(stack, ["AUTH0_CLIENT_SECRET"]);
        expect(result1[0]).toBe(result2[0]); // Same instance
      });

      it("reuses secrets across multiple resolveSecrets calls", () => {
        const result1 = resolveSecrets(stack, ["AUTH0_CLIENT_SECRET"]);
        const result2 = resolveSecrets(stack, [
          "AUTH0_SECRET",
          "AUTH0_CLIENT_SECRET",
        ]);
        expect(result2[1]).toBe(result1[0]); // AUTH0_CLIENT_SECRET should be the same
        expect(result2[0]).not.toBe(result1[0]); // AUTH0_SECRET is different
      });

      it("creates different secrets for different scopes", () => {
        const stack2 = new Stack();
        const result1 = resolveSecrets(stack, ["AUTH0_CLIENT_SECRET"]);
        const result2 = resolveSecrets(stack2, ["AUTH0_CLIENT_SECRET"]);
        expect(result1[0]).not.toBe(result2[0]); // Different instances
        expect(result1[0].envKey).toBe(result2[0].envKey); // Same envKey
      });
    });

    describe("clearSecretsCache", () => {
      it("clears cache for specific scope", () => {
        const result1 = resolveSecrets(stack, ["AUTH0_CLIENT_SECRET"]);
        expect(result1).toHaveLength(1);
        clearSecretsCache(stack);

        // After clearing, a new call will create new secret
        // This will throw because we can't create a secret with the same construct ID
        // So this test verifies the cache was cleared by the error
        expect(() => {
          resolveSecrets(stack, ["AUTH0_CLIENT_SECRET"]);
        }).toThrow(); // CDK error: There is already a Construct with name
      });
    });
  });

  describe("Specific Scenarios", () => {
    it("handles the user's example use case", () => {
      const result = resolveSecrets(stack, [
        "AUTH0_CLIENT_SECRET",
        "AUTH0_SECRET",
        "MONGODB_URI",
      ]);

      expect(result).toHaveLength(3);
      expect(result[0].envKey).toBe("AUTH0_CLIENT_SECRET");
      expect(result[1].envKey).toBe("AUTH0_SECRET");
      expect(result[2].envKey).toBe("MONGODB_URI");
    });

    it("shares secrets across multiple lambdas in same scope", () => {
      // First lambda uses AUTH0_CLIENT_SECRET
      const secrets1 = resolveSecrets(stack, ["AUTH0_CLIENT_SECRET"]);

      // Second lambda also uses AUTH0_CLIENT_SECRET
      const secrets2 = resolveSecrets(stack, [
        "AUTH0_CLIENT_SECRET",
        "MONGODB_URI",
      ]);

      // They should share the AUTH0_CLIENT_SECRET instance
      expect(secrets1[0]).toBe(secrets2[0]);
    });
  });
});
