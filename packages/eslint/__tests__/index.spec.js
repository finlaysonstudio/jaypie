import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import index from "../index.js";

//
//
// Mock modules
//

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Index", () => {
  describe("Base Cases", () => {
    it("Is an Array", () => {
      expect(Array.isArray(index)).toBe(true);
    });

    it("Contains Required Configs", () => {
      // Find configs by unique properties
      const hasVitestConfig = index.some(
        (config) =>
          config.files?.includes("**/*.spec.js") && config.plugins?.vitest,
      );
      expect(hasVitestConfig).toBe(true);

      const hasRecommendedConfig = index.some(
        (config) => config.name === "jaypie:jsRecommended",
      );
      expect(hasRecommendedConfig).toBe(true);
    });
  });

  describe("Issue 333: TypeScript resolver", () => {
    it("uses resolver-next so interfaceVersion 3 resolvers load", () => {
      const tsConfig = index.find(
        (config) => config.name === "jaypie:typescriptRecommended",
      );
      expect(tsConfig).toBeDefined();
      expect(tsConfig.settings).toBeDefined();
      expect(tsConfig.settings["import-x/resolver-next"]).toBeDefined();
      expect(Array.isArray(tsConfig.settings["import-x/resolver-next"])).toBe(
        true,
      );
      expect(
        tsConfig.settings["import-x/resolver-next"].length,
      ).toBeGreaterThan(0);
    });

    it("clears the legacy import-x/resolver typescript entry", () => {
      const tsConfig = index.find(
        (config) => config.name === "jaypie:typescriptRecommended",
      );
      expect(tsConfig).toBeDefined();
      expect(tsConfig.settings["import-x/resolver"]).toBeUndefined();
    });
  });
});
