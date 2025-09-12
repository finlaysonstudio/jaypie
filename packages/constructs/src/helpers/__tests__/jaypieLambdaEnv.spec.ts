import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { jaypieLambdaEnv } from "../jaypieLambdaEnv.js";

describe("jaypieLambdaEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Base Cases", () => {
    it("should return default environment values when no options provided", () => {
      const result = jaypieLambdaEnv();

      expect(result).toEqual({
        AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING: "true",
      });
    });

    it("should return empty object when no defaults and no process env", () => {
      const result = jaypieLambdaEnv({ initialEnvironment: {} });

      expect(result.AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING).toBe("true");
    });
  });

  describe("Error Conditions", () => {
    it("should handle undefined initialEnvironment gracefully", () => {
      const result = jaypieLambdaEnv({ initialEnvironment: undefined as any });

      expect(result.AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING).toBe("true");
    });
  });

  describe("Happy Paths", () => {
    it("should merge initialEnvironment with defaults", () => {
      const result = jaypieLambdaEnv({
        initialEnvironment: {
          CUSTOM_VAR: "custom_value",
        },
      });

      expect(result).toEqual({
        AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING: "true",
        CUSTOM_VAR: "custom_value",
      });
    });

    it("should include process.env variables that are in defaultEnvVars list", () => {
      process.env.LOG_LEVEL = "debug";
      process.env.PROJECT_ENV = "test";
      process.env.NOT_IN_LIST = "should_not_appear";

      const result = jaypieLambdaEnv();

      expect(result.LOG_LEVEL).toBe("debug");
      expect(result.PROJECT_ENV).toBe("test");
      expect(result.NOT_IN_LIST).toBeUndefined();
    });

    it("should prioritize initialEnvironment over process.env", () => {
      process.env.LOG_LEVEL = "info";

      const result = jaypieLambdaEnv({
        initialEnvironment: {
          LOG_LEVEL: "debug",
        },
      });

      expect(result.LOG_LEVEL).toBe("debug");
    });
  });

  describe("Features", () => {
    it("should allow overriding default environment values with strings", () => {
      const result = jaypieLambdaEnv({
        initialEnvironment: {
          AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING: "false",
        },
      });

      expect(result.AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING).toBe("false");
    });

    it("should omit default environment values when user passes falsy non-string", () => {
      const result = jaypieLambdaEnv({
        initialEnvironment: {
          AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING: null as any,
        },
      });

      expect(result.AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING).toBeUndefined();
    });

    it("should ignore non-string truthy values for default environment", () => {
      const result = jaypieLambdaEnv({
        initialEnvironment: {
          AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING: {
            invalid: "object",
          } as any,
        },
      });

      expect(result).not.toHaveProperty(
        "AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING",
      );
    });

    it("should handle all defaultEnvVars from process.env", () => {
      const envVars = {
        DATADOG_API_KEY_ARN:
          "arn:aws:secretsmanager:us-east-1:123456789:secret:datadog",
        LOG_LEVEL: "debug",
        MODULE_LOGGER: "winston",
        MODULE_LOG_LEVEL: "info",
        PROJECT_COMMIT: "abc123",
        PROJECT_ENV: "production",
        PROJECT_KEY: "my-project",
        PROJECT_SECRET: "secret123",
        PROJECT_SERVICE: "my-service",
        PROJECT_SPONSOR: "engineering",
        PROJECT_VERSION: "1.0.0",
      };

      Object.entries(envVars).forEach(([key, value]) => {
        process.env[key] = value;
      });

      const result = jaypieLambdaEnv();

      Object.entries(envVars).forEach(([key, value]) => {
        expect(result[key]).toBe(value);
      });
    });
  });

  describe("Specific Scenarios", () => {
    it("should not include process.env variables that are not in defaultEnvVars list", () => {
      process.env.RANDOM_VAR = "should_not_appear";
      process.env.ANOTHER_VAR = "also_should_not_appear";

      const result = jaypieLambdaEnv();

      expect(result.RANDOM_VAR).toBeUndefined();
      expect(result.ANOTHER_VAR).toBeUndefined();
    });

    it("should not override existing initialEnvironment with process.env", () => {
      process.env.LOG_LEVEL = "error";

      const result = jaypieLambdaEnv({
        initialEnvironment: {
          LOG_LEVEL: "warn",
        },
      });

      expect(result.LOG_LEVEL).toBe("warn");
    });

    it("should handle empty string values from process.env", () => {
      process.env.LOG_LEVEL = "";

      const result = jaypieLambdaEnv();

      expect(result.LOG_LEVEL).toBeUndefined();
    });
  });
});
