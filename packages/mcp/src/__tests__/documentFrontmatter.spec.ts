import { parseFrontmatter } from "@jaypie/kit";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { getMcpAssetPaths } from "../assets.js";

//
//
// Constants
//

const MARKDOWN_EXTENSION = ".md";
const RELEASE_NOTE_FIELDS = ["date", "summary", "version"] as const;

//
//
// Helpers
//

async function listMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(entryPath)));
    } else if (entry.name.endsWith(MARKDOWN_EXTENSION)) {
      files.push(entryPath);
    }
  }
  return files;
}

/** Report the file with the YAML error so a failure names the offender */
function parseOrDescribe(
  file: string,
  content: string,
): Record<string, unknown> | string {
  try {
    return parseFrontmatter<Record<string, unknown>>(content).data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `${file}: ${message.split("\n")[0]}`;
  }
}

//
//
// Run tests
//

describe("Shipped document frontmatter", () => {
  const assets = getMcpAssetPaths();

  describe("Release notes", () => {
    it("parses every note's frontmatter", async () => {
      const files = await listMarkdownFiles(assets.releaseNotes);
      expect(files.length).toBeGreaterThan(0);
      const failures: string[] = [];
      for (const file of files) {
        const content = await fs.readFile(file, "utf-8");
        const data = parseOrDescribe(file, content);
        if (typeof data === "string") {
          failures.push(data);
        }
      }
      expect(failures).toEqual([]);
    });

    it("exposes date, summary, and version on every note", async () => {
      const files = await listMarkdownFiles(assets.releaseNotes);
      const failures: string[] = [];
      for (const file of files) {
        const content = await fs.readFile(file, "utf-8");
        const data = parseOrDescribe(file, content);
        if (typeof data === "string") {
          failures.push(data);
          continue;
        }
        for (const field of RELEASE_NOTE_FIELDS) {
          if (data[field] === undefined || data[field] === null) {
            failures.push(`${file}: missing ${field}`);
          }
        }
      }
      expect(failures).toEqual([]);
    });
  });

  describe("Skills", () => {
    it("parses every skill's frontmatter", async () => {
      const files = await listMarkdownFiles(assets.skills);
      expect(files.length).toBeGreaterThan(0);
      const failures: string[] = [];
      for (const file of files) {
        const content = await fs.readFile(file, "utf-8");
        const data = parseOrDescribe(file, content);
        if (typeof data === "string") {
          failures.push(data);
        }
      }
      expect(failures).toEqual([]);
    });
  });
});
