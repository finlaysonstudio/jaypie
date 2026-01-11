import axios from "axios";
import { cloneDeep } from "jaypie";
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from "vitest";

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
      ...(actual as { default: typeof axios }).default,
      get: vi.fn(() => ({ data: { SecretString: MOCK.SECRET_RESPONSE } })),
    },
  };
  return module;
});

// Mock AWS SDK
vi.mock("@aws-sdk/client-secrets-manager", () => ({
  GetSecretValueCommand: vi.fn(),
  SecretsManagerClient: vi.fn(() => ({
    send: vi.fn(() => Promise.resolve({ SecretString: MOCK.SECRET_RESPONSE })),
  })),
}));

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
  vi.clearAllMocks();
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
    it("Throws if secret reference but no AWS_SESSION_TOKEN", async () => {
      delete process.env.AWS_SESSION_TOKEN;
      process.env.SECRET_TEST_KEY = "SECRET_TEST_VALUE";
      await expect(getEnvSecret("TEST_KEY")).rejects.toThrow(
        "No AWS_SESSION_TOKEN available",
      );
    });
    it("Throws if no secret name provided", async () => {
      await expect(
        getEnvSecret(undefined as unknown as string),
      ).rejects.toThrow("No secret name provided");
    });
    it("Returns undefined if no secret found in environment", async () => {
      const env = {};
      const result = await getEnvSecret("test", { env });
      expect(result).toBeUndefined();
    });
  });

  describe("Features", () => {
    it("Works without AWS_SESSION_TOKEN for direct values", async () => {
      delete process.env.AWS_SESSION_TOKEN;
      process.env.TEST_KEY = "direct-value";
      const result = await getEnvSecret("TEST_KEY");
      expect(result).toBe("direct-value");
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("Uses SECRET_name if available", async () => {
      const env = cloneDeep(process.env) as Record<string, string | undefined>;
      env.SECRET_test = "secret1";
      await getEnvSecret("test", { env });
      const calls = (axios.get as Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe("http://localhost:2773/secretsmanager/get");
      expect(lastCall[1].headers).toEqual({
        "X-Aws-Parameters-Secrets-Token": MOCK.AWS_SESSION_TOKEN,
      });
      expect(lastCall[1].params).toEqual({ secretId: "secret1" });
      expect(lastCall[1].timeout).toBe(3000);
    });

    it("Uses name_SECRET if available", async () => {
      const env = cloneDeep(process.env) as Record<string, string | undefined>;
      env.test_SECRET = "secret2";
      await getEnvSecret("test", { env });
      const calls = (axios.get as Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe("http://localhost:2773/secretsmanager/get");
      expect(lastCall[1].headers).toEqual({
        "X-Aws-Parameters-Secrets-Token": MOCK.AWS_SESSION_TOKEN,
      });
      expect(lastCall[1].params).toEqual({ secretId: "secret2" });
      expect(lastCall[1].timeout).toBe(3000);
    });

    it("Uses name if available", async () => {
      const env = cloneDeep(process.env) as Record<string, string | undefined>;
      env.test = "secret3";
      const result = await getEnvSecret("test", { env });
      expect(result).toBe("secret3");
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("Prioritizes SECRET_name over name_SECRET over name", async () => {
      const env = cloneDeep(process.env) as Record<string, string | undefined>;
      env.SECRET_test = "secret1";
      env.test_SECRET = "secret2";
      env.test = "secret3";
      await getEnvSecret("test", { env });
      const calls = (axios.get as Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe("http://localhost:2773/secretsmanager/get");
      expect(lastCall[1].headers).toEqual({
        "X-Aws-Parameters-Secrets-Token": MOCK.AWS_SESSION_TOKEN,
      });
      expect(lastCall[1].params).toEqual({ secretId: "secret1" });
      expect(lastCall[1].timeout).toBe(3000);
    });

    it("Returns value directly if not a secret reference", async () => {
      const env = cloneDeep(process.env) as Record<string, string | undefined>;
      env.test = "direct-value";
      const result = await getEnvSecret("test", { env });
      expect(result).toBe("direct-value");
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("Returns undefined if name not found", async () => {
      const env = cloneDeep(process.env) as Record<string, string | undefined>;
      const result = await getEnvSecret("nonexistent", { env });
      expect(result).toBeUndefined();
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe("Retry Logic", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Reset to default mock implementation
      (axios.get as Mock).mockResolvedValue({
        data: { SecretString: MOCK.SECRET_RESPONSE },
      });
    });
    it("Retries on connection refused errors", async () => {
      const env = cloneDeep(process.env) as Record<string, string | undefined>;
      env.SECRET_test = "secret1";
      let attemptCount = 0;
      (axios.get as Mock).mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          const error = new Error("connect ECONNREFUSED") as Error & {
            code: string;
          };
          error.code = "ECONNREFUSED";
          return Promise.reject(error);
        }
        return Promise.resolve({
          data: { SecretString: MOCK.SECRET_RESPONSE },
        });
      });

      const response = await getEnvSecret("test", { env });
      expect(response).toBe(MOCK.SECRET_RESPONSE);
      expect(axios.get).toHaveBeenCalledTimes(3);
    }, 10000);
    it("Retries on timeout errors", async () => {
      const env = cloneDeep(process.env) as Record<string, string | undefined>;
      env.SECRET_test = "secret1";
      let attemptCount = 0;
      (axios.get as Mock).mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          const error = new Error("timeout") as Error & { code: string };
          error.code = "ETIMEDOUT";
          return Promise.reject(error);
        }
        return Promise.resolve({
          data: { SecretString: MOCK.SECRET_RESPONSE },
        });
      });

      const response = await getEnvSecret("test", { env });
      expect(response).toBe(MOCK.SECRET_RESPONSE);
      expect(axios.get).toHaveBeenCalledTimes(2);
    }, 10000);
    it("Does not retry on 4xx errors", async () => {
      const env = cloneDeep(process.env) as Record<string, string | undefined>;
      env.SECRET_test = "secret1";
      (axios.get as Mock).mockImplementation(() => {
        const error = new Error("Bad Request") as Error & {
          response: { status: number };
        };
        error.response = { status: 400 };
        return Promise.reject(error);
      });

      await expect(getEnvSecret("test", { env })).rejects.toThrow(
        "Bad Request",
      );
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("SDK Fallback", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Reset axios to throw errors for fallback tests
      (axios.get as Mock).mockImplementation(() => {
        const error = new Error("connect ECONNREFUSED") as Error & {
          code: string;
        };
        error.code = "ECONNREFUSED";
        return Promise.reject(error);
      });
    });
    it("Falls back to AWS SDK after retries exhausted", async () => {
      const { SecretsManagerClient } =
        await import("@aws-sdk/client-secrets-manager");
      const env = cloneDeep(process.env) as Record<string, string | undefined>;
      env.SECRET_test = "secret1";

      const response = await getEnvSecret("test", { env });
      expect(response).toBe(MOCK.SECRET_RESPONSE);
      expect(axios.get).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      expect(SecretsManagerClient).toHaveBeenCalled();
    }, 15000);
    it("Throws SDK error if both extension and SDK fail", async () => {
      const { SecretsManagerClient } =
        await import("@aws-sdk/client-secrets-manager");
      const env = cloneDeep(process.env) as Record<string, string | undefined>;
      env.SECRET_test = "secret1";

      // Mock SDK to also fail
      (SecretsManagerClient as Mock).mockImplementationOnce(() => ({
        send: vi.fn(() => Promise.reject(new Error("SDK Error"))),
      }));

      await expect(getEnvSecret("test", { env })).rejects.toThrow("SDK Error");
      expect(axios.get).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      expect(SecretsManagerClient).toHaveBeenCalled();
    }, 15000);
  });
});
