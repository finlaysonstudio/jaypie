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
        "validate",
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
        for (const exportName of Object.keys(
          original[lib as keyof typeof original],
        )) {
          originalExportKeys.push(exportName);
        }
      }
      originalExportKeys.sort();
      const mockExportKeys = Object.keys(mockExports).filter(
        (key) => key !== "default",
      );
      mockExportKeys.sort();
      expect(mockExportKeys).toEqual(originalExportKeys);
    });
  });
});
