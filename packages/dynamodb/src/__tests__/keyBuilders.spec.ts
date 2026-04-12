import { beforeAll, describe, expect, it } from "vitest";
import { clearRegistry, fabricIndex, registerModel } from "@jaypie/fabric";

import { APEX } from "../constants.js";
import {
  buildCompositeKey,
  calculateScope,
  indexEntity,
} from "../keyBuilders.js";
import type { StorableEntity } from "../types.js";

beforeAll(() => {
  clearRegistry();
  registerModel({
    model: "record",
    indexes: [
      fabricIndex(),
      fabricIndex("alias"),
      fabricIndex("category"),
      fabricIndex("type"),
      fabricIndex("xid"),
    ],
  });
  registerModel({
    model: "message",
    indexes: [fabricIndex(), fabricIndex("alias")],
  });
});

describe("buildCompositeKey", () => {
  it("joins entity fields with the separator", () => {
    const result = buildCompositeKey(
      { model: "record", alias: "my-alias" },
      ["model", "alias"],
    );
    expect(result).toBe("record#my-alias");
  });

  it("appends a suffix when provided", () => {
    const result = buildCompositeKey(
      { model: "record" },
      ["model"],
      "#deleted",
    );
    expect(result).toBe("record#deleted");
  });
});

describe("calculateScope", () => {
  it("returns APEX when no parent provided", () => {
    expect(calculateScope()).toBe(APEX);
  });

  it("returns APEX when undefined parent provided", () => {
    expect(calculateScope(undefined)).toBe(APEX);
  });

  it("returns composite key when parent provided", () => {
    expect(calculateScope({ model: "chat", id: "abc-123" })).toBe(
      "chat#abc-123",
    );
  });
});

describe("indexEntity", () => {
  const createBaseEntity = (): StorableEntity =>
    ({
      id: "test-id-123",
      model: "record",
      name: "Test Record",
      scope: APEX,
    }) as StorableEntity;

  it("auto-bumps updatedAt on every call", () => {
    const entity = createBaseEntity();
    const before = Date.now();
    const result = indexEntity(entity);
    const after = Date.now();
    expect(result.updatedAt).toBeDefined();
    const ts = new Date(result.updatedAt as string).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("backfills createdAt when missing", () => {
    const entity = createBaseEntity();
    const result = indexEntity(entity);
    expect(result.createdAt).toBeDefined();
    // When both created and updated are backfilled to the same now, they match
    expect(result.createdAt).toBe(result.updatedAt);
  });

  it("preserves an existing createdAt", () => {
    const entity = {
      ...createBaseEntity(),
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const result = indexEntity(entity);
    expect(result.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
  });

  it("populates indexModel on every entity", () => {
    const entity = createBaseEntity();
    const result = indexEntity(entity) as StorableEntity & {
      indexModel?: string;
      indexModelSk?: string;
    };
    expect(result.indexModel).toBe("record");
  });

  it("writes a composite sk attribute scope#updatedAt", () => {
    const entity = createBaseEntity();
    const result = indexEntity(entity) as StorableEntity & {
      indexModelSk?: string;
    };
    expect(result.indexModelSk).toBe(`@#${result.updatedAt}`);
  });

  it("populates indexModelAlias when alias is present (sparse)", () => {
    const entity = { ...createBaseEntity(), alias: "my-alias" };
    const result = indexEntity(entity) as StorableEntity & {
      indexModelAlias?: string;
      indexModelAliasSk?: string;
    };
    expect(result.indexModelAlias).toBe("record#my-alias");
    expect(result.indexModelAliasSk).toBe(`@#${result.updatedAt}`);
  });

  it("skips indexModelAlias when alias is missing", () => {
    const entity = createBaseEntity();
    const result = indexEntity(entity) as StorableEntity & {
      indexModelAlias?: string;
    };
    expect(result.indexModelAlias).toBeUndefined();
  });

  it("populates indexModelCategory, Type, Xid when fields present", () => {
    const entity = {
      ...createBaseEntity(),
      category: "memory",
      type: "note",
      xid: "ext-123",
    };
    const result = indexEntity(entity) as StorableEntity & {
      indexModelCategory?: string;
      indexModelType?: string;
      indexModelXid?: string;
    };
    expect(result.indexModelCategory).toBe("record#memory");
    expect(result.indexModelType).toBe("record#note");
    expect(result.indexModelXid).toBe("record#ext-123");
  });

  it("works with hierarchical scope (sk prefix carries scope)", () => {
    const entity = {
      ...createBaseEntity(),
      alias: "first-message",
      model: "message",
      scope: "chat#abc-123",
    };
    const result = indexEntity(entity) as StorableEntity & {
      indexModel?: string;
      indexModelAlias?: string;
      indexModelAliasSk?: string;
    };
    expect(result.indexModel).toBe("message");
    expect(result.indexModelAlias).toBe("message#first-message");
    expect(result.indexModelAliasSk).toBe(
      `chat#abc-123#${result.updatedAt}`,
    );
  });

  describe("suffix on pk", () => {
    it("deleted suffix appended to indexModel pk", () => {
      const entity = createBaseEntity();
      const result = indexEntity(entity, "#deleted") as StorableEntity & {
        indexModel?: string;
        indexModelSk?: string;
      };
      expect(result.indexModel).toBe("record#deleted");
      // sk carries no suffix
      expect(result.indexModelSk).toBe(`@#${result.updatedAt}`);
    });

    it("archived suffix applied automatically from archivedAt", () => {
      const entity = {
        ...createBaseEntity(),
        archivedAt: "2026-01-01T00:00:00.000Z",
      };
      const result = indexEntity(entity) as StorableEntity & {
        indexModel?: string;
      };
      expect(result.indexModel).toBe("record#archived");
    });

    it("combined archived#deleted suffix", () => {
      const entity = {
        ...createBaseEntity(),
        alias: "my-alias",
        archivedAt: "2026-01-01T00:00:00.000Z",
        deletedAt: "2026-01-02T00:00:00.000Z",
      };
      const result = indexEntity(entity) as StorableEntity & {
        indexModel?: string;
        indexModelAlias?: string;
      };
      expect(result.indexModel).toBe("record#archived#deleted");
      expect(result.indexModelAlias).toBe("record#my-alias#archived#deleted");
    });
  });
});
