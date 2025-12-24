import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from "vitest";

// Subject
import getSecret from "../getSecret.function.js";

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
});

//
//
// Run tests
//

describe("Get Secret Function", () => {
  it("Works", async () => {
    const response = await getSecret(MOCK.SECRET);
    expect(response).not.toBeUndefined();
  });
  describe("Error Cases", () => {
    it("Throws if no AWS_SESSION_TOKEN", async () => {
      delete process.env.AWS_SESSION_TOKEN;
      await expect(getSecret(MOCK.SECRET)).rejects.toThrow(
        "No AWS_SESSION_TOKEN available",
      );
    });
    it("Throws if no secret name provided", async () => {
      await expect(getSecret(undefined as unknown as string)).rejects.toThrow(
        "No secret name provided",
      );
    });
  });
  describe("Features", () => {
    it("Passes name to axios params (which will URL-encode)", async () => {
      const urlUnsafeParam = "a b/s%!@#$%^&*()_+";
      await getSecret(urlUnsafeParam);
      expect(axios.get).toHaveBeenCalled();
      const calls = (axios.get as Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe(`http://localhost:2773/secretsmanager/get`);
      expect(lastCall[1].headers).toEqual({
        "X-Aws-Parameters-Secrets-Token": MOCK.AWS_SESSION_TOKEN,
      });
      expect(lastCall[1].params).toEqual({ secretId: urlUnsafeParam });
      expect(lastCall[1].timeout).toBe(3000);
    });
    it("Calls axios.get with the correct endpoint and timeout", async () => {
      await getSecret(MOCK.SECRET);
      expect(axios.get).toHaveBeenCalled();
      const calls = (axios.get as Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe(`http://localhost:2773/secretsmanager/get`);
      expect(lastCall[1].headers).toEqual({
        "X-Aws-Parameters-Secrets-Token": MOCK.AWS_SESSION_TOKEN,
      });
      expect(lastCall[1].params).toEqual({ secretId: MOCK.SECRET });
      expect(lastCall[1].timeout).toBe(3000);
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
      let attemptCount = 0;
      (axios.get as Mock).mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
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

      const response = await getSecret(MOCK.SECRET);
      expect(response).toBe(MOCK.SECRET_RESPONSE);
      expect(axios.get).toHaveBeenCalledTimes(2);
    }, 10000);
    it("Retries on timeout errors", async () => {
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

      const response = await getSecret(MOCK.SECRET);
      expect(response).toBe(MOCK.SECRET_RESPONSE);
      expect(axios.get).toHaveBeenCalledTimes(2);
    }, 10000);
    it("Does not retry on 4xx errors", async () => {
      (axios.get as Mock).mockImplementation(() => {
        const error = new Error("Bad Request") as Error & {
          response: { status: number };
        };
        error.response = { status: 400 };
        return Promise.reject(error);
      });

      await expect(getSecret(MOCK.SECRET)).rejects.toThrow("Bad Request");
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

      const response = await getSecret(MOCK.SECRET);
      expect(response).toBe(MOCK.SECRET_RESPONSE);
      expect(axios.get).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
      expect(SecretsManagerClient).toHaveBeenCalled();
    }, 15000);
    it("Throws SDK error if both extension and SDK fail", async () => {
      const { SecretsManagerClient } =
        await import("@aws-sdk/client-secrets-manager");

      // Mock SDK to also fail
      (SecretsManagerClient as Mock).mockImplementationOnce(() => ({
        send: vi.fn(() => Promise.reject(new Error("SDK Error"))),
      }));

      await expect(getSecret(MOCK.SECRET)).rejects.toThrow("SDK Error");
      expect(axios.get).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
      expect(SecretsManagerClient).toHaveBeenCalled();
    }, 15000);
  });
});
