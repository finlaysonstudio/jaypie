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
  });
});
