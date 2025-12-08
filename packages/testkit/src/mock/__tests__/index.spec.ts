import { describe, it, expect } from "vitest";
import mockDefault, * as mockExports from "..";

import { original } from "../original";

describe("Mock Index", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("should export all named exports correctly", () => {
      // Verify that we have exports from each module
      // Check for specific exports from each module
      const expectedExports = [
        // AWS module
        "getMessages",
        "getSecret",
        "sendMessage",

        // Core module
        "log",
        "cloneDeep",

        // Datadog module
        "submitMetric",
        "submitMetricSet",

        // Express module
        "expressHandler",
        "echoRoute",

        // Lambda module
        "lambdaHandler",

        // LLM module
        "Llm",
        "toolkit",
        "tools",

        // Mongoose module
        "connect",
        "connectFromSecretEnv",
        "disconnect",
        "mongoose",

        // Textract module
        "MarkdownPage",
        "textractJsonToMarkdown",
      ];

      for (const exportName of expectedExports) {
        expect(mockExports).toHaveProperty(exportName);
      }
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    it("should have default export with all mocks", () => {
      for (const key of Object.keys(mockExports)) {
        if (key !== "default") {
          expect(mockDefault).toHaveProperty(key);
        }
      }
    });
    it("should have all exports from original", () => {
      const originalExportKeys = [];
      for (const lib of Object.keys(original)) {
        const libModule = original[lib as keyof typeof original];
        // Skip if module is a proxy (package not installed)
        if (libModule && typeof libModule === "object") {
          for (const exportName of Object.keys(libModule)) {
            originalExportKeys.push(exportName);
          }
        }
      }
      const uniqueOriginalKeys = [...new Set(originalExportKeys)].filter(
        (key) => key !== "default",
      );
      uniqueOriginalKeys.sort();
      const mockExportKeys = Object.keys(mockExports).filter(
        (key) => key !== "default",
      );
      mockExportKeys.sort();
      // Mock should have at least all the exports from original
      // (mock may have more due to explicit exports from packages that use lazy loading)
      for (const key of uniqueOriginalKeys) {
        expect(mockExportKeys).toContain(key);
      }
    });
  });
});
