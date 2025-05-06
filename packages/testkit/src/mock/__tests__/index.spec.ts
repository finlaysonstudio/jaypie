import { describe, it, expect } from "vitest";
import mockDefault, * as mockExports from "..";

describe("Mock Index", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("should export all named exports correctly", () => {
      // Check for required utility exports
      expect(mockExports).toHaveProperty("createMockFunction");
      expect(mockExports).toHaveProperty("createAutoMocks");
      expect(mockExports).toHaveProperty("createDeepMock");

      // Verify that we have exports from each module
      // Check for specific exports from each module
      const expectedExports = [
        // Utilities
        "createMockFunction",
        "createAutoMocks",
        "createDeepMock",

        // AWS module
        "getMessages",
        "getSecret",
        "sendMessage",

        // Core module
        "validate",
        "getConfig",
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
  });
});
