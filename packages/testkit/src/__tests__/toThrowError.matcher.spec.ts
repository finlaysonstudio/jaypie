import { describe, expect, it } from "vitest";
import toThrowError from "../matchers/toThrowError.matcher";

describe("toThrowError", () => {
  //
  // Base Cases
  //
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(typeof toThrowError).toBe("function");
    });

    it("Works", async () => {
      const result = await toThrowError(() => {
        throw new Error("test");
      });
      expect(result.pass).toBe(true);
    });
  });

  //
  // Happy Paths
  //
  describe("Happy Paths", () => {
    it("passes when a synchronous function throws", async () => {
      const result = await toThrowError(() => {
        throw new Error("sync error");
      });
      expect(result.pass).toBe(true);
    });

    it("passes when an async function throws", async () => {
      const result = await toThrowError(async () => {
        throw new Error("async error");
      });
      expect(result.pass).toBe(true);
    });

    it("passes when async throws", async () => {
      const result = await toThrowError(async () => {
        throw new Error("async error");
      });
      expect(result.pass).toBe(true);
    });
  });

  //
  // Features
  //
  describe("Features", () => {
    it("fails when a synchronous function does not throw", async () => {
      const result = await toThrowError(() => {
        return "no error";
      });
      expect(result.pass).toBe(false);
    });

    it("fails when an async function does not throw", async () => {
      const result = await toThrowError(async () => {
        return "no error";
      });
      expect(result.pass).toBe(false);
    });

    it("fails when a promise resolves", async () => {
      const result = await toThrowError(() => Promise.resolve("no error"));
      expect(result.pass).toBe(false);
    });

    it("provides appropriate error message when test passes", async () => {
      const result = await toThrowError(() => {
        throw new Error("test error");
      });
      expect(result.message()).toContain("test error");
    });

    it("provides appropriate error message when test fails", async () => {
      const result = await toThrowError(() => "no error");
      expect(result.message()).toBe(
        "Expected function to throw an error, but it did not throw.",
      );
    });
  });
});
