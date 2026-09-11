import { describe, it, expect } from "vitest";
import * as aws from "@jaypie/aws";
import * as datadog from "@jaypie/datadog";
import * as errors from "@jaypie/errors";
import * as express from "@jaypie/express";
import * as kit from "@jaypie/kit";
import * as lambda from "@jaypie/lambda";
import * as llm from "@jaypie/llm";
import * as logger from "@jaypie/logger";
import * as textract from "@jaypie/textract";
import mockDefault, * as mockExports from "..";

// Packages whose exports the mock entry stands in for
const original = {
  aws,
  datadog,
  errors,
  express,
  kit,
  lambda,
  llm,
  logger,
  textract,
};

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

        // Textract module
        "MarkdownPage",
        "textractJsonToMarkdown",
      ];

      for (const exportName of expectedExports) {
        expect(mockExports).toHaveProperty(exportName);
      }
    });

    it("should not export the deprecated mongoose mock (no @jaypie/mongoose phantom dep)", () => {
      // Dropped per #385: the umbrella must not pull in deprecated
      // @jaypie/mongoose, which broke @jaypie/testkit/mock at load time
      // in projects without mongoose installed.
      expect(mockExports).not.toHaveProperty("mongoose");
      expect(mockExports).not.toHaveProperty("connectFromSecretEnv");
      expect(mockExports).not.toHaveProperty("disconnect");
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
        for (const exportName of Object.keys(libModule)) {
          originalExportKeys.push(exportName);
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
      for (const key of uniqueOriginalKeys) {
        expect(mockExportKeys).toContain(key);
      }
    });
  });
});
