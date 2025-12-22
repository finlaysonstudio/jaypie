import { describe, expect, it } from "vitest";
import { isLocalEnv } from "../isLocalEnv";

describe("isLocalEnv", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(typeof isLocalEnv).toBe("function");
    });

    it("works", () => {
      const result = isLocalEnv();
      expect(result).toBeDefined();
    });
  });

  describe("Happy Paths", () => {
    it("returns true when PROJECT_ENV is local", () => {
      const originalEnv = process.env.PROJECT_ENV;
      process.env.PROJECT_ENV = "local";

      expect(isLocalEnv()).toBe(true);

      process.env.PROJECT_ENV = originalEnv;
    });

    it("returns true when PROJECT_ENV is not present and NODE_ENV is development", () => {
      const originalProjectEnv = process.env.PROJECT_ENV;
      const originalNodeEnv = process.env.NODE_ENV;
      delete process.env.PROJECT_ENV;
      process.env.NODE_ENV = "development";

      expect(isLocalEnv()).toBe(true);

      process.env.PROJECT_ENV = originalProjectEnv;
      process.env.NODE_ENV = originalNodeEnv;
    });

    it("returns false when neither condition is met", () => {
      const originalProjectEnv = process.env.PROJECT_ENV;
      const originalNodeEnv = process.env.NODE_ENV;
      delete process.env.PROJECT_ENV;
      process.env.NODE_ENV = "production";

      expect(isLocalEnv()).toBe(false);

      process.env.PROJECT_ENV = originalProjectEnv;
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe("Features", () => {
    it("returns false when PROJECT_ENV exists but is not local", () => {
      const originalEnv = process.env.PROJECT_ENV;
      process.env.PROJECT_ENV = "production";

      expect(isLocalEnv()).toBe(false);

      process.env.PROJECT_ENV = originalEnv;
    });

    it("returns false when PROJECT_ENV is development (not local)", () => {
      const originalEnv = process.env.PROJECT_ENV;
      process.env.PROJECT_ENV = "development";

      expect(isLocalEnv()).toBe(false);

      process.env.PROJECT_ENV = originalEnv;
    });

    it("PROJECT_ENV takes precedence over NODE_ENV", () => {
      const originalProjectEnv = process.env.PROJECT_ENV;
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.PROJECT_ENV = "production";
      process.env.NODE_ENV = "development";

      expect(isLocalEnv()).toBe(false);

      process.env.PROJECT_ENV = originalProjectEnv;
      process.env.NODE_ENV = originalNodeEnv;
    });

    it("returns false when PROJECT_ENV is not present and NODE_ENV is test", () => {
      const originalProjectEnv = process.env.PROJECT_ENV;
      const originalNodeEnv = process.env.NODE_ENV;
      delete process.env.PROJECT_ENV;
      process.env.NODE_ENV = "test";

      expect(isLocalEnv()).toBe(false);

      process.env.PROJECT_ENV = originalProjectEnv;
      process.env.NODE_ENV = originalNodeEnv;
    });

    it("returns false when both PROJECT_ENV and NODE_ENV are not present", () => {
      const originalProjectEnv = process.env.PROJECT_ENV;
      const originalNodeEnv = process.env.NODE_ENV;
      delete process.env.PROJECT_ENV;
      delete process.env.NODE_ENV;

      expect(isLocalEnv()).toBe(false);

      process.env.PROJECT_ENV = originalProjectEnv;
      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});
