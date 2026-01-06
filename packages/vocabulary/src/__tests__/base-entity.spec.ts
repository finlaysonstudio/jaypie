/**
 * Tests for BaseEntity types and utilities
 */

import { describe, expect, it } from "vitest";

import {
  BASE_ENTITY_AUTO_FIELDS,
  BASE_ENTITY_FIELDS,
  BASE_ENTITY_REQUIRED_FIELDS,
  BASE_ENTITY_TIMESTAMP_FIELDS,
  createBaseEntityInput,
  hasBaseEntityShape,
  isAutoField,
  isBaseEntity,
  isTimestampField,
  pickBaseEntityFields,
  type BaseEntity,
  type BaseEntityInput,
} from "../base-entity.js";

// =============================================================================
// Test Fixtures
// =============================================================================

const validEntity: BaseEntity = {
  class: "memory",
  content: "Test content",
  createdAt: new Date("2026-01-01"),
  id: "123e4567-e89b-12d3-a456-426614174000",
  model: "record",
  name: "Test Entity",
  updatedAt: new Date("2026-01-01"),
};

const fullEntity: BaseEntity = {
  ...validEntity,
  abbreviation: "T",
  alias: "test-entity",
  archivedAt: null,
  deletedAt: null,
  description: "A test entity",
  emoji: "🧪",
  history: [
    {
      delta: { content: "Old content" },
      timestamp: new Date("2026-01-01"),
    },
  ],
  icon: "flask",
  label: "Test",
  metadata: { key: "value" },
  xid: "external-123",
};

// =============================================================================
// Constants
// =============================================================================

describe("BASE_ENTITY_FIELDS", () => {
  it("contains all expected fields", () => {
    expect(BASE_ENTITY_FIELDS.ID).toBe("id");
    expect(BASE_ENTITY_FIELDS.NAME).toBe("name");
    expect(BASE_ENTITY_FIELDS.MODEL).toBe("model");
    expect(BASE_ENTITY_FIELDS.CLASS).toBe("class");
    expect(BASE_ENTITY_FIELDS.CONTENT).toBe("content");
    expect(BASE_ENTITY_FIELDS.CREATED_AT).toBe("createdAt");
    expect(BASE_ENTITY_FIELDS.UPDATED_AT).toBe("updatedAt");
  });

  it("contains optional identity fields", () => {
    expect(BASE_ENTITY_FIELDS.LABEL).toBe("label");
    expect(BASE_ENTITY_FIELDS.ABBREVIATION).toBe("abbreviation");
    expect(BASE_ENTITY_FIELDS.ALIAS).toBe("alias");
    expect(BASE_ENTITY_FIELDS.XID).toBe("xid");
    expect(BASE_ENTITY_FIELDS.DESCRIPTION).toBe("description");
  });

  it("contains display fields", () => {
    expect(BASE_ENTITY_FIELDS.EMOJI).toBe("emoji");
    expect(BASE_ENTITY_FIELDS.ICON).toBe("icon");
  });

  it("contains lifecycle fields", () => {
    expect(BASE_ENTITY_FIELDS.ARCHIVED_AT).toBe("archivedAt");
    expect(BASE_ENTITY_FIELDS.DELETED_AT).toBe("deletedAt");
    expect(BASE_ENTITY_FIELDS.HISTORY).toBe("history");
  });
});

describe("BASE_ENTITY_REQUIRED_FIELDS", () => {
  it("lists all required fields", () => {
    expect(BASE_ENTITY_REQUIRED_FIELDS).toContain("id");
    expect(BASE_ENTITY_REQUIRED_FIELDS).toContain("name");
    expect(BASE_ENTITY_REQUIRED_FIELDS).toContain("model");
    expect(BASE_ENTITY_REQUIRED_FIELDS).toContain("class");
    expect(BASE_ENTITY_REQUIRED_FIELDS).toContain("content");
    expect(BASE_ENTITY_REQUIRED_FIELDS).toContain("createdAt");
    expect(BASE_ENTITY_REQUIRED_FIELDS).toContain("updatedAt");
  });

  it("does not include optional fields", () => {
    expect(BASE_ENTITY_REQUIRED_FIELDS).not.toContain("label");
    expect(BASE_ENTITY_REQUIRED_FIELDS).not.toContain("alias");
    expect(BASE_ENTITY_REQUIRED_FIELDS).not.toContain("metadata");
  });
});

describe("BASE_ENTITY_AUTO_FIELDS", () => {
  it("lists auto-generated fields", () => {
    expect(BASE_ENTITY_AUTO_FIELDS).toContain("id");
    expect(BASE_ENTITY_AUTO_FIELDS).toContain("createdAt");
    expect(BASE_ENTITY_AUTO_FIELDS).toContain("updatedAt");
    expect(BASE_ENTITY_AUTO_FIELDS).toContain("history");
  });

  it("does not include user-provided fields", () => {
    expect(BASE_ENTITY_AUTO_FIELDS).not.toContain("name");
    expect(BASE_ENTITY_AUTO_FIELDS).not.toContain("content");
  });
});

describe("BASE_ENTITY_TIMESTAMP_FIELDS", () => {
  it("lists all timestamp fields", () => {
    expect(BASE_ENTITY_TIMESTAMP_FIELDS).toContain("createdAt");
    expect(BASE_ENTITY_TIMESTAMP_FIELDS).toContain("updatedAt");
    expect(BASE_ENTITY_TIMESTAMP_FIELDS).toContain("archivedAt");
    expect(BASE_ENTITY_TIMESTAMP_FIELDS).toContain("deletedAt");
  });
});

// =============================================================================
// Type Guards
// =============================================================================

describe("isBaseEntity", () => {
  it("returns true for valid entity", () => {
    expect(isBaseEntity(validEntity)).toBe(true);
  });

  it("returns true for full entity", () => {
    expect(isBaseEntity(fullEntity)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isBaseEntity(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isBaseEntity(undefined)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isBaseEntity("string")).toBe(false);
    expect(isBaseEntity(123)).toBe(false);
  });

  it("returns false for missing required fields", () => {
    expect(isBaseEntity({ id: "123" })).toBe(false);
    expect(isBaseEntity({ ...validEntity, id: undefined })).toBe(false);
    expect(isBaseEntity({ ...validEntity, name: undefined })).toBe(false);
    expect(isBaseEntity({ ...validEntity, model: undefined })).toBe(false);
  });

  it("returns false for wrong field types", () => {
    expect(isBaseEntity({ ...validEntity, id: 123 })).toBe(false);
    expect(isBaseEntity({ ...validEntity, createdAt: "2026-01-01" })).toBe(
      false,
    );
  });
});

describe("hasBaseEntityShape", () => {
  it("returns true for minimal shape", () => {
    expect(hasBaseEntityShape({ id: "123", model: "record" })).toBe(true);
  });

  it("returns true for full entity", () => {
    expect(hasBaseEntityShape(fullEntity)).toBe(true);
  });

  it("returns false for null", () => {
    expect(hasBaseEntityShape(null)).toBe(false);
  });

  it("returns false for missing id", () => {
    expect(hasBaseEntityShape({ model: "record" })).toBe(false);
  });

  it("returns false for missing model", () => {
    expect(hasBaseEntityShape({ id: "123" })).toBe(false);
  });
});

// =============================================================================
// Utility Functions
// =============================================================================

describe("createBaseEntityInput", () => {
  it("creates input with required fields", () => {
    const input = createBaseEntityInput({
      class: "memory",
      content: "Content",
      model: "record",
      name: "Test",
    });

    expect(input.name).toBe("Test");
    expect(input.model).toBe("record");
    expect(input.class).toBe("memory");
    expect(input.content).toBe("Content");
  });

  it("includes optional fields from overrides", () => {
    const input = createBaseEntityInput({
      alias: "test",
      class: "memory",
      content: "Content",
      emoji: "🧪",
      model: "record",
      name: "Test",
    });

    expect(input.alias).toBe("test");
    expect(input.emoji).toBe("🧪");
  });

  it("does not include auto fields", () => {
    const input = createBaseEntityInput({
      class: "memory",
      content: "Content",
      model: "record",
      name: "Test",
    }) as BaseEntityInput & { id?: string };

    expect(input.id).toBeUndefined();
  });
});

describe("pickBaseEntityFields", () => {
  it("extracts only BaseEntity fields", () => {
    const obj = {
      ...fullEntity,
      anotherExtra: 123,
      extraField: "should be removed",
    };

    const result = pickBaseEntityFields(obj);

    expect(result.id).toBe(fullEntity.id);
    expect(result.name).toBe(fullEntity.name);
    expect(result.emoji).toBe(fullEntity.emoji);
    expect((result as Record<string, unknown>).extraField).toBeUndefined();
    expect((result as Record<string, unknown>).anotherExtra).toBeUndefined();
  });

  it("handles partial objects", () => {
    const partial = { id: "123", name: "Test" };
    const result = pickBaseEntityFields(partial as Partial<BaseEntity>);

    expect(result.id).toBe("123");
    expect(result.name).toBe("Test");
    expect(result.model).toBeUndefined();
  });
});

describe("isTimestampField", () => {
  it("returns true for timestamp fields", () => {
    expect(isTimestampField("createdAt")).toBe(true);
    expect(isTimestampField("updatedAt")).toBe(true);
    expect(isTimestampField("archivedAt")).toBe(true);
    expect(isTimestampField("deletedAt")).toBe(true);
  });

  it("returns false for non-timestamp fields", () => {
    expect(isTimestampField("id")).toBe(false);
    expect(isTimestampField("name")).toBe(false);
    expect(isTimestampField("content")).toBe(false);
  });
});

describe("isAutoField", () => {
  it("returns true for auto fields", () => {
    expect(isAutoField("id")).toBe(true);
    expect(isAutoField("createdAt")).toBe(true);
    expect(isAutoField("updatedAt")).toBe(true);
    expect(isAutoField("history")).toBe(true);
  });

  it("returns false for user-provided fields", () => {
    expect(isAutoField("name")).toBe(false);
    expect(isAutoField("content")).toBe(false);
    expect(isAutoField("alias")).toBe(false);
  });
});
