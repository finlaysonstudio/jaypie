import { describe, expect, it } from "vitest";

import {
  isLlmOperateInput,
  isLlmOperateInputContent,
  isLlmOperateInputFile,
  isLlmOperateInputImage,
} from "../LlmOperateInput.guards.js";

describe("LlmOperateInput Guards", () => {
  describe("isLlmOperateInputFile", () => {
    it("returns true for valid file input", () => {
      expect(isLlmOperateInputFile({ file: "document.pdf" })).toBe(true);
    });

    it("returns true for file input with bucket", () => {
      expect(
        isLlmOperateInputFile({ file: "document.pdf", bucket: "my-bucket" }),
      ).toBe(true);
    });

    it("returns true for file input with pages", () => {
      expect(
        isLlmOperateInputFile({ file: "document.pdf", pages: [1, 2, 3] }),
      ).toBe(true);
    });

    it("returns true for file input with data", () => {
      expect(
        isLlmOperateInputFile({ file: "document.pdf", data: "base64data" }),
      ).toBe(true);
    });

    it("returns false for null", () => {
      expect(isLlmOperateInputFile(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isLlmOperateInputFile(undefined)).toBe(false);
    });

    it("returns false for string", () => {
      expect(isLlmOperateInputFile("document.pdf")).toBe(false);
    });

    it("returns false for image input", () => {
      expect(isLlmOperateInputFile({ image: "photo.png" })).toBe(false);
    });

    it("returns false for empty object", () => {
      expect(isLlmOperateInputFile({})).toBe(false);
    });
  });

  describe("isLlmOperateInputImage", () => {
    it("returns true for valid image input", () => {
      expect(isLlmOperateInputImage({ image: "photo.png" })).toBe(true);
    });

    it("returns true for image input with bucket", () => {
      expect(
        isLlmOperateInputImage({ image: "photo.png", bucket: "my-bucket" }),
      ).toBe(true);
    });

    it("returns true for image input with data", () => {
      expect(
        isLlmOperateInputImage({ image: "photo.png", data: "base64data" }),
      ).toBe(true);
    });

    it("returns false for null", () => {
      expect(isLlmOperateInputImage(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isLlmOperateInputImage(undefined)).toBe(false);
    });

    it("returns false for string", () => {
      expect(isLlmOperateInputImage("photo.png")).toBe(false);
    });

    it("returns false for file input", () => {
      expect(isLlmOperateInputImage({ file: "document.pdf" })).toBe(false);
    });

    it("returns false for empty object", () => {
      expect(isLlmOperateInputImage({})).toBe(false);
    });
  });

  describe("isLlmOperateInputContent", () => {
    it("returns true for string", () => {
      expect(isLlmOperateInputContent("Hello, world!")).toBe(true);
    });

    it("returns true for file input", () => {
      expect(isLlmOperateInputContent({ file: "document.pdf" })).toBe(true);
    });

    it("returns true for image input", () => {
      expect(isLlmOperateInputContent({ image: "photo.png" })).toBe(true);
    });

    it("returns false for null", () => {
      expect(isLlmOperateInputContent(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isLlmOperateInputContent(undefined)).toBe(false);
    });

    it("returns false for number", () => {
      expect(isLlmOperateInputContent(42)).toBe(false);
    });

    it("returns false for empty object", () => {
      expect(isLlmOperateInputContent({})).toBe(false);
    });
  });

  describe("isLlmOperateInput", () => {
    it("returns true for array with string", () => {
      expect(isLlmOperateInput(["Hello, world!"])).toBe(true);
    });

    it("returns true for array with file input", () => {
      expect(isLlmOperateInput([{ file: "document.pdf" }])).toBe(true);
    });

    it("returns true for array with image input", () => {
      expect(isLlmOperateInput([{ image: "photo.png" }])).toBe(true);
    });

    it("returns true for mixed array", () => {
      expect(
        isLlmOperateInput([
          "Extract text from these documents",
          { file: "document.pdf", bucket: "my-bucket", pages: [1, 2, 3] },
          { image: "photo.png" },
        ]),
      ).toBe(true);
    });

    it("returns false for empty array", () => {
      expect(isLlmOperateInput([])).toBe(false);
    });

    it("returns false for array with invalid item", () => {
      expect(isLlmOperateInput(["valid", null])).toBe(false);
    });

    it("returns false for array with empty object", () => {
      expect(isLlmOperateInput(["valid", {}])).toBe(false);
    });

    it("returns false for null", () => {
      expect(isLlmOperateInput(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isLlmOperateInput(undefined)).toBe(false);
    });

    it("returns false for string", () => {
      expect(isLlmOperateInput("Hello, world!")).toBe(false);
    });

    it("returns false for object", () => {
      expect(isLlmOperateInput({ file: "document.pdf" })).toBe(false);
    });
  });
});
