import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import * as dynamodb from "@jaypie/dynamodb";
import { ConfigurationError } from "@jaypie/errors";
import { getModelIndexes } from "@jaypie/fabric";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { uuidv5 } from "../../core/uuidv5";
import { createDynamoDbStore, SKILL_NAMESPACE } from "../../dynamodb";
import { hashSkill, SKILL_MODEL_NAME, syncSkills } from "../../index";
import { createSkillService } from "../../service";
import { createMarkdownStore } from "../../stores/markdown";

type Entity = Record<string, unknown> & { id: string };

const { table } = vi.hoisted(() => ({ table: new Map<string, Entity>() }));

vi.mock("@jaypie/dynamodb", () => ({
  deleteEntity: vi.fn(async ({ id }: { id: string }) => {
    const existing = table.get(id);
    if (!existing) return false;
    table.set(id, { ...existing, deletedAt: new Date().toISOString() });
    return true;
  }),
  getEntity: vi.fn(async ({ id }: { id: string }) => table.get(id) ?? null),
  queryByCategory: vi.fn(
    async ({
      category,
      limit,
      model,
      startKey,
    }: {
      category: string;
      limit?: number;
      model: string;
      startKey?: { offset: number };
    }) => {
      const matches = [...table.values()].filter(
        (e) => e.model === model && e.category === category && !e.deletedAt,
      );
      const offset = startKey?.offset ?? 0;
      const pageSize = limit ?? 2;
      const items = matches.slice(offset, offset + pageSize);
      const next = offset + pageSize;
      return {
        items,
        lastEvaluatedKey: next < matches.length ? { offset: next } : undefined,
      };
    },
  ),
  updateEntity: vi.fn(async ({ entity }: { entity: Entity }) => {
    const stored = {
      ...entity,
      createdAt: entity.createdAt ?? "2026-01-01T00:00:00.000Z",
      updatedAt: new Date().toISOString(),
    };
    table.set(entity.id, stored);
    return stored;
  }),
}));

describe("createDynamoDbStore", () => {
  beforeEach(() => {
    table.clear();
    vi.clearAllMocks();
  });

  describe("construction", () => {
    it("requires a category", () => {
      expect(() => createDynamoDbStore({ category: "" })).toThrow(
        ConfigurationError,
      );
    });

    it("registers the skill model with a category index", () => {
      createDynamoDbStore({ category: "jaypie" });
      const indexes = getModelIndexes(SKILL_MODEL_NAME);
      expect(indexes.some((i) => i.pk.join() === "model,category")).toBe(true);
    });

    it("exports a fixed namespace uuid", () => {
      expect(SKILL_NAMESPACE).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  describe("put", () => {
    it("writes a skill entity with a deterministic id and hash", async () => {
      const store = createDynamoDbStore({ category: "jaypie" });
      const record = {
        alias: "AWS",
        content: "# AWS",
        description: "AWS guide",
        includes: ["base"],
        name: "Amazon",
        nicknames: ["amazon"],
        related: ["lambda"],
        tags: ["cloud"],
      };

      const stored = await store.put(record);

      expect(stored).toEqual({ ...record, alias: "aws" });
      const id = uuidv5("jaypie:aws", { namespace: SKILL_NAMESPACE });
      expect(dynamodb.updateEntity).toHaveBeenCalledTimes(1);
      expect(table.get(id)).toMatchObject({
        alias: "aws",
        category: "jaypie",
        content: "# AWS",
        description: "AWS guide",
        id,
        metadata: {
          hash: hashSkill({ ...record, alias: "aws" }),
          includes: ["base"],
          nicknames: ["amazon"],
          related: ["lambda"],
        },
        model: "skill",
        name: "Amazon",
        scope: "@",
        tags: ["cloud"],
      });
    });

    it("scopes ids by category", async () => {
      const a = createDynamoDbStore({ category: "jaypie" });
      const b = createDynamoDbStore({ category: "studio" });
      await a.put({ alias: "aws", content: "# A" });
      await b.put({ alias: "aws", content: "# B" });

      expect(table.size).toBe(2);
      await expect(a.get("aws")).resolves.toMatchObject({ content: "# A" });
      await expect(b.get("aws")).resolves.toMatchObject({ content: "# B" });
    });

    it("preserves createdAt on overwrite and restores a deleted record", async () => {
      const store = createDynamoDbStore({ category: "jaypie" });
      await store.put({ alias: "aws", content: "# v1" });
      const id = uuidv5("jaypie:aws", { namespace: SKILL_NAMESPACE });
      table.set(id, { ...table.get(id)!, createdAt: "2020-01-01T00:00:00Z" });
      await store.delete("aws");

      await store.put({ alias: "aws", content: "# v2" });

      expect(table.get(id)).toMatchObject({
        content: "# v2",
        createdAt: "2020-01-01T00:00:00Z",
      });
      expect(table.get(id)?.deletedAt).toBeUndefined();
      await expect(store.get("aws")).resolves.toMatchObject({
        content: "# v2",
      });
    });
  });

  describe("get and find", () => {
    it("returns null when absent", async () => {
      const store = createDynamoDbStore({ category: "jaypie" });
      await expect(store.get("aws")).resolves.toBeNull();
    });

    it("returns a record without empty optional fields", async () => {
      const store = createDynamoDbStore({ category: "jaypie" });
      await store.put({ alias: "aws", content: "# AWS", tags: [] });
      await expect(store.get("aws")).resolves.toEqual({
        alias: "aws",
        content: "# AWS",
      });
    });

    it("find falls back to plural/singular spellings", async () => {
      const store = createDynamoDbStore({ category: "jaypie" });
      await store.put({ alias: "skill", content: "# Skill" });
      await expect(store.find("skills")).resolves.toMatchObject({
        alias: "skill",
      });
      await expect(store.find("nothing")).resolves.toBeNull();
    });
  });

  describe("list, getByNickname, and search", () => {
    it("lists every page of the category index sorted by alias", async () => {
      const store = createDynamoDbStore({ category: "jaypie" });
      const other = createDynamoDbStore({ category: "studio" });
      for (const alias of ["tests", "aws", "lambda", "dynamodb", "cdk"]) {
        await store.put({ alias, content: `# ${alias}`, tags: ["cloud"] });
      }
      await other.put({ alias: "private", content: "# Private" });

      const records = await store.list();

      expect(records.map((r) => r.alias)).toEqual([
        "aws",
        "cdk",
        "dynamodb",
        "lambda",
        "tests",
      ]);
      expect(dynamodb.queryByCategory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "jaypie", model: "skill" }),
      );
      await expect(store.list({ namespace: "d*" })).resolves.toHaveLength(1);
      await expect(store.list({ tag: "CLOUD" })).resolves.toHaveLength(5);
    });

    it("getByNickname and search filter the listing", async () => {
      const store = createDynamoDbStore({ category: "jaypie" });
      await store.put({
        alias: "aws",
        content: "# AWS",
        nicknames: ["amazon"],
      });
      await store.put({ alias: "gcp", content: "# Lambda-free cloud" });

      await expect(store.getByNickname("Amazon")).resolves.toMatchObject([
        { alias: "aws" },
      ]);
      await expect(store.search("lambda")).resolves.toMatchObject([
        { alias: "gcp" },
      ]);
    });
  });

  describe("delete", () => {
    it("soft deletes the entity and hides it from reads", async () => {
      const store = createDynamoDbStore({ category: "jaypie" });
      await store.put({ alias: "aws", content: "# AWS" });

      await expect(store.delete("aws")).resolves.toBe(true);

      expect(dynamodb.deleteEntity).toHaveBeenCalledWith({
        id: uuidv5("jaypie:aws", { namespace: SKILL_NAMESPACE }),
      });
      await expect(store.get("aws")).resolves.toBeNull();
      await expect(store.list()).resolves.toEqual([]);
    });

    it("returns false when absent or already deleted", async () => {
      const store = createDynamoDbStore({ category: "jaypie" });
      await expect(store.delete("aws")).resolves.toBe(false);
      await store.put({ alias: "aws", content: "# AWS" });
      await store.delete("aws");
      await expect(store.delete("aws")).resolves.toBe(false);
      expect(dynamodb.deleteEntity).toHaveBeenCalledTimes(1);
    });
  });

  describe("syncSkills from markdown", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tildeskill-sync-"));
      await fs.writeFile(
        path.join(tempDir, "aws.md"),
        "---\ndescription: AWS guide\nincludes: base\ntags: cloud\n---\n# AWS",
      );
      await fs.writeFile(path.join(tempDir, "base.md"), "Base content");
      await fs.writeFile(
        path.join(tempDir, "skill.md"),
        "---\ndescription: Skills\n---\n# Skill",
      );
    });

    afterEach(async () => {
      await fs.rm(tempDir, { force: true, recursive: true });
    });

    it("serves the same index and content as the markdown store", async () => {
      const markdown = createMarkdownStore({ path: tempDir });
      const store = createDynamoDbStore({ category: "jaypie" });

      const first = await syncSkills({ from: markdown, to: store });
      expect(first).toEqual({
        added: ["aws", "base", "skill"],
        removed: [],
        unchanged: [],
        updated: [],
      });

      const fromService = createSkillService(markdown);
      const toService = createSkillService(store);
      for (const alias of ["index", "aws", "base", "skills"]) {
        expect(await toService({ alias })).toBe(await fromService({ alias }));
      }

      await fs.writeFile(path.join(tempDir, "base.md"), "Base content v2");
      await fs.rm(path.join(tempDir, "skill.md"));
      vi.mocked(dynamodb.updateEntity).mockClear();

      const second = await syncSkills({ from: markdown, to: store });
      expect(second).toEqual({
        added: [],
        removed: ["skill"],
        unchanged: ["aws"],
        updated: ["base"],
      });
      expect(dynamodb.updateEntity).toHaveBeenCalledTimes(1);
      expect(await toService({ alias: "index" })).toBe(
        await fromService({ alias: "index" }),
      );
    });
  });
});
