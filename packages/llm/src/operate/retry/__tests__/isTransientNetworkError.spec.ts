import { describe, expect, it } from "vitest";

import { isTransientNetworkError } from "../isTransientNetworkError.js";

//
//
// Tests
//

describe("isTransientNetworkError", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof isTransientNetworkError).toBe("function");
    });

    it("returns false for non-errors", () => {
      expect(isTransientNetworkError("string")).toBe(false);
      expect(isTransientNetworkError(null)).toBe(false);
      expect(isTransientNetworkError(undefined)).toBe(false);
      expect(isTransientNetworkError(42)).toBe(false);
    });

    it("returns false for generic errors", () => {
      expect(isTransientNetworkError(new Error("something went wrong"))).toBe(
        false,
      );
    });
  });

  // Error Code Detection
  describe("Error Code Detection", () => {
    it("detects ECONNRESET", () => {
      const error = new Error("read ECONNRESET");
      (error as unknown as { code: string }).code = "ECONNRESET";
      expect(isTransientNetworkError(error)).toBe(true);
    });

    it("detects ETIMEDOUT", () => {
      const error = new Error("connection timed out");
      (error as unknown as { code: string }).code = "ETIMEDOUT";
      expect(isTransientNetworkError(error)).toBe(true);
    });

    it("detects ECONNREFUSED", () => {
      const error = new Error("connection refused");
      (error as unknown as { code: string }).code = "ECONNREFUSED";
      expect(isTransientNetworkError(error)).toBe(true);
    });

    it("detects ENOTFOUND", () => {
      const error = new Error("getaddrinfo ENOTFOUND");
      (error as unknown as { code: string }).code = "ENOTFOUND";
      expect(isTransientNetworkError(error)).toBe(true);
    });

    it("detects EAI_AGAIN", () => {
      const error = new Error("getaddrinfo EAI_AGAIN");
      (error as unknown as { code: string }).code = "EAI_AGAIN";
      expect(isTransientNetworkError(error)).toBe(true);
    });

    it("detects EPIPE", () => {
      const error = new Error("write EPIPE");
      (error as unknown as { code: string }).code = "EPIPE";
      expect(isTransientNetworkError(error)).toBe(true);
    });

    it("detects ENETRESET", () => {
      const error = new Error("network reset");
      (error as unknown as { code: string }).code = "ENETRESET";
      expect(isTransientNetworkError(error)).toBe(true);
    });

    it("detects ENETUNREACH", () => {
      const error = new Error("network unreachable");
      (error as unknown as { code: string }).code = "ENETUNREACH";
      expect(isTransientNetworkError(error)).toBe(true);
    });
  });

  // Message Pattern Detection
  describe("Message Pattern Detection", () => {
    it("detects 'terminated' in message", () => {
      expect(isTransientNetworkError(new TypeError("terminated"))).toBe(true);
    });

    it("detects 'socket hang up' in message", () => {
      expect(isTransientNetworkError(new Error("socket hang up"))).toBe(true);
    });

    it("detects 'network' in message", () => {
      expect(isTransientNetworkError(new Error("network error"))).toBe(true);
    });

    it("is case-insensitive for messages", () => {
      expect(isTransientNetworkError(new Error("Network Error"))).toBe(true);
    });
  });

  // Cause Chain Walking
  describe("Cause Chain Walking", () => {
    it("detects ECONNRESET wrapped in TypeError: terminated (undici pattern)", () => {
      const cause = new Error("read ECONNRESET");
      (cause as unknown as { code: string }).code = "ECONNRESET";
      const error = new TypeError("terminated");
      (error as unknown as { cause: Error }).cause = cause;
      expect(isTransientNetworkError(error)).toBe(true);
    });

    it("detects network error two levels deep", () => {
      const root = new Error("read ECONNRESET");
      (root as unknown as { code: string }).code = "ECONNRESET";
      const middle = new Error("fetch failed");
      (middle as unknown as { cause: Error }).cause = root;
      const outer = new TypeError("terminated");
      (outer as unknown as { cause: Error }).cause = middle;
      expect(isTransientNetworkError(outer)).toBe(true);
    });

    it("returns false when cause chain has no network errors", () => {
      const cause = new Error("some other error");
      const error = new Error("wrapper");
      (error as unknown as { cause: Error }).cause = cause;
      expect(isTransientNetworkError(error)).toBe(false);
    });
  });

  // Negative Cases
  describe("Negative Cases", () => {
    it("returns false for authentication errors", () => {
      expect(isTransientNetworkError(new Error("Unauthorized"))).toBe(false);
    });

    it("returns false for rate limit errors", () => {
      expect(isTransientNetworkError(new Error("rate limit exceeded"))).toBe(
        false,
      );
    });

    it("returns false for bad request errors", () => {
      expect(isTransientNetworkError(new Error("bad request"))).toBe(false);
    });
  });
});
