import { describe, expect, it, vi } from "vitest";

// Every optional package reads as not installed
vi.mock("../original", () => ({
  aws: {},
  datadog: {},
  dynamodb: {},
  express: {},
  llm: {},
  textract: {},
  textractResponseParser: {},
}));

// Subject
import * as mock from "..";

describe("Mock entry without optional packages", () => {
  describe("Base Cases", () => {
    it("Loads", () => {
      expect(mock.expressHandler).toBeFunction();
      expect(mock.log).toBeDefined();
    });
  });

  describe("Happy Paths", () => {
    it("Falls back when the wrapped function is absent", () => {
      expect(mock.echoRoute({ echo: true })).toEqual({ echo: true });
      expect(mock.getMessages()).toEqual([]);
      expect(mock.hasDatadogEnv()).toBe(false);
      expect(mock.textractJsonToMarkdown()).toBe(
        "_MOCK_TEXTRACT_JSON_TO_MARKDOWN_[TEXTRACT]",
      );
    });

    it("Leaves absent pass-through exports undefined", () => {
      expect(mock.APEX).toBeUndefined();
      expect(mock.EXPRESS).toBeUndefined();
      expect(mock.JaypieToolkit).toBeUndefined();
      expect(mock.LLM).toBeUndefined();
      expect(mock.MarkdownPage).toBeUndefined();
      expect(mock.toolkit).toBeUndefined();
      expect(mock.tools).toBeUndefined();
    });

    it("Keeps mocks that wrap no package", async () => {
      await expect(mock.getSecret()).resolves.toBe("mock-secret-value");
      await expect(new mock.Llm().operate()).resolves.toMatchObject({
        content: "_MOCK_OUTPUT_TEXT",
      });
    });
  });
});
