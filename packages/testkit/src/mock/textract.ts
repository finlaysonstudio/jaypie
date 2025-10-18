import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { beforeAll, vi } from "vitest";
import { TextractDocument } from "amazon-textract-response-parser";
import type { TextractPageAdaptable } from "@jaypie/textract";
import type { JsonReturn } from "@jaypie/types";
import {
  createMockWrappedFunction,
  createMockFunction,
  createMockWrappedObject,
} from "./utils";
import * as original from "@jaypie/textract";

// Constants for mock values
const TAG = "TEXTRACT";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MOCK_TEXTRACT_DOCUMENT_PATH = join(__dirname, "..", "mockTextract.json");

// Setup
let mockTextractContents: string;
beforeAll(async () => {
  mockTextractContents = await readFile(MOCK_TEXTRACT_DOCUMENT_PATH, "utf-8");
});

/**
 * Mock for MarkdownPage class from @jaypie/textract
 */
export const MarkdownPage = createMockWrappedObject(original.MarkdownPage, {
  class: true,
  fallback: () => {
    const mockDocument = new TextractDocument(JSON.parse(mockTextractContents));
    // Double type assertion needed to bridge incompatible types
    return new original.MarkdownPage(
      mockDocument.pageNumber(1) as unknown as TextractPageAdaptable,
    );
  },
});

/**
 * Mock for textractJsonToMarkdown function from @jaypie/textract
 */
export const textractJsonToMarkdown = createMockWrappedFunction<string>(
  original.textractJsonToMarkdown as any,
  `_MOCK_TEXTRACT_JSON_TO_MARKDOWN_[${TAG}]`,
);

// Export default for convenience
export default {
  MarkdownPage,
  textractJsonToMarkdown,
};
