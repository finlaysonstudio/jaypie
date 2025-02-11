import { readFile } from "fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

// Subject
import textractJsonToMarkdown from "../textractJsonToMarkdown.js";

//
//
// Mock setup
//

const MOCK = {
  COMPLETE_DOCUMENT:
    "./packages/textract/src/__tests__/__fixtures__/textract.json",
};

let completeDocument: object;

beforeAll(async () => {
  const fileBuffer = await readFile(MOCK.COMPLETE_DOCUMENT);
  completeDocument = JSON.parse(fileBuffer.toString());
});

//
//
// Run tests
//

describe("Textract JSON to Markdown Function", () => {
  describe("Base Cases", () => {
    it("Is a function", () => {
      expect(textractJsonToMarkdown).toBeFunction();
    });

    it("Works", () => {
      const result = textractJsonToMarkdown(completeDocument);
      expect(result).toBeDefined();
      expect(result).toBeString();
      expect(result).not.toBeEmpty();
    });
  });

  describe("Features", () => {
    it("Accepts stringified JSON", () => {
      const result = textractJsonToMarkdown(JSON.stringify(completeDocument));
      expect(result).toBeDefined();
      expect(result).toBeString();
      expect(result).not.toBeEmpty();
    });

    it("Separates pages with double newlines", () => {
      const result = textractJsonToMarkdown(completeDocument);
      const pages = result.split("\n\n");
      expect(pages.length).toBeGreaterThan(1);
      pages.forEach((page) => {
        expect(page).toBeString();
        expect(page).not.toBeEmpty();
      });
    });
  });
});
