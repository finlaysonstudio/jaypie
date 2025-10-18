import { describe, expect, it } from "vitest";
import { isNodeTestEnv } from "../isNodeTestEnv";

describe("isNodeTestEnv", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(typeof isNodeTestEnv).toBe("function");
    });

    it("works", () => {
      const result = isNodeTestEnv();
      expect(result).toBeDefined();
    });
  });

  describe("Happy Paths", () => {
    it("returns true when NODE_ENV is test", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";

      expect(isNodeTestEnv()).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it("returns false when NODE_ENV is not test", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      expect(isNodeTestEnv()).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });

    it("returns false when NODE_ENV is undefined", () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      expect(isNodeTestEnv()).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });
  });
});
