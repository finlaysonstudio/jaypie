import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock transports before importing subject
vi.mock("axios", () => ({
  default: { get: vi.fn() },
}));

const mockSsmSend = vi.fn();
vi.mock("@aws-sdk/client-ssm", () => ({
  GetParameterCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  SSMClient: class {
    send = mockSsmSend;
  },
}));

vi.mock("../getS3FileBuffer.function.js", () => ({
  default: vi.fn(),
}));

// Subject
import loadEnvVariables, {
  clearEnvVariablesCache,
} from "../loadEnvVariables.function.js";
import getS3FileBuffer from "../getS3FileBuffer.function.js";
import axios from "axios";

//
//
// Mock constants
//

const MOCK = {
  BUNDLE: { APP_JOB_QUEUE_URL: "https://sqs.mock/queue", APP_TENANT: "mock" },
  PARAMETER: "/sandbox/project/a1b2/Api/Function/variables",
  S3_POINTER: "s3://mock-bucket/sandbox/variables.json",
  TOKEN: "mock-session-token",
};

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  delete process.env.CDK_ENV_VARIABLES;
  delete process.env.AWS_SESSION_TOKEN;
  vi.clearAllMocks();
  clearEnvVariablesCache();
});
afterEach(() => {
  process.env = DEFAULT_ENV;
});

//
//
// Helpers
//

function ssmResolves(value: unknown) {
  mockSsmSend.mockResolvedValue({
    Parameter: { Value: JSON.stringify(value) },
  });
}

//
//
// Run tests
//

describe("Load Environment Variables Function", () => {
  describe("Base Cases", () => {
    it("Is a function", () => {
      expect(typeof loadEnvVariables).toBe("function");
    });
    it("Works without a pointer", async () => {
      await expect(loadEnvVariables()).resolves.toBe(false);
    });
    it("Does not call AWS without a pointer", async () => {
      await loadEnvVariables();
      expect(mockSsmSend).not.toHaveBeenCalled();
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe("Happy Paths", () => {
    beforeEach(() => {
      process.env.CDK_ENV_VARIABLES = MOCK.PARAMETER;
    });
    it("Hydrates the bundle into process.env", async () => {
      ssmResolves(MOCK.BUNDLE);
      const result = await loadEnvVariables();
      expect(result).toBe(true);
      expect(process.env.APP_JOB_QUEUE_URL).toBe(MOCK.BUNDLE.APP_JOB_QUEUE_URL);
      expect(process.env.APP_TENANT).toBe(MOCK.BUNDLE.APP_TENANT);
    });
    it("Requests the parameter named by the pointer", async () => {
      ssmResolves(MOCK.BUNDLE);
      await loadEnvVariables();
      expect(mockSsmSend).toHaveBeenCalledWith(
        expect.objectContaining({ input: { Name: MOCK.PARAMETER } }),
      );
    });
    it("Coerces non-string values", async () => {
      ssmResolves({ APP_RETRIES: 3, APP_VERBOSE: true });
      await loadEnvVariables();
      expect(process.env.APP_RETRIES).toBe("3");
      expect(process.env.APP_VERBOSE).toBe("true");
    });
    it("Accepts an explicit env object", async () => {
      ssmResolves(MOCK.BUNDLE);
      const env: Record<string, string | undefined> = {
        CDK_ENV_VARIABLES: MOCK.PARAMETER,
      };
      await loadEnvVariables({ env });
      expect(env.APP_TENANT).toBe(MOCK.BUNDLE.APP_TENANT);
      expect(process.env.APP_TENANT).toBeUndefined();
    });
  });

  describe("Features", () => {
    beforeEach(() => {
      process.env.CDK_ENV_VARIABLES = MOCK.PARAMETER;
    });

    describe("Environment wins over the bundle", () => {
      it("Does not overwrite an existing value", async () => {
        process.env.APP_TENANT = "inline";
        ssmResolves(MOCK.BUNDLE);
        await loadEnvVariables();
        expect(process.env.APP_TENANT).toBe("inline");
      });
      it("Fills only the absent keys", async () => {
        process.env.APP_TENANT = "inline";
        ssmResolves(MOCK.BUNDLE);
        await loadEnvVariables();
        expect(process.env.APP_JOB_QUEUE_URL).toBe(
          MOCK.BUNDLE.APP_JOB_QUEUE_URL,
        );
      });
      it("Does not overwrite an empty string", async () => {
        process.env.APP_TENANT = "";
        ssmResolves(MOCK.BUNDLE);
        await loadEnvVariables();
        expect(process.env.APP_TENANT).toBe("");
      });
    });

    describe("Secrets are refused", () => {
      it("Ignores SECRET_ prefixed keys", async () => {
        ssmResolves({ SECRET_MONGODB_URI: "leaked", APP_TENANT: "mock" });
        await loadEnvVariables();
        expect(process.env.SECRET_MONGODB_URI).toBeUndefined();
      });
      it("Still loads the remaining keys", async () => {
        ssmResolves({ SECRET_MONGODB_URI: "leaked", APP_TENANT: "mock" });
        await loadEnvVariables();
        expect(process.env.APP_TENANT).toBe("mock");
      });
    });

    describe("Caching", () => {
      it("Fetches once across invocations", async () => {
        ssmResolves(MOCK.BUNDLE);
        await loadEnvVariables();
        await loadEnvVariables();
        await loadEnvVariables();
        expect(mockSsmSend).toHaveBeenCalledTimes(1);
      });
      it("Fetches once across concurrent calls", async () => {
        ssmResolves(MOCK.BUNDLE);
        await Promise.all([loadEnvVariables(), loadEnvVariables()]);
        expect(mockSsmSend).toHaveBeenCalledTimes(1);
      });
      it("Fetches again after the cache is cleared", async () => {
        ssmResolves(MOCK.BUNDLE);
        await loadEnvVariables();
        clearEnvVariablesCache();
        await loadEnvVariables();
        expect(mockSsmSend).toHaveBeenCalledTimes(2);
      });
      it("Retries after a failure", async () => {
        mockSsmSend.mockRejectedValueOnce(new Error("throttled"));
        await expect(loadEnvVariables()).rejects.toThrow();
        ssmResolves(MOCK.BUNDLE);
        await expect(loadEnvVariables()).resolves.toBe(true);
      });
    });

    describe("Parameters extension", () => {
      it("Prefers the extension when a session token is present", async () => {
        process.env.AWS_SESSION_TOKEN = MOCK.TOKEN;
        vi.mocked(axios.get).mockResolvedValue({
          data: { Parameter: { Value: JSON.stringify(MOCK.BUNDLE) } },
        });
        await loadEnvVariables();
        expect(axios.get).toHaveBeenCalled();
        expect(mockSsmSend).not.toHaveBeenCalled();
      });
      it("Falls back to the SDK when the extension fails", async () => {
        process.env.AWS_SESSION_TOKEN = MOCK.TOKEN;
        vi.mocked(axios.get).mockRejectedValue(new Error("ECONNREFUSED"));
        ssmResolves(MOCK.BUNDLE);
        await expect(loadEnvVariables()).resolves.toBe(true);
        expect(process.env.APP_TENANT).toBe(MOCK.BUNDLE.APP_TENANT);
      });
      it("Skips the extension without a session token", async () => {
        ssmResolves(MOCK.BUNDLE);
        await loadEnvVariables();
        expect(axios.get).not.toHaveBeenCalled();
      });
    });

    describe("S3 pointers", () => {
      it("Reads the bundle from S3", async () => {
        process.env.CDK_ENV_VARIABLES = MOCK.S3_POINTER;
        vi.mocked(getS3FileBuffer).mockResolvedValue(
          Buffer.from(JSON.stringify(MOCK.BUNDLE)),
        );
        await expect(loadEnvVariables()).resolves.toBe(true);
        expect(getS3FileBuffer).toHaveBeenCalledWith({
          bucket: "mock-bucket",
          key: "sandbox/variables.json",
        });
      });
      it("Does not call SSM for an s3 pointer", async () => {
        process.env.CDK_ENV_VARIABLES = MOCK.S3_POINTER;
        vi.mocked(getS3FileBuffer).mockResolvedValue(
          Buffer.from(JSON.stringify(MOCK.BUNDLE)),
        );
        await loadEnvVariables();
        expect(mockSsmSend).not.toHaveBeenCalled();
      });
    });
  });

  describe("Error Conditions", () => {
    beforeEach(() => {
      process.env.CDK_ENV_VARIABLES = MOCK.PARAMETER;
    });
    it("Throws when the parameter is missing", async () => {
      mockSsmSend.mockResolvedValue({});
      await expect(loadEnvVariables()).rejects.toThrow();
    });
    it("Throws when the bundle is not JSON", async () => {
      mockSsmSend.mockResolvedValue({ Parameter: { Value: "not json" } });
      await expect(loadEnvVariables()).rejects.toThrow();
    });
    it("Throws when the bundle is an array", async () => {
      ssmResolves(["nope"]);
      await expect(loadEnvVariables()).rejects.toThrow();
    });
    it("Throws on a malformed s3 pointer", async () => {
      process.env.CDK_ENV_VARIABLES = "s3://no-key";
      await expect(loadEnvVariables()).rejects.toThrow();
    });
  });
});
