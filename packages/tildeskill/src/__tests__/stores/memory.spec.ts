import { describe, expect, it } from "vitest";

import { createMemoryStore } from "../../stores/memory";

describe("createMemoryStore", () => {
  describe("initialization", () => {
    it("creates empty store without arguments", async () => {
      const store = createMemoryStore();
      const skills = await store.list();
      expect(skills).toEqual([]);
    });

    it("initializes with provided records", async () => {
      const store = createMemoryStore([
        { alias: "aws", content: "# AWS" },
        { alias: "tests", content: "# Tests" },
      ]);
      const skills = await store.list();
      expect(skills).toHaveLength(2);
    });

    it("normalizes aliases during initialization", async () => {
      const store = createMemoryStore([{ alias: "AWS", content: "# AWS" }]);
      const skill = await store.get("aws");
      expect(skill?.alias).toBe("aws");
    });
  });

  describe("get", () => {
    it("returns skill by alias", async () => {
      const store = createMemoryStore([
        { alias: "aws", content: "# AWS", description: "AWS docs" },
      ]);
      const skill = await store.get("aws");
      expect(skill).toEqual({
        alias: "aws",
        content: "# AWS",
        description: "AWS docs",
      });
    });

    it("returns null for non-existent skill", async () => {
      const store = createMemoryStore();
      const skill = await store.get("nonexistent");
      expect(skill).toBeNull();
    });

    it("normalizes alias during lookup", async () => {
      const store = createMemoryStore([{ alias: "aws", content: "# AWS" }]);
      const skill = await store.get("AWS");
      expect(skill?.alias).toBe("aws");
    });
  });

  describe("list", () => {
    it("returns all skills sorted by alias", async () => {
      const store = createMemoryStore([
        { alias: "tests", content: "# Tests" },
        { alias: "aws", content: "# AWS" },
        { alias: "errors", content: "# Errors" },
      ]);
      const skills = await store.list();
      expect(skills.map((s) => s.alias)).toEqual(["aws", "errors", "tests"]);
    });

    it("returns empty array for empty store", async () => {
      const store = createMemoryStore();
      const skills = await store.list();
      expect(skills).toEqual([]);
    });
  });

  describe("put", () => {
    it("stores new skill", async () => {
      const store = createMemoryStore();
      const result = await store.put({
        alias: "aws",
        content: "# AWS",
        description: "AWS docs",
      });
      expect(result.alias).toBe("aws");

      const skill = await store.get("aws");
      expect(skill?.content).toBe("# AWS");
    });

    it("updates existing skill", async () => {
      const store = createMemoryStore([{ alias: "aws", content: "# Old AWS" }]);
      await store.put({ alias: "aws", content: "# New AWS" });

      const skill = await store.get("aws");
      expect(skill?.content).toBe("# New AWS");
    });

    it("normalizes alias on put", async () => {
      const store = createMemoryStore();
      const result = await store.put({ alias: "AWS", content: "# AWS" });
      expect(result.alias).toBe("aws");
    });

    it("stores related skills", async () => {
      const store = createMemoryStore();
      await store.put({
        alias: "aws",
        content: "# AWS",
        related: ["lambda", "s3"],
      });

      const skill = await store.get("aws");
      expect(skill?.related).toEqual(["lambda", "s3"]);
    });

    it("stores all extended fields", async () => {
      const store = createMemoryStore();
      await store.put({
        alias: "aws",
        content: "# AWS",
        includes: ["base"],
        name: "AWS Documentation",
        nicknames: ["amazon", "cloud"],
        tags: ["cloud", "infrastructure"],
      });

      const skill = await store.get("aws");
      expect(skill?.name).toBe("AWS Documentation");
      expect(skill?.nicknames).toEqual(["amazon", "cloud"]);
      expect(skill?.tags).toEqual(["cloud", "infrastructure"]);
      expect(skill?.includes).toEqual(["base"]);
    });
  });

  describe("getByNickname", () => {
    it("finds skill by nickname", async () => {
      const store = createMemoryStore([
        {
          alias: "aws",
          content: "# AWS",
          nicknames: ["amazon", "cloud"],
        },
      ]);

      const skill = await store.getByNickname("amazon");
      expect(skill?.alias).toBe("aws");
    });

    it("returns null when nickname not found", async () => {
      const store = createMemoryStore([
        { alias: "aws", content: "# AWS", nicknames: ["amazon"] },
      ]);

      const skill = await store.getByNickname("google");
      expect(skill).toBeNull();
    });

    it("normalizes nickname during lookup", async () => {
      const store = createMemoryStore([
        { alias: "aws", content: "# AWS", nicknames: ["amazon"] },
      ]);

      const skill = await store.getByNickname("AMAZON");
      expect(skill?.alias).toBe("aws");
    });

    it("returns null for skill without nicknames", async () => {
      const store = createMemoryStore([{ alias: "aws", content: "# AWS" }]);

      const skill = await store.getByNickname("amazon");
      expect(skill).toBeNull();
    });
  });

  describe("list with filter", () => {
    it("filters by namespace prefix", async () => {
      const store = createMemoryStore([
        { alias: "kit:utils", content: "# Utils" },
        { alias: "kit:helpers", content: "# Helpers" },
        { alias: "aws", content: "# AWS" },
      ]);

      const skills = await store.list({ namespace: "kit:" });
      expect(skills.map((s) => s.alias)).toEqual(["kit:helpers", "kit:utils"]);
    });

    it("filters by namespace with wildcard", async () => {
      const store = createMemoryStore([
        { alias: "kit:utils", content: "# Utils" },
        { alias: "kit:helpers", content: "# Helpers" },
        { alias: "aws", content: "# AWS" },
      ]);

      const skills = await store.list({ namespace: "kit:*" });
      expect(skills.map((s) => s.alias)).toEqual(["kit:helpers", "kit:utils"]);
    });

    it("filters by tag", async () => {
      const store = createMemoryStore([
        { alias: "aws", content: "# AWS", tags: ["cloud", "infrastructure"] },
        { alias: "lambda", content: "# Lambda", tags: ["cloud", "serverless"] },
        { alias: "tests", content: "# Tests", tags: ["testing"] },
      ]);

      const skills = await store.list({ tag: "cloud" });
      expect(skills.map((s) => s.alias)).toEqual(["aws", "lambda"]);
    });

    it("filters by tag with normalization", async () => {
      const store = createMemoryStore([
        { alias: "aws", content: "# AWS", tags: ["Cloud"] },
      ]);

      const skills = await store.list({ tag: "CLOUD" });
      expect(skills).toHaveLength(1);
    });

    it("filters by both namespace and tag", async () => {
      const store = createMemoryStore([
        { alias: "kit:utils", content: "# Utils", tags: ["utilities"] },
        { alias: "kit:cloud", content: "# Cloud", tags: ["cloud"] },
        { alias: "aws", content: "# AWS", tags: ["cloud"] },
      ]);

      const skills = await store.list({ namespace: "kit:", tag: "cloud" });
      expect(skills.map((s) => s.alias)).toEqual(["kit:cloud"]);
    });

    it("returns all skills without filter", async () => {
      const store = createMemoryStore([
        { alias: "aws", content: "# AWS" },
        { alias: "tests", content: "# Tests" },
      ]);

      const skills = await store.list();
      expect(skills).toHaveLength(2);
    });
  });

  describe("search", () => {
    it("finds skill by alias match", async () => {
      const store = createMemoryStore([
        { alias: "aws-lambda", content: "# Lambda" },
        { alias: "tests", content: "# Tests" },
      ]);

      const results = await store.search("lambda");
      expect(results.map((s) => s.alias)).toEqual(["aws-lambda"]);
    });

    it("finds skill by name match", async () => {
      const store = createMemoryStore([
        { alias: "aws", content: "# AWS", name: "Amazon Web Services" },
        { alias: "tests", content: "# Tests" },
      ]);

      const results = await store.search("amazon");
      expect(results.map((s) => s.alias)).toEqual(["aws"]);
    });

    it("finds skill by description match", async () => {
      const store = createMemoryStore([
        { alias: "aws", content: "# AWS", description: "Cloud computing" },
        { alias: "tests", content: "# Tests" },
      ]);

      const results = await store.search("computing");
      expect(results.map((s) => s.alias)).toEqual(["aws"]);
    });

    it("finds skill by content match", async () => {
      const store = createMemoryStore([
        { alias: "aws", content: "# AWS\n\nDeploy to the cloud" },
        { alias: "tests", content: "# Tests\n\nRun unit tests" },
      ]);

      const results = await store.search("deploy");
      expect(results.map((s) => s.alias)).toEqual(["aws"]);
    });

    it("finds skill by tag match", async () => {
      const store = createMemoryStore([
        { alias: "aws", content: "# AWS", tags: ["infrastructure"] },
        { alias: "tests", content: "# Tests", tags: ["testing"] },
      ]);

      const results = await store.search("infra");
      expect(results.map((s) => s.alias)).toEqual(["aws"]);
    });

    it("returns case-insensitive matches", async () => {
      const store = createMemoryStore([
        { alias: "aws", content: "# AWS", name: "Amazon" },
      ]);

      const results = await store.search("AMAZON");
      expect(results).toHaveLength(1);
    });

    it("returns empty array when no matches", async () => {
      const store = createMemoryStore([{ alias: "aws", content: "# AWS" }]);

      const results = await store.search("nonexistent");
      expect(results).toEqual([]);
    });

    it("returns sorted results", async () => {
      const store = createMemoryStore([
        { alias: "z-cloud", content: "# Cloud Z" },
        { alias: "a-cloud", content: "# Cloud A" },
      ]);

      const results = await store.search("cloud");
      expect(results.map((s) => s.alias)).toEqual(["a-cloud", "z-cloud"]);
    });
  });
});
