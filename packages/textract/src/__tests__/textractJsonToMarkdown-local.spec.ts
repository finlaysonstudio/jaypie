import { readFile, readdir } from "fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { log } from "jaypie";
import path from "path";

// Subject
import textractJsonToMarkdown from "../textractJsonToMarkdown.js";

//
//
// Mock setup
//

const FIXTURES_DIR = "./packages/textract/src/__tests__/__fixtures__/local";

//
//
// Run tests
//

describe("Textract JSON to Markdown Local Files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Processes local JSON files", async () => {
    try {
      const files = await readdir(FIXTURES_DIR);
      const jsonFiles = files.filter((file) => file.endsWith(".json"));

      if (jsonFiles.length === 0) {
        console.log(
          "textractJsonToMarkdown-local.spec.ts called with empty __fixtures__/local. Add textract JSON data to check files parse without warnings.",
        );
        return;
      }

      for (const file of jsonFiles) {
        const filePath = path.join(FIXTURES_DIR, file);
        const fileBuffer = await readFile(filePath);
        const jsonData = JSON.parse(fileBuffer.toString());

        // Check if this is a MongoDB document with raw textract data
        const completeDocument = jsonData.raw
          ? JSON.parse(jsonData.raw)
          : jsonData;

        const result = textractJsonToMarkdown(completeDocument);
        expect(result).toBeDefined();
        expect(result).toBeString();
        expect(result).not.toBeEmpty();
        expect(log).not.toBeCalledAboveTrace();
      }
    } catch (error: any) {
      if (error.code === "ENOENT") {
        console.log(
          "textractJsonToMarkdown-local.spec.ts called with empty __fixtures__/local. Add textract JSON data to check files parse without warnings.",
        );
      } else {
        throw error;
      }
    }
  });
});
