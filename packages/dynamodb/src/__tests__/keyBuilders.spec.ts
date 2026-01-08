import { describe, expect, it } from "vitest";

import { APEX } from "../constants.js";
import {
  buildIndexAlias,
  buildIndexClass,
  buildIndexOu,
  buildIndexType,
  buildIndexXid,
  calculateOu,
  indexEntity,
} from "../keyBuilders.js";
import type { FabricEntity } from "../types.js";

describe("Key Builders", () => {
  describe("buildIndexOu", () => {
    it("is a function", () => {
      expect(buildIndexOu).toBeFunction();
    });

    it("builds key from ou and model", () => {
      const result = buildIndexOu("@", "record");
      expect(result).toBe("@#record");
    });

    it("works with hierarchical ou", () => {
      const result = buildIndexOu("chat#abc-123", "message");
      expect(result).toBe("chat#abc-123#message");
    });
  });

  describe("buildIndexAlias", () => {
    it("is a function", () => {
      expect(buildIndexAlias).toBeFunction();
    });

    it("builds key from ou, model, and alias", () => {
      const result = buildIndexAlias("@", "record", "2026-01-07");
      expect(result).toBe("@#record#2026-01-07");
    });

    it("works with hierarchical ou", () => {
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

    it("builds key from ou, model, and class", () => {
      const result = buildIndexClass("@", "record", "memory");
      expect(result).toBe("@#record#memory");
    });
  });

  describe("buildIndexType", () => {
    it("is a function", () => {
      expect(buildIndexType).toBeFunction();
    });

    it("builds key from ou, model, and type", () => {
      const result = buildIndexType("@", "record", "note");
      expect(result).toBe("@#record#note");
    });
  });

  describe("buildIndexXid", () => {
    it("is a function", () => {
      expect(buildIndexXid).toBeFunction();
    });

    it("builds key from ou, model, and xid", () => {
      const result = buildIndexXid("@", "record", "ext-12345");
      expect(result).toBe("@#record#ext-12345");
    });
  });
});

describe("calculateOu", () => {
  it("is a function", () => {
    expect(calculateOu).toBeFunction();
  });

  it("returns APEX when no parent provided", () => {
    const result = calculateOu();
    expect(result).toBe(APEX);
  });

  it("returns APEX when undefined parent provided", () => {
    const result = calculateOu(undefined);
    expect(result).toBe(APEX);
  });

  it("returns composite key when parent provided", () => {
    const result = calculateOu({ model: "chat", id: "abc-123" });
    expect(result).toBe("chat#abc-123");
  });
});

describe("indexEntity", () => {
  const now = new Date().toISOString();

  const createBaseEntity = (): FabricEntity => ({
    createdAt: now,
    id: "test-id-123",
    model: "record",
    name: "Test Record",
    ou: APEX,
    sequence: Date.now(),
    updatedAt: now,
  });

  it("is a function", () => {
    expect(indexEntity).toBeFunction();
  });

  it("always populates indexOu", () => {
    const entity = createBaseEntity();
    const result = indexEntity(entity);
    expect(result.indexOu).toBe("@#record");
  });

  it("does not modify other properties", () => {
    const entity = createBaseEntity();
    const result = indexEntity(entity);
    expect(result.id).toBe(entity.id);
    expect(result.model).toBe(entity.model);
    expect(result.name).toBe(entity.name);
    expect(result.ou).toBe(entity.ou);
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
    expect(result.indexOu).toBe("@#record");
    expect(result.indexAlias).toBe("@#record#my-alias");
    expect(result.indexClass).toBe("@#record#memory");
    expect(result.indexType).toBe("@#record#note");
    expect(result.indexXid).toBe("@#record#ext-12345");
  });

  it("works with hierarchical ou", () => {
    const entity = {
      ...createBaseEntity(),
      alias: "first-message",
      model: "message",
      ou: "chat#abc-123",
    };
    const result = indexEntity(entity);
    expect(result.indexOu).toBe("chat#abc-123#message");
    expect(result.indexAlias).toBe("chat#abc-123#message#first-message");
  });

  describe("suffix parameter", () => {
    it("appends suffix to indexOu", () => {
      const entity = createBaseEntity();
      const result = indexEntity(entity, "#deleted");
      expect(result.indexOu).toBe("@#record#deleted");
    });

    it("appends suffix to all present index keys", () => {
      const entity = {
        ...createBaseEntity(),
        alias: "my-alias",
        class: "memory",
      };
      const result = indexEntity(entity, "#archived");
      expect(result.indexOu).toBe("@#record#archived");
      expect(result.indexAlias).toBe("@#record#my-alias#archived");
      expect(result.indexClass).toBe("@#record#memory#archived");
    });

    it("defaults to empty string (no suffix)", () => {
      const entity = createBaseEntity();
      const result = indexEntity(entity);
      expect(result.indexOu).toBe("@#record");
      expect(result.indexOu).not.toContain("#deleted");
      expect(result.indexOu).not.toContain("#archived");
    });
  });
});
