import { getEnvSecret, getSecret } from "@jaypie/aws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { DATADOG } from "../constants.js";

// Subject
import {
  resolveDatadogApiKey,
  resolveDatadogAppKey,
} from "../resolveDatadogKeys.function.js";

//
//
// Mock constants
//

const MOCK = {
  ENV_SECRET_VALUE: "MOCK_ENV_SECRET_VALUE",
  SECRET_VALUE: "MOCK_SECRET_VALUE",
};

//
//
// Mock modules
//

vi.mock("@jaypie/aws");

const KEY_ENV = [
  DATADOG.ENV.DATADOG_API_KEY,
  DATADOG.ENV.DATADOG_API_KEY_ARN,
  DATADOG.ENV.DATADOG_APP_KEY,
  DATADOG.ENV.DATADOG_APPLICATION_KEY,
  DATADOG.ENV.DD_API_KEY,
  DATADOG.ENV.DD_API_KEY_SECRET_ARN,
  DATADOG.ENV.DD_APP_KEY,
  DATADOG.ENV.DD_APPLICATION_KEY,
  DATADOG.ENV.SECRET_DATADOG_API_KEY,
];

beforeEach(() => {
  for (const name of KEY_ENV) {
    delete process.env[name];
    delete process.env[`SECRET_${name}`];
    delete process.env[`${name}_SECRET`];
  }
  (getSecret as Mock).mockResolvedValue(MOCK.SECRET_VALUE);
  (getEnvSecret as Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  for (const name of KEY_ENV) {
    delete process.env[name];
    delete process.env[`SECRET_${name}`];
    delete process.env[`${name}_SECRET`];
  }
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Resolve Datadog Keys", () => {
  describe("Base Cases", () => {
    it("Are functions", () => {
      expect(resolveDatadogApiKey).toBeFunction();
      expect(resolveDatadogAppKey).toBeFunction();
    });
    it("Accept no parameters", async () => {
      await expect(resolveDatadogApiKey()).resolves.toBeUndefined();
      await expect(resolveDatadogAppKey()).resolves.toBeUndefined();
    });
  });

  describe("API Key", () => {
    it("Returns an explicit key", async () => {
      await expect(
        resolveDatadogApiKey({ apiKey: "MOCK_EXPLICIT_KEY" }),
      ).resolves.toBe("MOCK_EXPLICIT_KEY");
      expect(getEnvSecret).not.toHaveBeenCalled();
    });
    it("Prefers an explicit secret over an explicit key", async () => {
      await expect(
        resolveDatadogApiKey({
          apiKey: "MOCK_EXPLICIT_KEY",
          apiSecret: "MOCK_SECRET_NAME",
        }),
      ).resolves.toBe(MOCK.SECRET_VALUE);
      expect(getSecret).toHaveBeenCalledWith("MOCK_SECRET_NAME");
    });
    it("Resolves each legacy ARN variable through getSecret", async () => {
      for (const name of [
        DATADOG.ENV.SECRET_DATADOG_API_KEY,
        DATADOG.ENV.DATADOG_API_KEY_ARN,
        DATADOG.ENV.DD_API_KEY_SECRET_ARN,
      ]) {
        process.env[name] = `MOCK_ARN_${name}`;
        await expect(resolveDatadogApiKey()).resolves.toBe(MOCK.SECRET_VALUE);
        expect(getSecret).toHaveBeenCalledWith(`MOCK_ARN_${name}`);
        delete process.env[name];
      }
    });
    it("Falls back to getEnvSecret for the plain variable", async () => {
      (getEnvSecret as Mock).mockResolvedValue(MOCK.ENV_SECRET_VALUE);
      await expect(resolveDatadogApiKey()).resolves.toBe(MOCK.ENV_SECRET_VALUE);
      expect(getEnvSecret).toHaveBeenCalledWith(DATADOG.ENV.DATADOG_API_KEY);
    });
    it("Tries DD_API_KEY when DATADOG_API_KEY yields nothing", async () => {
      (getEnvSecret as Mock).mockImplementation(async (name: string) =>
        name === DATADOG.ENV.DD_API_KEY ? MOCK.ENV_SECRET_VALUE : undefined,
      );
      await expect(resolveDatadogApiKey()).resolves.toBe(MOCK.ENV_SECRET_VALUE);
      expect(getEnvSecret).toHaveBeenCalledWith(DATADOG.ENV.DD_API_KEY);
    });
  });

  describe("App Key", () => {
    it("Returns an explicit key", async () => {
      await expect(resolveDatadogAppKey("MOCK_EXPLICIT_APP_KEY")).resolves.toBe(
        "MOCK_EXPLICIT_APP_KEY",
      );
      expect(getEnvSecret).not.toHaveBeenCalled();
    });
    it("Resolves through getEnvSecret", async () => {
      (getEnvSecret as Mock).mockResolvedValue(MOCK.ENV_SECRET_VALUE);
      await expect(resolveDatadogAppKey()).resolves.toBe(MOCK.ENV_SECRET_VALUE);
      expect(getEnvSecret).toHaveBeenCalledWith(DATADOG.ENV.DATADOG_APP_KEY);
    });
    it("Tries every application key alias in order", async () => {
      (getEnvSecret as Mock).mockImplementation(async (name: string) =>
        name === DATADOG.ENV.DD_APPLICATION_KEY
          ? MOCK.ENV_SECRET_VALUE
          : undefined,
      );
      await expect(resolveDatadogAppKey()).resolves.toBe(MOCK.ENV_SECRET_VALUE);
      expect(getEnvSecret).toHaveBeenCalledTimes(4);
      expect(getEnvSecret).toHaveBeenNthCalledWith(
        1,
        DATADOG.ENV.DATADOG_APP_KEY,
      );
      expect(getEnvSecret).toHaveBeenNthCalledWith(
        4,
        DATADOG.ENV.DD_APPLICATION_KEY,
      );
    });
  });
});
