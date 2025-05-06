/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createMockFunction } from "./utils";

// Constants for mock values
const TAG = "TEXTRACT";

// Try to import from the original package first
let originalMarkdownPage: any;
let originalTextractJsonToMarkdown: any;

(async () => {
  try {
    const textractImport = await import("@jaypie/textract");
    originalMarkdownPage = textractImport.MarkdownPage;
    originalTextractJsonToMarkdown = textractImport.textractJsonToMarkdown;
  } catch (error) {
    // If the original package is not available, we'll use mock implementations
    console.warn(
      "[Mock] Could not import @jaypie/textract. Using mock implementations only.",
    );
  }
})();

/**
 * Mock for MarkdownPage class from @jaypie/textract
 * Tries to use the original implementation first, then falls back to a mock
 */
export class MarkdownPage {
  private _page: any;
  private _mockText: string;

  constructor(page: any) {
    this._page = page;
    this._mockText = `---\ntype: page\nid: ${(page?.id || "mock-id").slice(0, 8)}\n---\n\n# Mock Markdown Page\n\nThis is a mock markdown page generated for testing.`;

    // Try to use the original implementation if available
    if (originalMarkdownPage) {
      try {
        return new originalMarkdownPage(page);
      } catch (error) {
        console.warn(
          "[Mock] Failed to use original MarkdownPage implementation. Using mock instead.",
        );
      }
    }
  }

  get text(): string {
    return this._mockText;
  }

  get _text(): string {
    return this._page?.text || "mock text content";
  }

  get _layout() {
    return this._page?.layout || { listItems: () => [] };
  }
}

/**
 * Mock for textractJsonToMarkdown function from @jaypie/textract
 * Tries to use the original implementation first, then falls back to a mock
 * @param textractResults The Textract results as parsed JSON or stringified JSON
 * @returns The markdown representation of the document
 */
export const textractJsonToMarkdown = createMockFunction<
  (textractResults: any) => string
>((textractResults) => {
  try {
    // Try to use the original implementation if available
    if (originalTextractJsonToMarkdown) {
      return originalTextractJsonToMarkdown(textractResults);
    }
  } catch (error) {
    console.warn(
      "[Mock] Failed to use original textractJsonToMarkdown implementation. Using mock instead.",
    );
  }

  // Fall back to mock implementation
  const parsedResults =
    typeof textractResults === "string"
      ? JSON.parse(textractResults)
      : textractResults;

  // Create a simple mock markdown representation
  return `---
type: page
id: ${(parsedResults?.id || "mock-id").slice(0, 8)}
---

# Mock Textract Document

This is a mock textract document generated for testing.

## Page 1

This is mock content for page 1.

## Page 2

This is mock content for page 2.`;
});
