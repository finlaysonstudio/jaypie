import { describe, expect, it } from "vitest";
import { isProductionEnv } from "../isProductionEnv";

describe("isProductionEnv", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(typeof isProductionEnv).toBe("function");
    });

    it("works", () => {
      const result = isProductionEnv();
      expect(result).toBeDefined();
    });
  });

  describe("Happy Paths", () => {
    it("returns true when PROJECT_ENV is production", () => {
      const originalEnv = process.env.PROJECT_ENV;
      process.env.PROJECT_ENV = "production";

      expect(isProductionEnv()).toBe(true);

      process.env.PROJECT_ENV = originalEnv;
    });

    it("returns true when PROJECT_PRODUCTION is true", () => {
      const originalProduction = process.env.PROJECT_PRODUCTION;
      const originalEnv = process.env.PROJECT_ENV;
      delete process.env.PROJECT_ENV;
      process.env.PROJECT_PRODUCTION = "true";

      expect(isProductionEnv()).toBe(true);

      process.env.PROJECT_PRODUCTION = originalProduction;
      process.env.PROJECT_ENV = originalEnv;
    });

    it("returns false when neither condition is met", () => {
      const originalProduction = process.env.PROJECT_PRODUCTION;
      const originalEnv = process.env.PROJECT_ENV;
      delete process.env.PROJECT_ENV;
      delete process.env.PROJECT_PRODUCTION;

      expect(isProductionEnv()).toBe(false);

      process.env.PROJECT_PRODUCTION = originalProduction;
      process.env.PROJECT_ENV = originalEnv;
    });
  });

  describe("Features", () => {
    it("returns true when both conditions are met", () => {
      const originalProduction = process.env.PROJECT_PRODUCTION;
      const originalEnv = process.env.PROJECT_ENV;
      process.env.PROJECT_ENV = "production";
      process.env.PROJECT_PRODUCTION = "true";

      expect(isProductionEnv()).toBe(true);

      process.env.PROJECT_PRODUCTION = originalProduction;
      process.env.PROJECT_ENV = originalEnv;
    });

    it("returns false when PROJECT_ENV is not production", () => {
      const originalEnv = process.env.PROJECT_ENV;
      const originalProduction = process.env.PROJECT_PRODUCTION;
      process.env.PROJECT_ENV = "development";
      delete process.env.PROJECT_PRODUCTION;

      expect(isProductionEnv()).toBe(false);

      process.env.PROJECT_ENV = originalEnv;
      process.env.PROJECT_PRODUCTION = originalProduction;
    });

    it("returns false when PROJECT_PRODUCTION is not true", () => {
      const originalProduction = process.env.PROJECT_PRODUCTION;
      const originalEnv = process.env.PROJECT_ENV;
      delete process.env.PROJECT_ENV;
      process.env.PROJECT_PRODUCTION = "false";

      expect(isProductionEnv()).toBe(false);

      process.env.PROJECT_PRODUCTION = originalProduction;
      process.env.PROJECT_ENV = originalEnv;
    });
  });
});
