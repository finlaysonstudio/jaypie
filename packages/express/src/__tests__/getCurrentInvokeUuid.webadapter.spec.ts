import type { Request } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import getWebAdapterUuid from "../getCurrentInvokeUuid.webadapter.js";

//
//
// Setup
//

const MOCK_REQUEST_ID = "test-request-id-12345";
const MOCK_TRACE_ID =
  "Root=1-5e6b4a90-abcdef123456789012345678;Parent=abc123;Sampled=1";

beforeEach(() => {
  vi.stubEnv("_X_AMZN_TRACE_ID", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

//
//
// Run tests
//

describe("GetWebAdapterUuid", () => {
  describe("Base Cases", () => {
    it("Is a function", () => {
      expect(getWebAdapterUuid).toBeFunction();
    });

    it("Returns undefined when no request and no env var", () => {
      const result = getWebAdapterUuid();
      expect(result).toBeUndefined();
    });
  });

  describe("Request Header Mode", () => {
    it("Returns request ID from x-amzn-request-id header", () => {
      const mockReq = {
        headers: {
          "x-amzn-request-id": MOCK_REQUEST_ID,
        },
      } as unknown as Request;

      const result = getWebAdapterUuid(mockReq);
      expect(result).toBe(MOCK_REQUEST_ID);
    });

    it("Returns first value if header is an array", () => {
      const mockReq = {
        headers: {
          "x-amzn-request-id": [MOCK_REQUEST_ID, "second-id"],
        },
      } as unknown as Request;

      const result = getWebAdapterUuid(mockReq);
      expect(result).toBe(MOCK_REQUEST_ID);
    });

    it("Returns undefined if request has no headers", () => {
      const mockReq = {} as unknown as Request;

      const result = getWebAdapterUuid(mockReq);
      expect(result).toBeUndefined();
    });

    it("Returns undefined if header is not present", () => {
      const mockReq = {
        headers: {
          "other-header": "value",
        },
      } as unknown as Request;

      const result = getWebAdapterUuid(mockReq);
      expect(result).toBeUndefined();
    });
  });

  describe("Environment Variable Fallback", () => {
    it("Returns trace ID from _X_AMZN_TRACE_ID env var", () => {
      vi.stubEnv("_X_AMZN_TRACE_ID", MOCK_TRACE_ID);

      const result = getWebAdapterUuid();
      expect(result).toBe("1-5e6b4a90-abcdef123456789012345678");
    });

    it("Returns undefined for malformed trace ID", () => {
      vi.stubEnv("_X_AMZN_TRACE_ID", "invalid-trace-id");

      const result = getWebAdapterUuid();
      expect(result).toBeUndefined();
    });

    it("Request header takes precedence over env var", () => {
      vi.stubEnv("_X_AMZN_TRACE_ID", MOCK_TRACE_ID);

      const mockReq = {
        headers: {
          "x-amzn-request-id": MOCK_REQUEST_ID,
        },
      } as unknown as Request;

      const result = getWebAdapterUuid(mockReq);
      expect(result).toBe(MOCK_REQUEST_ID);
    });
  });
});
