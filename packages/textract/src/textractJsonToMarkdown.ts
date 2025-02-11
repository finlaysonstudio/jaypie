import { JsonReturn } from "@jaypie/types";
import { TextractDocument } from "amazon-textract-response-parser";
import MarkdownPage from "./MarkdownPage.js";
import { TextractPage } from "./types.js";

/**
 * Convert Textract JSON output to markdown format
 * @param {object|string} textractResults - The Textract results as parsed JSON or stringified JSON
 * @returns {string} The markdown representation of the document
 */
const textractJsonToMarkdown = (
  textractResults: JsonReturn | string | object,
): string => {
  const parsedResults =
    typeof textractResults === "string"
      ? JSON.parse(textractResults)
      : textractResults;

  const document = new TextractDocument(parsedResults);
  const pages = document
    .listPages()
    .map((page) => new MarkdownPage(page as unknown as TextractPage));
  const markdown = pages.map((page) => page.text).join("\n\n");

  return markdown;
};

export default textractJsonToMarkdown;
