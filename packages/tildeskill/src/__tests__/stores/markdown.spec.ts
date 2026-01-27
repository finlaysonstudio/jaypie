import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createMarkdownStore } from "../../stores/markdown";

describe("createMarkdownStore", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tildeskill-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("get", () => {
    it("returns skill from markdown file", async () => {
      await fs.writeFile(
        path.join(tempDir, "aws.md"),
        "# AWS\n\nAWS documentation",
      );

      const store = createMarkdownStore({ path: tempDir });
      const skill = await store.get("aws");

      expect(skill).toEqual({
        alias: "aws",
        content: "# AWS\n\nAWS documentation",
      });
    });

    it("parses frontmatter", async () => {
      await fs.writeFile(
        path.join(tempDir, "aws.md"),
        `---
description: AWS documentation
related: lambda, s3
---

# AWS

Content here`,
      );

      const store = createMarkdownStore({ path: tempDir });
      const skill = await store.get("aws");

      expect(skill?.description).toBe("AWS documentation");
      expect(skill?.related).toEqual(["lambda", "s3"]);
      expect(skill?.content).toBe("# AWS\n\nContent here");
    });

    it("returns null for non-existent file", async () => {
      const store = createMarkdownStore({ path: tempDir });
      const skill = await store.get("nonexistent");
      expect(skill).toBeNull();
    });

    it("normalizes alias during lookup", async () => {
      await fs.writeFile(path.join(tempDir, "aws.md"), "# AWS");

      const store = createMarkdownStore({ path: tempDir });
      const skill = await store.get("AWS");

      expect(skill?.alias).toBe("aws");
    });

    it("handles frontmatter with array related field", async () => {
      await fs.writeFile(
        path.join(tempDir, "aws.md"),
        `---
description: AWS docs
related:
  - lambda
  - s3
---

# AWS`,
      );

      const store = createMarkdownStore({ path: tempDir });
      const skill = await store.get("aws");

      expect(skill?.related).toEqual(["lambda", "s3"]);
    });
  });

  describe("list", () => {
    it("returns all markdown files sorted by alias", async () => {
      await fs.writeFile(path.join(tempDir, "tests.md"), "# Tests");
      await fs.writeFile(path.join(tempDir, "aws.md"), "# AWS");
      await fs.writeFile(path.join(tempDir, "errors.md"), "# Errors");

      const store = createMarkdownStore({ path: tempDir });
      const skills = await store.list();

      expect(skills.map((s) => s.alias)).toEqual(["aws", "errors", "tests"]);
    });

    it("returns empty array for empty directory", async () => {
      const store = createMarkdownStore({ path: tempDir });
      const skills = await store.list();
      expect(skills).toEqual([]);
    });

    it("returns empty array for non-existent directory", async () => {
      const store = createMarkdownStore({ path: "/nonexistent/path" });
      const skills = await store.list();
      expect(skills).toEqual([]);
    });

    it("only includes .md files", async () => {
      await fs.writeFile(path.join(tempDir, "aws.md"), "# AWS");
      await fs.writeFile(path.join(tempDir, "readme.txt"), "Not a skill");

      const store = createMarkdownStore({ path: tempDir });
      const skills = await store.list();

      expect(skills).toHaveLength(1);
      expect(skills[0].alias).toBe("aws");
    });
  });

  describe("put", () => {
    it("writes skill to markdown file", async () => {
      const store = createMarkdownStore({ path: tempDir });
      await store.put({ alias: "aws", content: "# AWS\n\nContent" });

      const content = await fs.readFile(path.join(tempDir, "aws.md"), "utf-8");
      expect(content).toBe("# AWS\n\nContent");
    });

    it("writes frontmatter when metadata present", async () => {
      const store = createMarkdownStore({ path: tempDir });
      await store.put({
        alias: "aws",
        content: "# AWS",
        description: "AWS docs",
        related: ["lambda", "s3"],
      });

      const content = await fs.readFile(path.join(tempDir, "aws.md"), "utf-8");
      expect(content).toContain("---");
      expect(content).toContain("description: AWS docs");
      expect(content).toMatch(/related:.*lambda.*s3/);
    });

    it("normalizes alias on put", async () => {
      const store = createMarkdownStore({ path: tempDir });
      const result = await store.put({ alias: "AWS", content: "# AWS" });

      expect(result.alias).toBe("aws");
      const exists = await fs
        .access(path.join(tempDir, "aws.md"))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it("overwrites existing file", async () => {
      await fs.writeFile(path.join(tempDir, "aws.md"), "# Old AWS");

      const store = createMarkdownStore({ path: tempDir });
      await store.put({ alias: "aws", content: "# New AWS" });

      const content = await fs.readFile(path.join(tempDir, "aws.md"), "utf-8");
      expect(content).toBe("# New AWS");
    });
  });
});
