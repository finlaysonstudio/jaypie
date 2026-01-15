import { describe, expect, it } from "vitest";

import { APEX } from "../constants.js";
import {
  buildIndexAlias,
  buildIndexClass,
  buildIndexScope,
  buildIndexType,
  buildIndexXid,
  calculateScope,
  indexEntity,
} from "../keyBuilders.js";
import type { StorableEntity } from "../types.js";

describe("Key Builders", () => {
  describe("buildIndexScope", () => {
    it("is a function", () => {
      expect(buildIndexScope).toBeFunction();
    });

    it("builds key from scope and model", () => {
      const result = buildIndexScope("@", "record");
      expect(result).toBe("@#record");
    });

    it("works with hierarchical scope", () => {
      const result = buildIndexScope("chat#abc-123", "message");
      expect(result).toBe("chat#abc-123#message");
    });
  });

  describe("buildIndexAlias", () => {
    it("is a function", () => {
      expect(buildIndexAlias).toBeFunction();
    });

    it("builds key from scope, model, and alias", () => {
      const result = buildIndexAlias("@", "record", "2026-01-07");
      expect(result).toBe("@#record#2026-01-07");
    });

    it("works with hierarchical scope", () => {
      const result = buildIndexAlias(
        "chat#abc-123",
        "message",
        "first-message",
      );
      expect(result).toBe("chat#abc-123#message#first-message");
    });
  });

  describe("buildIndexClass", () => {
    it("is a function", () => {
      expect(buildIndexClass).toBeFunction();
    });

    it("builds key from scope, model, and class", () => {
      const result = buildIndexClass("@", "record", "memory");
      expect(result).toBe("@#record#memory");
    });
  });

  describe("buildIndexType", () => {
    it("is a function", () => {
      expect(buildIndexType).toBeFunction();
    });

    it("builds key from scope, model, and type", () => {
      const result = buildIndexType("@", "record", "note");
      expect(result).toBe("@#record#note");
    });
  });

  describe("buildIndexXid", () => {
    it("is a function", () => {
      expect(buildIndexXid).toBeFunction();
    });

    it("builds key from scope, model, and xid", () => {
      const result = buildIndexXid("@", "record", "ext-12345");
      expect(result).toBe("@#record#ext-12345");
    });
  });
});

describe("calculateScope", () => {
  it("is a function", () => {
    expect(calculateScope).toBeFunction();
  });

  it("returns APEX when no parent provided", () => {
    const result = calculateScope();
    expect(result).toBe(APEX);
  });

  it("returns APEX when undefined parent provided", () => {
    const result = calculateScope(undefined);
    expect(result).toBe(APEX);
  });

  it("returns composite key when parent provided", () => {
    const result = calculateScope({ model: "chat", id: "abc-123" });
    expect(result).toBe("chat#abc-123");
  });
});

describe("indexEntity", () => {
  const now = new Date().toISOString();

  const createBaseEntity = (): StorableEntity => ({
    createdAt: now,
    id: "test-id-123",
    model: "record",
    name: "Test Record",
    scope: APEX,
    sequence: Date.now(),
    updatedAt: now,
  });

  it("is a function", () => {
    expect(indexEntity).toBeFunction();
  });

  it("always populates indexScope", () => {
    const entity = createBaseEntity();
    const result = indexEntity(entity);
    expect(result.indexScope).toBe("@#record");
  });

  it("does not modify other properties", () => {
    const entity = createBaseEntity();
    const result = indexEntity(entity);
    expect(result.id).toBe(entity.id);
    expect(result.model).toBe(entity.model);
    expect(result.name).toBe(entity.name);
    expect(result.scope).toBe(entity.scope);
  });

  it("populates indexAlias when alias is present", () => {
    const entity = { ...createBaseEntity(), alias: "my-alias" };
    const result = indexEntity(entity);
    expect(result.indexAlias).toBe("@#record#my-alias");
  });

  it("does not populate indexAlias when alias is missing", () => {
    const entity = createBaseEntity();
    const result = indexEntity(entity);
    expect(result.indexAlias).toBeUndefined();
  });

  it("populates indexClass when class is present", () => {
    const entity = { ...createBaseEntity(), class: "memory" };
    const result = indexEntity(entity);
    expect(result.indexClass).toBe("@#record#memory");
  });

  it("does not populate indexClass when class is missing", () => {
    const entity = createBaseEntity();
    const result = indexEntity(entity);
    expect(result.indexClass).toBeUndefined();
  });

  it("populates indexType when type is present", () => {
    const entity = { ...createBaseEntity(), type: "note" };
    const result = indexEntity(entity);
    expect(result.indexType).toBe("@#record#note");
  });

  it("does not populate indexType when type is missing", () => {
    const entity = createBaseEntity();
    const result = indexEntity(entity);
    expect(result.indexType).toBeUndefined();
  });

  it("populates indexXid when xid is present", () => {
    const entity = { ...createBaseEntity(), xid: "ext-12345" };
    const result = indexEntity(entity);
    expect(result.indexXid).toBe("@#record#ext-12345");
  });

  it("does not populate indexXid when xid is missing", () => {
    const entity = createBaseEntity();
    const result = indexEntity(entity);
    expect(result.indexXid).toBeUndefined();
  });

  it("populates all indexes when all optional fields are present", () => {
    const entity = {
      ...createBaseEntity(),
      alias: "my-alias",
      class: "memory",
      type: "note",
      xid: "ext-12345",
    };
    const result = indexEntity(entity);
    expect(result.indexScope).toBe("@#record");
    expect(result.indexAlias).toBe("@#record#my-alias");
    expect(result.indexClass).toBe("@#record#memory");
    expect(result.indexType).toBe("@#record#note");
    expect(result.indexXid).toBe("@#record#ext-12345");
  });

  it("works with hierarchical scope", () => {
    const entity = {
      ...createBaseEntity(),
      alias: "first-message",
      model: "message",
      scope: "chat#abc-123",
    };
    const result = indexEntity(entity);
    expect(result.indexScope).toBe("chat#abc-123#message");
    expect(result.indexAlias).toBe("chat#abc-123#message#first-message");
  });

  describe("suffix parameter", () => {
    it("appends suffix to indexScope", () => {
      const entity = createBaseEntity();
      const result = indexEntity(entity, "#deleted");
      expect(result.indexScope).toBe("@#record#deleted");
    });

    it("appends suffix to all present index keys", () => {
      const entity = {
        ...createBaseEntity(),
        alias: "my-alias",
        class: "memory",
      };
      const result = indexEntity(entity, "#archived");
      expect(result.indexScope).toBe("@#record#archived");
      expect(result.indexAlias).toBe("@#record#my-alias#archived");
      expect(result.indexClass).toBe("@#record#memory#archived");
    });

    it("defaults to empty string (no suffix)", () => {
      const entity = createBaseEntity();
      const result = indexEntity(entity);
      expect(result.indexScope).toBe("@#record");
      expect(result.indexScope).not.toContain("#deleted");
      expect(result.indexScope).not.toContain("#archived");
    });
  });
});
