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

    it("does not register eslint-plugin-import-x or a resolver", () => {
      // Import correctness is delegated to tsc; no import-x blocks remain.
      const hasImportX = index.some(
        (config) =>
          config.name === "jaypie:importxRecommended" ||
          config.name === "jaypie:typescriptRecommended" ||
          config.settings?.["import-x/resolver-next"],
      );
      expect(hasImportX).toBe(false);
    });

    it("configures no-unused-vars to honor _-prefix and rest siblings", () => {
      // Only our explicit overrides use the array form; the recommended
      // preset's bare "error" string is superseded by these.
      const rulesWithUnusedVars = index
        .filter((config) => config.rules)
        .flatMap((config) =>
          ["no-unused-vars", "@typescript-eslint/no-unused-vars"]
            .map((name) => config.rules[name])
            .filter((rule) => Array.isArray(rule)),
        );
      expect(rulesWithUnusedVars.length).toBe(2);
      for (const rule of rulesWithUnusedVars) {
        expect(rule[0]).toBe("warn");
        expect(rule[1]).toMatchObject({
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        });
      }
    });
  });
});
