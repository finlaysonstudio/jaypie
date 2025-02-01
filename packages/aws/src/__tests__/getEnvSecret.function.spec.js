import axios from "axios";
import { cloneDeep } from "jaypie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import getEnvSecret from "../getEnvSecret.function.js";

//
//
// Mock constants
//

const MOCK = {
  AWS_SESSION_TOKEN: "MOCK_AWS_SESSION_TOKEN",
  SECRET: "MOCK_SECRET",
  SECRET_RESPONSE: "MOCK_SECRET_RESPONSE",
};

//
//
// Mock modules
//

// Mock axios
vi.mock("axios", async () => {
  // My function
  const actual = await vi.importActual("axios");
  const module = {
    default: {
      ...actual.default,
      get: vi.fn(() => ({ data: { SecretString: MOCK.SECRET_RESPONSE } })),
    },
  };
  return module;
});

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  process.env.AWS_SESSION_TOKEN = MOCK.AWS_SESSION_TOKEN;
});
afterEach(() => {
  process.env = DEFAULT_ENV;
});

//
//
// Run tests
//

describe("Get Environment Secret Function", () => {
  describe("Base Cases", () => {
    it("Works", async () => {
      process.env.SECRET_TEST_KEY = "SECRET_TEST_VALUE";
      const response = await getEnvSecret("TEST_KEY");
      expect(response).not.toBeUndefined();
      expect(response).toBe(MOCK.SECRET_RESPONSE);
    });
  });

  describe("Error Cases", () => {
    it("Throws if no AWS_SESSION_TOKEN", async () => {
      delete process.env.AWS_SESSION_TOKEN;
      await expect(getEnvSecret(MOCK.SECRET)).rejects.toThrow(
        "No AWS_SESSION_TOKEN available",
      );
    });
    it("Throws if no secret name provided", async () => {
      await expect(getEnvSecret()).rejects.toThrow("No secret name provided");
    });
    it("Throws if no secret found in environment", async () => {
      const env = {};
      await expect(async () =>
        getEnvSecret("test", { env }),
      ).toThrowConfigurationError();
    });
  });

  describe("Features", () => {
    it("Uses SECRET_name if available", async () => {
      const env = cloneDeep(process.env);
      env.SECRET_test = "secret1";
      await getEnvSecret("test", { env });
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:2773/secretsmanager/get",
        {
          headers: {
            "X-Aws-Parameters-Secrets-Token": MOCK.AWS_SESSION_TOKEN,
          },
          params: { secretId: "secret1" },
        },
      );
    });

    it("Uses name_SECRET if available", async () => {
      const env = cloneDeep(process.env);
      env.test_SECRET = "secret2";
      await getEnvSecret("test", { env });
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:2773/secretsmanager/get",
        {
          headers: {
            "X-Aws-Parameters-Secrets-Token": MOCK.AWS_SESSION_TOKEN,
          },
          params: { secretId: "secret2" },
        },
      );
    });

    it("Uses name if available", async () => {
      const env = cloneDeep(process.env);
      env.test = "secret3";
      await getEnvSecret("test", { env });
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:2773/secretsmanager/get",
        {
          headers: {
            "X-Aws-Parameters-Secrets-Token": MOCK.AWS_SESSION_TOKEN,
          },
          params: { secretId: "secret3" },
        },
      );
    });

    it("Prioritizes SECRET_name over name_SECRET over name", async () => {
      const env = cloneDeep(process.env);
      env.SECRET_test = "secret1";
      env.test_SECRET = "secret2";
      env.test = "secret3";
      await getEnvSecret("test", { env });
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:2773/secretsmanager/get",
        {
          headers: {
            "X-Aws-Parameters-Secrets-Token": MOCK.AWS_SESSION_TOKEN,
          },
          params: { secretId: "secret1" },
        },
      );
    });
  });
});
