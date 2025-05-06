/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { beforeAll, vi } from "vitest";
import { TextractDocument } from "amazon-textract-response-parser";
import type { TextractPageAdaptable } from "@jaypie/textract";
import type { JsonReturn } from "@jaypie/types";

// Constants for mock values
const TAG = "TEXTRACT";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MOCK_TEXTRACT_DOCUMENT_PATH = join(__dirname, "..", "mockTextract.json");

// Initialize variables that will be set in beforeAll
let textractJsonToMarkdownOriginal = vi.fn<typeof textractJsonToMarkdown>();
let MarkdownPageOriginal: any;
let mockTextractContents: string;

// Setup
beforeAll(async () => {
  const textract =
    await vi.importActual<typeof import("@jaypie/textract")>(
      "@jaypie/textract",
    );
  textractJsonToMarkdownOriginal.mockImplementation(
    textract.textractJsonToMarkdown,
  );
  MarkdownPageOriginal = textract.MarkdownPage;
  mockTextractContents = await readFile(MOCK_TEXTRACT_DOCUMENT_PATH, "utf-8");
});

/**
 * Mock for MarkdownPage class from @jaypie/textract
 */
export const MarkdownPage = vi
  .fn()
  .mockImplementation((page: TextractPageAdaptable) => {
    try {
      return new MarkdownPageOriginal(page);
    } catch {
      // Only show warning if not in a test environment
      if (process.env.NODE_ENV !== "test") {
        // eslint-disable-next-line no-console
        console.warn(
          "[MarkdownPage] Actual implementation failed. To suppress this warning, manually mock the response with mockReturnValue",
        );
      }
      const mockDocument = new TextractDocument(
        JSON.parse(mockTextractContents),
      );
      // Double type assertion needed to bridge incompatible types
      return new MarkdownPageOriginal(
        mockDocument._pages[0] as unknown as TextractPageAdaptable,
      );
    }
  });

/**
 * Mock for textractJsonToMarkdown function from @jaypie/textract
 */
export const textractJsonToMarkdown = vi.fn(
  (textractResults: JsonReturn): string => {
    try {
      const result = textractJsonToMarkdownOriginal(textractResults);
      return result;
    } catch (error) {
      // Only show warning if not in a test environment
      if (process.env.NODE_ENV !== "test") {
        // eslint-disable-next-line no-console
        console.warn(
          "[textractJsonToMarkdown] Actual implementation failed. To suppress this warning, manually mock the response with mockReturnValue",
        );
      }
      return `_MOCK_TEXTRACT_JSON_TO_MARKDOWN_{{${textractResults}}}`;
    }
  },
);

// Export default for convenience
export default {
  MarkdownPage,
  textractJsonToMarkdown,
};
