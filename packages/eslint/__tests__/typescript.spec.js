import { describe, expect, it } from "vitest";
import typescript from "../typescript.js";

describe("typescript", () => {
  describe("Base Cases", () => {
    it("is an Array", () => {
      expect(Array.isArray(typescript)).toBe(true);
    });

    it("works", () => {
      expect(typescript).toBeDefined();
    });
  });

  describe("Features", () => {
    it("includes file patterns", () => {
      const config = typescript.find((rule) => rule.files);
      expect(config.files).toContain("**/*.ts", "**/*.tsx");
    });

    it("includes browser globals", () => {
      const config = typescript.find((rule) => rule.languageOptions?.globals);
      expect(config.languageOptions.globals).toBeDefined();
    });

    it("includes prettier plugin", () => {
      const config = typescript.find((rule) => rule.plugins?.prettier);
      expect(config.plugins.prettier).toBeDefined();
    });
  });
});
