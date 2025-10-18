import { describe, expect, it } from "vitest";
import { isNodeTestEnv, isProductionEnv } from "..";

describe("kit/index", () => {
  describe("Base Cases", () => {
    it("exports isNodeTestEnv function", () => {
      expect(typeof isNodeTestEnv).toBe("function");
    });

    it("exports isProductionEnv function", () => {
      expect(typeof isProductionEnv).toBe("function");
    });
  });

  describe("Happy Paths", () => {
    it("isNodeTestEnv works", () => {
      const result = isNodeTestEnv();
      expect(typeof result).toBe("boolean");
    });

    it("isProductionEnv works", () => {
      const result = isProductionEnv();
      expect(typeof result).toBe("boolean");
    });
  });
});
