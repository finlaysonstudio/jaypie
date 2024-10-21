import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      await expect(getSecret()).rejects.toThrow("No secret name provided");
    });
  });
  describe("Features", () => {
    it("Passes name to axios params (which will URL-encode)", async () => {
      const urlUnsafeParam = "a b/s%!@#$%^&*()_+";
      await getSecret(urlUnsafeParam);
      expect(axios.get).toHaveBeenCalled();
      expect(axios.get).toHaveBeenCalledWith(
        `http://localhost:2773/secretsmanager/get`,
        {
          headers: {
            "X-Aws-Parameters-Secrets-Token": MOCK.AWS_SESSION_TOKEN,
          },
          params: { secretId: urlUnsafeParam },
        },
      );
    });
    it("Calls axios.get with the correct endpoint", async () => {
      await getSecret(MOCK.SECRET);
      expect(axios.get).toHaveBeenCalled();
      expect(axios.get).toHaveBeenCalledWith(
        `http://localhost:2773/secretsmanager/get`,
        {
          headers: {
            "X-Aws-Parameters-Secrets-Token": MOCK.AWS_SESSION_TOKEN,
          },
          params: { secretId: MOCK.SECRET },
        },
      );
    });
  });
});
