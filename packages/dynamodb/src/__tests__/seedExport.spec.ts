import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as entitiesModule from "../entities.js";
import * as queriesModule from "../queries.js";
import {
  exportEntities,
  exportEntitiesToJson,
  seedEntities,
  seedEntityIfNotExists,
} from "../seedExport.js";
import type { StorableEntity } from "../types.js";

// Mock the modules
vi.mock("../entities.js", async () => {
  const actual = await vi.importActual("../entities.js");
  return {
    ...actual,
    putEntity: vi.fn(),
  };
});

vi.mock("../queries.js", async () => {
  const actual = await vi.importActual("../queries.js");
  return {
    ...actual,
    queryByAlias: vi.fn(),
    queryByOu: vi.fn(),
  };
});

describe("Seed and Export Utilities", () => {
  const now = new Date().toISOString();

  const createTestEntity = (
    overrides: Partial<StorableEntity> = {},
  ): StorableEntity => ({
    alias: "test-alias",
    createdAt: now,
    id: "test-id-123",
    model: "record",
    name: "Test Record",
    ou: "@",
    sequence: Date.now(),
    updatedAt: now,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("seedEntityIfNotExists", () => {
    it("is a function", () => {
      expect(seedEntityIfNotExists).toBeFunction();
    });

    it("throws when alias is missing", async () => {
      await expect(
        seedEntityIfNotExists({ model: "record", ou: "@" }),
      ).rejects.toThrow("Entity must have alias, model, and ou");
    });

    it("throws when model is missing", async () => {
      await expect(
        seedEntityIfNotExists({ alias: "test", ou: "@" }),
      ).rejects.toThrow("Entity must have alias, model, and ou");
    });

    it("throws when ou is missing", async () => {
      await expect(
        seedEntityIfNotExists({ alias: "test", model: "record" }),
      ).rejects.toThrow("Entity must have alias, model, and ou");
    });

    it("returns false when entity already exists", async () => {
      vi.mocked(queriesModule.queryByAlias).mockResolvedValueOnce(
        createTestEntity(),
      );
      const result = await seedEntityIfNotExists({
        alias: "test-alias",
        model: "record",
        ou: "@",
      });
      expect(result).toBe(false);
      expect(entitiesModule.putEntity).not.toHaveBeenCalled();
    });

    it("creates entity when it does not exist", async () => {
      vi.mocked(queriesModule.queryByAlias).mockResolvedValueOnce(null);
      vi.mocked(entitiesModule.putEntity).mockResolvedValueOnce(
        createTestEntity(),
      );

      const result = await seedEntityIfNotExists({
        alias: "new-alias",
        model: "record",
        ou: "@",
      });

      expect(result).toBe(true);
      expect(entitiesModule.putEntity).toHaveBeenCalledTimes(1);
    });

    it("auto-generates id when missing", async () => {
      vi.mocked(queriesModule.queryByAlias).mockResolvedValueOnce(null);
      vi.mocked(entitiesModule.putEntity).mockResolvedValueOnce(
        createTestEntity(),
      );

      await seedEntityIfNotExists({
        alias: "new-alias",
        model: "record",
        ou: "@",
      });

      const callArg = vi.mocked(entitiesModule.putEntity).mock.calls[0][0];
      expect(callArg.entity.id).toBeDefined();
      expect(callArg.entity.id.length).toBeGreaterThan(0);
    });

    it("auto-generates createdAt when missing", async () => {
      vi.mocked(queriesModule.queryByAlias).mockResolvedValueOnce(null);
      vi.mocked(entitiesModule.putEntity).mockResolvedValueOnce(
        createTestEntity(),
      );

      await seedEntityIfNotExists({
        alias: "new-alias",
        model: "record",
        ou: "@",
      });

      const callArg = vi.mocked(entitiesModule.putEntity).mock.calls[0][0];
      expect(callArg.entity.createdAt).toBeDefined();
    });

    it("uses name from alias when name is missing", async () => {
      vi.mocked(queriesModule.queryByAlias).mockResolvedValueOnce(null);
      vi.mocked(entitiesModule.putEntity).mockResolvedValueOnce(
        createTestEntity(),
      );

      await seedEntityIfNotExists({
        alias: "my-alias",
        model: "record",
        ou: "@",
      });

      const callArg = vi.mocked(entitiesModule.putEntity).mock.calls[0][0];
      expect(callArg.entity.name).toBe("my-alias");
    });
  });

  describe("seedEntities", () => {
    it("is a function", () => {
      expect(seedEntities).toBeFunction();
    });

    it("returns empty result for empty array", async () => {
      const result = await seedEntities([]);
      expect(result).toEqual({
        created: [],
        errors: [],
        skipped: [],
      });
    });

    it("creates entities that do not exist", async () => {
      vi.mocked(queriesModule.queryByAlias).mockResolvedValue(null);
      vi.mocked(entitiesModule.putEntity).mockResolvedValue(createTestEntity());

      const result = await seedEntities([
        { alias: "entity-1", model: "record", ou: "@" },
        { alias: "entity-2", model: "record", ou: "@" },
      ]);

      expect(result.created).toEqual(["entity-1", "entity-2"]);
      expect(result.skipped).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(entitiesModule.putEntity).toHaveBeenCalledTimes(2);
    });

    it("skips entities that already exist", async () => {
      vi.mocked(queriesModule.queryByAlias)
        .mockResolvedValueOnce(createTestEntity()) // First exists
        .mockResolvedValueOnce(null); // Second doesn't exist
      vi.mocked(entitiesModule.putEntity).mockResolvedValue(createTestEntity());

      const result = await seedEntities([
        { alias: "existing", model: "record", ou: "@" },
        { alias: "new-one", model: "record", ou: "@" },
      ]);

      expect(result.created).toEqual(["new-one"]);
      expect(result.skipped).toEqual(["existing"]);
      expect(entitiesModule.putEntity).toHaveBeenCalledTimes(1);
    });

    it("replaces entities when replace option is true", async () => {
      const existingEntity = createTestEntity({ id: "existing-id" });
      vi.mocked(queriesModule.queryByAlias).mockResolvedValueOnce(
        existingEntity,
      );
      vi.mocked(entitiesModule.putEntity).mockResolvedValue(createTestEntity());

      const result = await seedEntities(
        [{ alias: "existing", model: "record", ou: "@" }],
        { replace: true },
      );

      expect(result.created).toEqual(["existing"]);
      expect(result.skipped).toEqual([]);
      expect(entitiesModule.putEntity).toHaveBeenCalledTimes(1);

      // Should use the existing ID
      const callArg = vi.mocked(entitiesModule.putEntity).mock.calls[0][0];
      expect(callArg.entity.id).toBe("existing-id");
    });

    it("does not write when dryRun is true", async () => {
      vi.mocked(queriesModule.queryByAlias).mockResolvedValue(null);

      const result = await seedEntities(
        [
          { alias: "entity-1", model: "record", ou: "@" },
          { alias: "entity-2", model: "record", ou: "@" },
        ],
        { dryRun: true },
      );

      expect(result.created).toEqual(["entity-1", "entity-2"]);
      expect(entitiesModule.putEntity).not.toHaveBeenCalled();
    });

    it("records errors for entities missing required fields", async () => {
      const result = await seedEntities([
        { alias: "valid", model: "record", ou: "@" },
        { alias: "invalid", name: "Missing OU" } as Partial<StorableEntity>,
      ]);

      expect(result.errors.length).toBe(1);
      expect(result.errors[0].alias).toBe("invalid");
      expect(result.errors[0].error).toContain("model and ou");
    });

    it("uses name as alias identifier when alias is missing", async () => {
      vi.mocked(queriesModule.queryByAlias).mockResolvedValue(null);
      vi.mocked(entitiesModule.putEntity).mockResolvedValue(createTestEntity());

      const result = await seedEntities([
        { model: "record", name: "Named Entity", ou: "@" },
      ]);

      expect(result.created).toEqual(["Named Entity"]);
    });
  });

  describe("exportEntities", () => {
    it("is a function", () => {
      expect(exportEntities).toBeFunction();
    });

    it("returns empty result when no entities", async () => {
      vi.mocked(queriesModule.queryByOu).mockResolvedValueOnce({
        items: [],
        lastEvaluatedKey: undefined,
      });

      const result = await exportEntities("record", "@");

      expect(result.entities).toEqual([]);
      expect(result.count).toBe(0);
    });

    it("returns all entities", async () => {
      const entities = [
        createTestEntity({ id: "1", sequence: 1 }),
        createTestEntity({ id: "2", sequence: 2 }),
      ];
      vi.mocked(queriesModule.queryByOu).mockResolvedValueOnce({
        items: entities,
        lastEvaluatedKey: undefined,
      });

      const result = await exportEntities("record", "@");

      expect(result.entities).toEqual(entities);
      expect(result.count).toBe(2);
    });

    it("paginates through all results", async () => {
      const page1 = [createTestEntity({ id: "1", sequence: 1 })];
      const page2 = [createTestEntity({ id: "2", sequence: 2 })];

      vi.mocked(queriesModule.queryByOu)
        .mockResolvedValueOnce({
          items: page1,
          lastEvaluatedKey: { id: "1", model: "record" },
        })
        .mockResolvedValueOnce({
          items: page2,
          lastEvaluatedKey: undefined,
        });

      const result = await exportEntities("record", "@");

      expect(result.entities.length).toBe(2);
      expect(result.count).toBe(2);
      expect(queriesModule.queryByOu).toHaveBeenCalledTimes(2);
    });

    it("respects limit parameter", async () => {
      vi.mocked(queriesModule.queryByOu).mockResolvedValueOnce({
        items: [createTestEntity()],
        lastEvaluatedKey: undefined,
      });

      await exportEntities("record", "@", 5);

      expect(queriesModule.queryByOu).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5 }),
      );
    });

    it("stops pagination when limit is reached", async () => {
      const page1 = [
        createTestEntity({ id: "1" }),
        createTestEntity({ id: "2" }),
      ];

      vi.mocked(queriesModule.queryByOu).mockResolvedValueOnce({
        items: page1,
        lastEvaluatedKey: { id: "2", model: "record" },
      });

      const result = await exportEntities("record", "@", 2);

      expect(result.count).toBe(2);
      expect(queriesModule.queryByOu).toHaveBeenCalledTimes(1);
    });

    it("queries with ascending order", async () => {
      vi.mocked(queriesModule.queryByOu).mockResolvedValueOnce({
        items: [],
        lastEvaluatedKey: undefined,
      });

      await exportEntities("record", "@");

      expect(queriesModule.queryByOu).toHaveBeenCalledWith(
        expect.objectContaining({ ascending: true }),
      );
    });
  });

  describe("exportEntitiesToJson", () => {
    it("is a function", () => {
      expect(exportEntitiesToJson).toBeFunction();
    });

    it("returns JSON string", async () => {
      const entities = [createTestEntity({ id: "1" })];
      vi.mocked(queriesModule.queryByOu).mockResolvedValueOnce({
        items: entities,
        lastEvaluatedKey: undefined,
      });

      const result = await exportEntitiesToJson("record", "@");

      expect(typeof result).toBe("string");
      expect(JSON.parse(result)).toEqual(entities);
    });

    it("formats JSON with indentation by default", async () => {
      const entities = [createTestEntity({ id: "1" })];
      vi.mocked(queriesModule.queryByOu).mockResolvedValueOnce({
        items: entities,
        lastEvaluatedKey: undefined,
      });

      const result = await exportEntitiesToJson("record", "@");

      expect(result).toContain("\n");
      expect(result).toContain("  ");
    });

    it("returns compact JSON when pretty is false", async () => {
      const entities = [createTestEntity({ id: "1" })];
      vi.mocked(queriesModule.queryByOu).mockResolvedValueOnce({
        items: entities,
        lastEvaluatedKey: undefined,
      });

      const result = await exportEntitiesToJson("record", "@", false);

      expect(result).not.toContain("\n");
    });

    it("returns empty array JSON when no entities", async () => {
      vi.mocked(queriesModule.queryByOu).mockResolvedValueOnce({
        items: [],
        lastEvaluatedKey: undefined,
      });

      const result = await exportEntitiesToJson("record", "@");

      expect(JSON.parse(result)).toEqual([]);
    });
  });
});
