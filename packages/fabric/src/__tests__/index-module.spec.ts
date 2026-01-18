/**
 * Tests for @jaypie/fabric index module
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  APEX,
  ARCHIVED_SUFFIX,
  buildCompositeKey,
  calculateIndexSuffix,
  calculateScope,
  clearRegistry,
  DEFAULT_INDEXES,
  DELETED_SUFFIX,
  generateIndexName,
  getAllRegisteredIndexes,
  getModelIndexes,
  getModelSchema,
  getRegisteredModels,
  isModelRegistered,
  populateIndexKeys,
  registerModel,
  SEPARATOR,
  tryBuildCompositeKey,
} from "../index.js";
import type { IndexDefinition, ModelSchema } from "../index.js";

// =============================================================================
// Constants
// =============================================================================

describe("Index Constants", () => {
  it("exports ARCHIVED_SUFFIX", () => {
    expect(ARCHIVED_SUFFIX).toBe("#archived");
  });

  it("exports DELETED_SUFFIX", () => {
    expect(DELETED_SUFFIX).toBe("#deleted");
  });

  it("exports DEFAULT_INDEXES", () => {
    expect(DEFAULT_INDEXES).toBeInstanceOf(Array);
    expect(DEFAULT_INDEXES).toHaveLength(5);
  });

  it("DEFAULT_INDEXES contains indexScope", () => {
    const indexScope = DEFAULT_INDEXES.find((i) => i.name === "indexScope");
    expect(indexScope).toBeDefined();
    expect(indexScope?.pk).toEqual(["scope", "model"]);
    expect(indexScope?.sk).toEqual(["sequence"]);
  });

  it("DEFAULT_INDEXES contains sparse indexes", () => {
    const sparseIndexes = DEFAULT_INDEXES.filter((i) => i.sparse);
    expect(sparseIndexes).toHaveLength(4); // alias, class, type, xid
  });
});

// =============================================================================
// Key Builders
// =============================================================================

describe("buildCompositeKey", () => {
  it("builds a key from entity fields", () => {
    const entity = { scope: "@", model: "record" };
    const key = buildCompositeKey(entity, ["scope", "model"]);
    expect(key).toBe("@#record");
  });

  it("builds a key with multiple fields", () => {
    const entity = { scope: "@", model: "record", alias: "my-alias" };
    const key = buildCompositeKey(entity, ["scope", "model", "alias"]);
    expect(key).toBe("@#record#my-alias");
  });

  it("appends suffix when provided", () => {
    const entity = { scope: "@", model: "record" };
    const key = buildCompositeKey(entity, ["scope", "model"], "#deleted");
    expect(key).toBe("@#record#deleted");
  });

  it("throws when field is missing", () => {
    const entity = { scope: "@" };
    expect(() => buildCompositeKey(entity, ["scope", "model"])).toThrow(
      "Missing field for index key: model",
    );
  });
});

describe("tryBuildCompositeKey", () => {
  it("returns key when all fields present", () => {
    const entity = { scope: "@", model: "record" };
    const key = tryBuildCompositeKey(entity, ["scope", "model"]);
    expect(key).toBe("@#record");
  });

  it("returns undefined when field is missing", () => {
    const entity = { scope: "@" };
    const key = tryBuildCompositeKey(entity, ["scope", "model"]);
    expect(key).toBeUndefined();
  });
});

describe("generateIndexName", () => {
  it("generates name from pk fields", () => {
    expect(generateIndexName(["scope", "model"])).toBe("indexScopeModel");
  });

  it("capitalizes each field", () => {
    expect(generateIndexName(["scope", "model", "alias"])).toBe(
      "indexScopeModelAlias",
    );
  });
});

describe("calculateIndexSuffix", () => {
  it("returns empty string for active entity", () => {
    const entity = { model: "record" };
    expect(calculateIndexSuffix(entity)).toBe("");
  });

  it("returns #archived for archived entity", () => {
    const entity = { model: "record", archivedAt: new Date() };
    expect(calculateIndexSuffix(entity)).toBe("#archived");
  });

  it("returns #deleted for deleted entity", () => {
    const entity = { model: "record", deletedAt: new Date() };
    expect(calculateIndexSuffix(entity)).toBe("#deleted");
  });

  it("returns #archived#deleted for both", () => {
    const entity = {
      model: "record",
      archivedAt: new Date(),
      deletedAt: new Date(),
    };
    expect(calculateIndexSuffix(entity)).toBe("#archived#deleted");
  });
});

describe("calculateScope", () => {
  it("returns APEX when no parent", () => {
    expect(calculateScope()).toBe(APEX);
  });

  it("returns parent scope when parent provided", () => {
    expect(calculateScope({ model: "chat", id: "abc-123" })).toBe(
      "chat#abc-123",
    );
  });
});

describe("populateIndexKeys", () => {
  it("populates index keys on entity", () => {
    const entity = {
      model: "record",
      scope: "@",
      sequence: 12345,
    };
    const indexes: IndexDefinition[] = [
      { name: "indexScope", pk: ["scope", "model"], sk: ["sequence"] },
    ];

    const result = populateIndexKeys(entity, indexes);
    expect(result.indexScope).toBe("@#record");
  });

  it("respects sparse flag - skips when field missing", () => {
    const entity = {
      model: "record",
      scope: "@",
      sequence: 12345,
    };
    const indexes: IndexDefinition[] = [
      {
        name: "indexAlias",
        pk: ["scope", "model", "alias"],
        sk: ["sequence"],
        sparse: true,
      },
    ];

    const result = populateIndexKeys(entity, indexes);
    expect(result.indexAlias).toBeUndefined();
  });

  it("populates sparse index when field present", () => {
    const entity = {
      model: "record",
      scope: "@",
      alias: "my-alias",
      sequence: 12345,
    };
    const indexes: IndexDefinition[] = [
      {
        name: "indexAlias",
        pk: ["scope", "model", "alias"],
        sk: ["sequence"],
        sparse: true,
      },
    ];

    const result = populateIndexKeys(entity, indexes);
    expect(result.indexAlias).toBe("@#record#my-alias");
  });

  it("applies deleted suffix", () => {
    const entity = {
      model: "record",
      scope: "@",
      deletedAt: new Date(),
      sequence: 12345,
    };
    const indexes: IndexDefinition[] = [
      { name: "indexScope", pk: ["scope", "model"], sk: ["sequence"] },
    ];

    const result = populateIndexKeys(entity, indexes);
    expect(result.indexScope).toBe("@#record#deleted");
  });

  it("applies explicit suffix override", () => {
    const entity = {
      model: "record",
      scope: "@",
      sequence: 12345,
    };
    const indexes: IndexDefinition[] = [
      { name: "indexScope", pk: ["scope", "model"], sk: ["sequence"] },
    ];

    const result = populateIndexKeys(entity, indexes, "#custom");
    expect(result.indexScope).toBe("@#record#custom");
  });
});

// =============================================================================
// Registry
// =============================================================================

describe("Model Registry", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("registerModel", () => {
    it("registers a model schema", () => {
      const schema: ModelSchema = {
        model: "message",
        indexes: [{ pk: ["chatId", "model"], sk: ["createdAt"] }],
      };

      registerModel(schema);
      expect(isModelRegistered("message")).toBe(true);
    });
  });

  describe("getModelSchema", () => {
    it("returns undefined for unregistered model", () => {
      expect(getModelSchema("unknown")).toBeUndefined();
    });

    it("returns schema for registered model", () => {
      const schema: ModelSchema = {
        model: "message",
        indexes: [{ pk: ["chatId", "model"], sk: ["createdAt"] }],
      };

      registerModel(schema);
      expect(getModelSchema("message")).toEqual(schema);
    });
  });

  describe("getModelIndexes", () => {
    it("returns DEFAULT_INDEXES for unregistered model", () => {
      const indexes = getModelIndexes("unknown");
      expect(indexes).toEqual(DEFAULT_INDEXES);
    });

    it("returns custom indexes for registered model", () => {
      const customIndexes: IndexDefinition[] = [
        { pk: ["chatId", "model"], sk: ["createdAt"] },
      ];
      registerModel({ model: "message", indexes: customIndexes });

      const indexes = getModelIndexes("message");
      expect(indexes).toEqual(customIndexes);
    });

    it("returns DEFAULT_INDEXES when model has no custom indexes", () => {
      registerModel({ model: "simple" });
      const indexes = getModelIndexes("simple");
      expect(indexes).toEqual(DEFAULT_INDEXES);
    });
  });

  describe("getRegisteredModels", () => {
    it("returns empty array initially", () => {
      expect(getRegisteredModels()).toEqual([]);
    });

    it("returns registered model names", () => {
      registerModel({ model: "chat" });
      registerModel({ model: "message" });

      const models = getRegisteredModels();
      expect(models).toContain("chat");
      expect(models).toContain("message");
    });
  });

  describe("getAllRegisteredIndexes", () => {
    it("returns empty array when no models registered", () => {
      expect(getAllRegisteredIndexes()).toEqual([]);
    });

    it("collects indexes from all registered models", () => {
      registerModel({
        model: "chat",
        indexes: [{ name: "indexChat", pk: ["scope", "model"] }],
      });
      registerModel({
        model: "message",
        indexes: [{ name: "indexMessage", pk: ["chatId", "model"] }],
      });

      const allIndexes = getAllRegisteredIndexes();
      expect(allIndexes).toHaveLength(2);
      expect(allIndexes.find((i) => i.name === "indexChat")).toBeDefined();
      expect(allIndexes.find((i) => i.name === "indexMessage")).toBeDefined();
    });

    it("deduplicates by name", () => {
      registerModel({
        model: "chat",
        indexes: [{ name: "sharedIndex", pk: ["scope", "model"] }],
      });
      registerModel({
        model: "message",
        indexes: [{ name: "sharedIndex", pk: ["scope", "model"] }],
      });

      const allIndexes = getAllRegisteredIndexes();
      expect(allIndexes).toHaveLength(1);
      expect(allIndexes[0].name).toBe("sharedIndex");
    });
  });

  describe("isModelRegistered", () => {
    it("returns false for unregistered model", () => {
      expect(isModelRegistered("unknown")).toBe(false);
    });

    it("returns true for registered model", () => {
      registerModel({ model: "chat" });
      expect(isModelRegistered("chat")).toBe(true);
    });
  });

  describe("clearRegistry", () => {
    it("removes all registered models", () => {
      registerModel({ model: "chat" });
      registerModel({ model: "message" });

      clearRegistry();

      expect(getRegisteredModels()).toEqual([]);
    });
  });
});
