import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DATADOG } from "../constants.js";
import hasDatadogEnv from "../hasDatadogEnv.function.js";

//
//
// Constants
//

const KEY_ENV = [
  DATADOG.ENV.DATADOG_API_KEY,
  DATADOG.ENV.DATADOG_API_KEY_ARN,
  DATADOG.ENV.DD_API_KEY,
  DATADOG.ENV.DD_API_KEY_SECRET_ARN,
  DATADOG.ENV.SECRET_DATADOG_API_KEY,
];

function clearKeyEnv(): void {
  for (const name of KEY_ENV) {
    delete process.env[name];
    delete process.env[`SECRET_${name}`];
    delete process.env[`${name}_SECRET`];
  }
}

//
//
// Tests
//

describe("hasDatadogEnv", () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    originalEnv = { ...process.env };
    clearKeyEnv();
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
      expect(hasDatadogEnv()).toBe(false);
    });
  });

  //
  // Happy Paths
  //
  describe("Happy Paths", () => {
    it("returns true when DATADOG_API_KEY is set", () => {
      process.env[DATADOG.ENV.DATADOG_API_KEY] = "test-api-key";

      expect(hasDatadogEnv()).toBe(true);
    });

    it("returns true when DD_API_KEY is set", () => {
      process.env[DATADOG.ENV.DD_API_KEY] = "test-api-key";

      expect(hasDatadogEnv()).toBe(true);
    });

    it("returns true when SECRET_DATADOG_API_KEY is set", () => {
      process.env[DATADOG.ENV.SECRET_DATADOG_API_KEY] = "secret-test-api-key";

      expect(hasDatadogEnv()).toBe(true);
    });

    it("returns true when DATADOG_API_KEY_ARN is set", () => {
      process.env[DATADOG.ENV.DATADOG_API_KEY_ARN] =
        "arn:aws:secretsmanager:us-east-1:123456789012:secret:test";

      expect(hasDatadogEnv()).toBe(true);
    });

    it("returns true when DD_API_KEY_SECRET_ARN is set", () => {
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
  // Features
  //
  describe("Features", () => {
    it.each([
      "DATADOG_API_KEY_SECRET",
      "DD_API_KEY_SECRET",
      "SECRET_DD_API_KEY",
    ])("returns true for the getEnvSecret reference %s", (name) => {
      process.env[name] = "datadog-api-key-secret-name";

      expect(hasDatadogEnv()).toBe(true);
    });
  });

  //
  // Specific Scenarios
  //
  describe("Specific Scenarios", () => {
    it("returns false when env vars are empty strings", () => {
      for (const name of KEY_ENV) {
        process.env[name] = "";
      }

      expect(hasDatadogEnv()).toBe(false);
    });

    it("ignores application key variables", () => {
      process.env[DATADOG.ENV.DATADOG_APP_KEY] = "test-app-key";

      expect(hasDatadogEnv()).toBe(false);
    });
  });
});
