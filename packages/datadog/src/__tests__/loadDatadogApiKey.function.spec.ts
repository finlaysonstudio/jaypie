import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { getSecret } from "@jaypie/aws";

import { DATADOG } from "../constants.js";

// Subject
import loadDatadogApiKey from "../loadDatadogApiKey.function.js";

//
//
// Mock constants
//

const MOCK = {
  ARN: "arn:aws:secretsmanager:us-east-1:123456789012:secret:dd-api-key",
  SECRET: "MOCK_DD_API_KEY_VALUE",
};

//
//
// Mock modules
//

vi.mock("@jaypie/aws");

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  delete process.env[DATADOG.ENV.DD_LLMOBS_ENABLED];
  delete process.env[DATADOG.ENV.DD_API_KEY];
  delete process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN];
  delete process.env[DATADOG.ENV.DATADOG_API_KEY];
  (getSecret as Mock).mockResolvedValue(MOCK.SECRET);
});
afterEach(() => {
  process.env = DEFAULT_ENV;
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("loadDatadogApiKey", () => {
  it("Is a function", () => {
    expect(loadDatadogApiKey).toBeFunction();
  });

  it("Works (no params)", async () => {
    const result = await loadDatadogApiKey();
    expect(result).toBeFalse();
  });

  describe("No-op cases", () => {
    it("Returns false when DD_LLMOBS_ENABLED is unset", async () => {
      process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN] = MOCK.ARN;
      const result = await loadDatadogApiKey();
      expect(result).toBeFalse();
      expect(getSecret).not.toHaveBeenCalled();
    });

    it.each(["0", "false", "FALSE", " false ", ""])(
      "Returns false when DD_LLMOBS_ENABLED is %j",
      async (value) => {
        process.env[DATADOG.ENV.DD_LLMOBS_ENABLED] = value;
        process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN] = MOCK.ARN;
        const result = await loadDatadogApiKey();
        expect(result).toBeFalse();
        expect(getSecret).not.toHaveBeenCalled();
      },
    );

    it("Returns false when DD_API_KEY_SECRET_ARN is absent", async () => {
      process.env[DATADOG.ENV.DD_LLMOBS_ENABLED] = "true";
      const result = await loadDatadogApiKey();
      expect(result).toBeFalse();
      expect(getSecret).not.toHaveBeenCalled();
    });

    it("Returns false when DD_API_KEY is already present", async () => {
      process.env[DATADOG.ENV.DD_LLMOBS_ENABLED] = "true";
      process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN] = MOCK.ARN;
      process.env[DATADOG.ENV.DD_API_KEY] = "EXISTING";
      const result = await loadDatadogApiKey();
      expect(result).toBeFalse();
      expect(getSecret).not.toHaveBeenCalled();
      expect(process.env[DATADOG.ENV.DD_API_KEY]).toBe("EXISTING");
    });

    it("Returns false when DATADOG_API_KEY is already present", async () => {
      process.env[DATADOG.ENV.DD_LLMOBS_ENABLED] = "true";
      process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN] = MOCK.ARN;
      process.env[DATADOG.ENV.DATADOG_API_KEY] = "EXISTING";
      const result = await loadDatadogApiKey();
      expect(result).toBeFalse();
      expect(getSecret).not.toHaveBeenCalled();
      expect(process.env[DATADOG.ENV.DD_API_KEY]).toBeUndefined();
    });
  });

  describe("Loads the key", () => {
    beforeEach(() => {
      process.env[DATADOG.ENV.DD_LLMOBS_ENABLED] = "true";
      process.env[DATADOG.ENV.DD_API_KEY_SECRET_ARN] = MOCK.ARN;
    });

    it("Fetches the secret ARN and sets DD_API_KEY", async () => {
      const result = await loadDatadogApiKey();
      expect(result).toBeTrue();
      expect(getSecret).toHaveBeenCalledWith(MOCK.ARN);
      expect(process.env[DATADOG.ENV.DD_API_KEY]).toBe(MOCK.SECRET);
    });

    it.each(["true", "1", "yes", "TRUE"])(
      "Accepts truthy DD_LLMOBS_ENABLED value %j",
      async (value) => {
        process.env[DATADOG.ENV.DD_LLMOBS_ENABLED] = value;
        const result = await loadDatadogApiKey();
        expect(result).toBeTrue();
      },
    );

    it("Returns false and does not set DD_API_KEY when secret is empty", async () => {
      (getSecret as Mock).mockResolvedValue(undefined);
      const result = await loadDatadogApiKey();
      expect(result).toBeFalse();
      expect(process.env[DATADOG.ENV.DD_API_KEY]).toBeUndefined();
    });
  });
});
