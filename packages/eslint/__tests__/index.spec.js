import { afterEach, describe, expect, it, vi } from "vitest";
import js from "@eslint/js";

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
});
