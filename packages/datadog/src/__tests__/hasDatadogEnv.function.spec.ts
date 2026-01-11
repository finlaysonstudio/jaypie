import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DATADOG } from "../constants.js";
import hasDatadogEnv from "../hasDatadogEnv.function.js";

//
//
// Tests
//

describe("hasDatadogEnv", () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  //
  // Base Cases
  //
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(hasDatadogEnv).toBeInstanceOf(Function);
    });

    it("returns false when no Datadog env vars are set", () => {
      delete process.env[DATADOG.ENV.DATADOG_API_KEY];
      delete process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY];
      delete process.env[DATADOG.ENV.DATADOG_API_KEY_ARN];
      delete process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN];

      expect(hasDatadogEnv()).toBe(false);
    });
  });

  //
  // Happy Paths
  //
  describe("Happy Paths", () => {
    it("returns true when DATADOG_API_KEY is set", () => {
      delete process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY];
      delete process.env[DATADOG.ENV.DATADOG_API_KEY_ARN];
      delete process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN];
      process.env[DATADOG.ENV.DATADOG_API_KEY] = "test-api-key";

      expect(hasDatadogEnv()).toBe(true);
    });

    it("returns true when SECRET_DATADOG_API_KEY is set", () => {
      delete process.env[DATADOG.ENV.DATADOG_API_KEY];
      delete process.env[DATADOG.ENV.DATADOG_API_KEY_ARN];
      delete process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN];
      process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY] = "secret-test-api-key";

      expect(hasDatadogEnv()).toBe(true);
    });

    it("returns true when DATADOG_API_KEY_ARN is set", () => {
      delete process.env[DATADOG.ENV.DATADOG_API_KEY];
      delete process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY];
      delete process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN];
      process.env[DATADOG.ENV.DATADOG_API_KEY_ARN] =
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:test";

      expect(hasDatadogEnv()).toBe(true);
    });

    it("returns true when DD_API_KEY_SECRET_ARN is set", () => {
      delete process.env[DATADOG.ENV.DATADOG_API_KEY];
      delete process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY];
      delete process.env[DATADOG.ENV.DATADOG_API_KEY_ARN];
      process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN] =
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:dd-test";

      expect(hasDatadogEnv()).toBe(true);
    });

    it("returns true when multiple Datadog env vars are set", () => {
      process.env[DATADOG.ENV.DATADOG_API_KEY] = "test-api-key";
      process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY] = "secret-test-api-key";
      process.env[DATADOG.ENV.DATADOG_API_KEY_ARN] =
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:test";
      process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN] =
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:dd-test";

      expect(hasDatadogEnv()).toBe(true);
    });
  });

  //
  // Specific Scenarios
  //
  describe("Specific Scenarios", () => {
    it("returns false when env vars are empty strings", () => {
      process.env[DATADOG.ENV.DATADOG_API_KEY] = "";
      process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY] = "";
      process.env[DATADOG.ENV.DATADOG_API_KEY_ARN] = "";
      process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN] = "";

      expect(hasDatadogEnv()).toBe(false);
    });
  });
});
