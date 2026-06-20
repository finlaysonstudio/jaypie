import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { jaypieLambdaEnv } from "../jaypieLambdaEnv.js";

describe("jaypieLambdaEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear all environment variables that could affect tests
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
    delete process.env.NOT_IN_LIST;
    delete process.env.RANDOM_VAR;
    delete process.env.ANOTHER_VAR;
    delete process.env.DD_LLMOBS_ENABLED;
    delete process.env.DD_LLMOBS_ML_APP;
    delete process.env.DD_VERSION;
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

  describe("serviceTag", () => {
    it("should set DD_SERVICE from serviceTag", () => {
      const result = jaypieLambdaEnv({ serviceTag: "my-service" });

      expect(result.DD_SERVICE).toBe("my-service");
    });

    it("should let explicit initialEnvironment DD_SERVICE win over serviceTag", () => {
      const result = jaypieLambdaEnv({
        initialEnvironment: { DD_SERVICE: "explicit-service" },
        serviceTag: "my-service",
      });

      expect(result.DD_SERVICE).toBe("explicit-service");
    });

    it("should not set PROJECT_SERVICE from serviceTag", () => {
      const result = jaypieLambdaEnv({ serviceTag: "my-service" });

      expect(result.PROJECT_SERVICE).toBeUndefined();
    });

    it("should still pass through process.env.PROJECT_SERVICE", () => {
      process.env.PROJECT_SERVICE = "env-service";

      const result = jaypieLambdaEnv({ serviceTag: "my-service" });

      expect(result.PROJECT_SERVICE).toBe("env-service");
      expect(result.DD_SERVICE).toBe("my-service");
    });
  });

  describe("Datadog Version", () => {
    it("should pass through DD_VERSION when set", () => {
      process.env.DD_VERSION = "1.2.3-abc";

      const result = jaypieLambdaEnv();

      expect(result.DD_VERSION).toBe("1.2.3-abc");
    });

    it("should not set DD_VERSION when unset", () => {
      const result = jaypieLambdaEnv();

      expect(result.DD_VERSION).toBeUndefined();
    });

    it("should not override explicit initialEnvironment DD_VERSION", () => {
      process.env.DD_VERSION = "from-env";

      const result = jaypieLambdaEnv({
        initialEnvironment: {
          DD_VERSION: "explicit",
        },
      });

      expect(result.DD_VERSION).toBe("explicit");
    });
  });

  describe("Datadog LLM Observability", () => {
    it("should pass through DD_LLMOBS_ENABLED when set", () => {
      process.env.DD_LLMOBS_ENABLED = "true";

      const result = jaypieLambdaEnv();

      expect(result.DD_LLMOBS_ENABLED).toBe("true");
    });

    it("should not set DD_LLMOBS_ENABLED when unset", () => {
      const result = jaypieLambdaEnv();

      expect(result.DD_LLMOBS_ENABLED).toBeUndefined();
    });

    it("should bring over DD_LLMOBS_ML_APP when set", () => {
      process.env.DD_LLMOBS_ENABLED = "true";
      process.env.DD_LLMOBS_ML_APP = "my-app";

      const result = jaypieLambdaEnv();

      expect(result.DD_LLMOBS_ML_APP).toBe("my-app");
    });

    it("should bring over DD_LLMOBS_ML_APP even when DD_LLMOBS_ENABLED is unset", () => {
      process.env.DD_LLMOBS_ML_APP = "my-app";

      const result = jaypieLambdaEnv();

      expect(result.DD_LLMOBS_ML_APP).toBe("my-app");
    });

    it("should not bring over DD_LLMOBS_ML_APP when DD_LLMOBS_ENABLED is 'false'", () => {
      process.env.DD_LLMOBS_ENABLED = "false";
      process.env.DD_LLMOBS_ML_APP = "my-app";

      const result = jaypieLambdaEnv();

      expect(result.DD_LLMOBS_ENABLED).toBe("false");
      expect(result.DD_LLMOBS_ML_APP).toBeUndefined();
    });

    it("should not bring over DD_LLMOBS_ML_APP when DD_LLMOBS_ENABLED is '0'", () => {
      process.env.DD_LLMOBS_ENABLED = "0";
      process.env.DD_LLMOBS_ML_APP = "my-app";

      const result = jaypieLambdaEnv();

      expect(result.DD_LLMOBS_ENABLED).toBe("0");
      expect(result.DD_LLMOBS_ML_APP).toBeUndefined();
    });

    it("should suppress process.env DD_LLMOBS_ML_APP when initialEnvironment disables observability", () => {
      process.env.DD_LLMOBS_ENABLED = "true";
      process.env.DD_LLMOBS_ML_APP = "env-app";

      const result = jaypieLambdaEnv({
        initialEnvironment: {
          DD_LLMOBS_ENABLED: "false",
        },
      });

      expect(result.DD_LLMOBS_ENABLED).toBe("false");
      expect(result.DD_LLMOBS_ML_APP).toBeUndefined();
    });

    it("should let explicit initialEnvironment win over process.env", () => {
      process.env.DD_LLMOBS_ENABLED = "true";
      process.env.DD_LLMOBS_ML_APP = "env-app";

      const result = jaypieLambdaEnv({
        initialEnvironment: {
          DD_LLMOBS_ENABLED: "false",
          DD_LLMOBS_ML_APP: "explicit-app",
        },
      });

      expect(result.DD_LLMOBS_ENABLED).toBe("false");
      expect(result.DD_LLMOBS_ML_APP).toBe("explicit-app");
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
