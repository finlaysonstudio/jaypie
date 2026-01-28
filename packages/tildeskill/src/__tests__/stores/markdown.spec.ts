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

    it("parses extended frontmatter fields", async () => {
      await fs.writeFile(
        path.join(tempDir, "aws.md"),
        `---
description: AWS documentation
includes: base, common
name: Amazon Web Services
nicknames: amazon, cloud
related: lambda, s3
tags: cloud, infrastructure
---

# AWS`,
      );

      const store = createMarkdownStore({ path: tempDir });
      const skill = await store.get("aws");

      expect(skill?.name).toBe("Amazon Web Services");
      expect(skill?.nicknames).toEqual(["amazon", "cloud"]);
      expect(skill?.tags).toEqual(["cloud", "infrastructure"]);
      expect(skill?.includes).toEqual(["base", "common"]);
    });

    it("parses extended frontmatter with array format", async () => {
      await fs.writeFile(
        path.join(tempDir, "aws.md"),
        `---
nicknames:
  - amazon
  - cloud
tags:
  - cloud
  - infrastructure
---

# AWS`,
      );

      const store = createMarkdownStore({ path: tempDir });
      const skill = await store.get("aws");

      expect(skill?.nicknames).toEqual(["amazon", "cloud"]);
      expect(skill?.tags).toEqual(["cloud", "infrastructure"]);
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

    it("writes extended frontmatter fields", async () => {
      const store = createMarkdownStore({ path: tempDir });
      await store.put({
        alias: "aws",
        content: "# AWS",
        includes: ["base", "common"],
        name: "Amazon Web Services",
        nicknames: ["amazon", "cloud"],
        tags: ["cloud", "infrastructure"],
      });

      const content = await fs.readFile(path.join(tempDir, "aws.md"), "utf-8");
      expect(content).toContain("name: Amazon Web Services");
      expect(content).toMatch(/nicknames:.*amazon.*cloud/);
      expect(content).toMatch(/tags:.*cloud.*infrastructure/);
      expect(content).toMatch(/includes:.*base.*common/);
    });
  });

  describe("getByNickname", () => {
    it("finds skill by nickname", async () => {
      await fs.writeFile(
        path.join(tempDir, "aws.md"),
        `---
nicknames: amazon, cloud
---

# AWS`,
      );

      const store = createMarkdownStore({ path: tempDir });
      const skill = await store.getByNickname("amazon");

      expect(skill?.alias).toBe("aws");
    });

    it("returns null when nickname not found", async () => {
      await fs.writeFile(
        path.join(tempDir, "aws.md"),
        `---
nicknames: amazon
---

# AWS`,
      );

      const store = createMarkdownStore({ path: tempDir });
      const skill = await store.getByNickname("google");

      expect(skill).toBeNull();
    });

    it("normalizes nickname during lookup", async () => {
      await fs.writeFile(
        path.join(tempDir, "aws.md"),
        `---
nicknames: amazon
---

# AWS`,
      );

      const store = createMarkdownStore({ path: tempDir });
      const skill = await store.getByNickname("AMAZON");

      expect(skill?.alias).toBe("aws");
    });
  });

  describe("list with filter", () => {
    it("filters by namespace prefix", async () => {
      await fs.writeFile(path.join(tempDir, "kit:utils.md"), "# Utils");
      await fs.writeFile(path.join(tempDir, "kit:helpers.md"), "# Helpers");
      await fs.writeFile(path.join(tempDir, "aws.md"), "# AWS");

      const store = createMarkdownStore({ path: tempDir });
      const skills = await store.list({ namespace: "kit:" });

      expect(skills.map((s) => s.alias)).toEqual(["kit:helpers", "kit:utils"]);
    });

    it("filters by tag", async () => {
      await fs.writeFile(
        path.join(tempDir, "aws.md"),
        `---
tags: cloud, infrastructure
---

# AWS`,
      );
      await fs.writeFile(
        path.join(tempDir, "tests.md"),
        `---
tags: testing
---

# Tests`,
      );

      const store = createMarkdownStore({ path: tempDir });
      const skills = await store.list({ tag: "cloud" });

      expect(skills.map((s) => s.alias)).toEqual(["aws"]);
    });

    it("filters by both namespace and tag", async () => {
      await fs.writeFile(
        path.join(tempDir, "kit:cloud.md"),
        `---
tags: cloud
---

# Kit Cloud`,
      );
      await fs.writeFile(
        path.join(tempDir, "kit:utils.md"),
        `---
tags: utilities
---

# Kit Utils`,
      );
      await fs.writeFile(
        path.join(tempDir, "aws.md"),
        `---
tags: cloud
---

# AWS`,
      );

      const store = createMarkdownStore({ path: tempDir });
      const skills = await store.list({ namespace: "kit:", tag: "cloud" });

      expect(skills.map((s) => s.alias)).toEqual(["kit:cloud"]);
    });
  });

  describe("search", () => {
    it("finds skill by alias match", async () => {
      await fs.writeFile(path.join(tempDir, "aws-lambda.md"), "# Lambda");
      await fs.writeFile(path.join(tempDir, "tests.md"), "# Tests");

      const store = createMarkdownStore({ path: tempDir });
      const results = await store.search("lambda");

      expect(results.map((s) => s.alias)).toEqual(["aws-lambda"]);
    });

    it("finds skill by name match", async () => {
      await fs.writeFile(
        path.join(tempDir, "aws.md"),
        `---
name: Amazon Web Services
---

# AWS`,
      );
      await fs.writeFile(path.join(tempDir, "tests.md"), "# Tests");

      const store = createMarkdownStore({ path: tempDir });
      const results = await store.search("amazon");

      expect(results.map((s) => s.alias)).toEqual(["aws"]);
    });

    it("finds skill by description match", async () => {
      await fs.writeFile(
        path.join(tempDir, "aws.md"),
        `---
description: Cloud computing services
---

# AWS`,
      );

      const store = createMarkdownStore({ path: tempDir });
      const results = await store.search("computing");

      expect(results.map((s) => s.alias)).toEqual(["aws"]);
    });

    it("finds skill by content match", async () => {
      await fs.writeFile(
        path.join(tempDir, "aws.md"),
        "# AWS\n\nDeploy to the cloud",
      );
      await fs.writeFile(
        path.join(tempDir, "tests.md"),
        "# Tests\n\nRun unit tests",
      );

      const store = createMarkdownStore({ path: tempDir });
      const results = await store.search("deploy");

      expect(results.map((s) => s.alias)).toEqual(["aws"]);
    });

    it("finds skill by tag match", async () => {
      await fs.writeFile(
        path.join(tempDir, "aws.md"),
        `---
tags: infrastructure
---

# AWS`,
      );

      const store = createMarkdownStore({ path: tempDir });
      const results = await store.search("infra");

      expect(results.map((s) => s.alias)).toEqual(["aws"]);
    });

    it("returns empty array when no matches", async () => {
      await fs.writeFile(path.join(tempDir, "aws.md"), "# AWS");

      const store = createMarkdownStore({ path: tempDir });
      const results = await store.search("nonexistent");

      expect(results).toEqual([]);
    });
  });
});
