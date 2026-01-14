import { describe, expect, it } from "vitest";

import {
  APEX,
  computeResolvedName,
  ELEMENTARY_TYPE_REGISTRY,
  ELEMENTARY_TYPES,
  FIELD_CATEGORIES,
  getAllElementaryTypes,
  getElementaryType,
  isElementaryType,
  isFieldCategory,
  isFieldDefinition,
  resolveWithFallback,
  SEPARATOR,
  SYSTEM_MODELS,
} from "../index.js";

// =============================================================================
// Constants
// =============================================================================

describe("Constants", () => {
  describe("APEX", () => {
    it("is '@'", () => {
      expect(APEX).toBe("@");
    });
  });

  describe("SEPARATOR", () => {
    it("is '#'", () => {
      expect(SEPARATOR).toBe("#");
    });
  });

  describe("SYSTEM_MODELS", () => {
    it("contains context, field, and model", () => {
      expect(SYSTEM_MODELS).toContain("context");
      expect(SYSTEM_MODELS).toContain("field");
      expect(SYSTEM_MODELS).toContain("model");
    });

    it("has exactly 3 elements", () => {
      expect(SYSTEM_MODELS).toHaveLength(3);
    });
  });
});

// =============================================================================
// Field Categories
// =============================================================================

describe("Field Categories", () => {
  describe("FIELD_CATEGORIES", () => {
    it("contains all four categories", () => {
      expect(FIELD_CATEGORIES).toContain("identity");
      expect(FIELD_CATEGORIES).toContain("input");
      expect(FIELD_CATEGORIES).toContain("metadata");
      expect(FIELD_CATEGORIES).toContain("state");
    });

    it("has exactly 4 elements", () => {
      expect(FIELD_CATEGORIES).toHaveLength(4);
    });
  });

  describe("isFieldCategory", () => {
    it("returns true for valid categories", () => {
      expect(isFieldCategory("identity")).toBe(true);
      expect(isFieldCategory("input")).toBe(true);
      expect(isFieldCategory("metadata")).toBe(true);
      expect(isFieldCategory("state")).toBe(true);
    });

    it("returns false for invalid categories", () => {
      expect(isFieldCategory("invalid")).toBe(false);
      expect(isFieldCategory("")).toBe(false);
      expect(isFieldCategory(null)).toBe(false);
      expect(isFieldCategory(undefined)).toBe(false);
      expect(isFieldCategory(123)).toBe(false);
      expect(isFieldCategory({})).toBe(false);
    });
  });
});

// =============================================================================
// Field Definitions
// =============================================================================

describe("Field Definitions", () => {
  describe("isFieldDefinition", () => {
    it("returns true for valid field definitions", () => {
      const def = { alias: "test", name: "Test", type: "text" };
      expect(isFieldDefinition(def)).toBe(true);
    });

    it("returns true for definitions with optional fields", () => {
      const def = {
        alias: "test",
        category: "state" as const,
        description: "A test field",
        name: "Test",
        type: "text",
      };
      expect(isFieldDefinition(def)).toBe(true);
    });

    it("returns false for strings (alias references)", () => {
      expect(isFieldDefinition("test")).toBe(false);
    });

    it("returns false for incomplete objects", () => {
      expect(isFieldDefinition({ alias: "test" })).toBe(false);
      expect(isFieldDefinition({ type: "text" })).toBe(false);
      expect(isFieldDefinition({})).toBe(false);
    });
  });
});

// =============================================================================
// Elementary Types
// =============================================================================

describe("Elementary Types", () => {
  describe("ELEMENTARY_TYPES", () => {
    it("contains all 10 elementary types", () => {
      expect(ELEMENTARY_TYPES).toContain("boolean");
      expect(ELEMENTARY_TYPES).toContain("date");
      expect(ELEMENTARY_TYPES).toContain("datetime");
      expect(ELEMENTARY_TYPES).toContain("dollars");
      expect(ELEMENTARY_TYPES).toContain("multiselect");
      expect(ELEMENTARY_TYPES).toContain("number");
      expect(ELEMENTARY_TYPES).toContain("reference");
      expect(ELEMENTARY_TYPES).toContain("select");
      expect(ELEMENTARY_TYPES).toContain("text");
      expect(ELEMENTARY_TYPES).toContain("textarea");
    });

    it("has exactly 10 elements", () => {
      expect(ELEMENTARY_TYPES).toHaveLength(10);
    });
  });

  describe("isElementaryType", () => {
    it("returns true for valid elementary types", () => {
      for (const type of ELEMENTARY_TYPES) {
        expect(isElementaryType(type)).toBe(true);
      }
    });

    it("returns false for invalid types", () => {
      expect(isElementaryType("invalid")).toBe(false);
      expect(isElementaryType("")).toBe(false);
      expect(isElementaryType(null)).toBe(false);
      expect(isElementaryType(undefined)).toBe(false);
      expect(isElementaryType(123)).toBe(false);
    });
  });

  describe("ELEMENTARY_TYPE_REGISTRY", () => {
    it("contains all elementary types", () => {
      for (const type of ELEMENTARY_TYPES) {
        expect(ELEMENTARY_TYPE_REGISTRY[type]).toBeDefined();
        expect(ELEMENTARY_TYPE_REGISTRY[type].alias).toBe(type);
      }
    });

    it("each type has required fields", () => {
      for (const def of Object.values(ELEMENTARY_TYPE_REGISTRY)) {
        expect(def.alias).toBeDefined();
        expect(def.name).toBeDefined();
        expect(def.type).toBeDefined();
      }
    });
  });

  describe("getElementaryType", () => {
    it("returns the correct type definition", () => {
      const textType = getElementaryType("text");
      expect(textType.alias).toBe("text");
      expect(textType.name).toBe("Text");

      const numberType = getElementaryType("number");
      expect(numberType.alias).toBe("number");
      expect(numberType.name).toBe("Number");
    });
  });

  describe("getAllElementaryTypes", () => {
    it("returns all elementary type definitions", () => {
      const types = getAllElementaryTypes();
      expect(types).toHaveLength(10);
      expect(types.every((t) => t.alias && t.name && t.type)).toBe(true);
    });
  });
});

// =============================================================================
// Helpers
// =============================================================================

describe("Helpers", () => {
  describe("computeResolvedName", () => {
    it("returns name (lowercase) when present", () => {
      expect(computeResolvedName({ name: "Test Name" })).toBe("test name");
    });

    it("falls back to alias when name is missing", () => {
      expect(computeResolvedName({ alias: "TestAlias" })).toBe("testalias");
    });

    it("falls back to abbreviation when name and alias are missing", () => {
      expect(computeResolvedName({ abbreviation: "TN" })).toBe("tn");
    });

    it("falls back to description when other fields are missing", () => {
      expect(computeResolvedName({ description: "A Test" })).toBe("a test");
    });

    it("respects priority order", () => {
      expect(
        computeResolvedName({
          abbreviation: "TN",
          alias: "TestAlias",
          description: "A Test",
          name: "Test Name",
        }),
      ).toBe("test name");

      expect(
        computeResolvedName({
          abbreviation: "TN",
          alias: "TestAlias",
          description: "A Test",
        }),
      ).toBe("testalias");

      expect(
        computeResolvedName({
          abbreviation: "TN",
          description: "A Test",
        }),
      ).toBe("tn");
    });

    it("returns undefined when no fields are present", () => {
      expect(computeResolvedName({})).toBeUndefined();
    });

    it("returns undefined when all fields are undefined", () => {
      expect(
        computeResolvedName({
          abbreviation: undefined,
          alias: undefined,
          description: undefined,
          name: undefined,
        }),
      ).toBeUndefined();
    });
  });

  describe("resolveWithFallback", () => {
    it("returns the primary field value when present", () => {
      const entity = { primary: "value", fallback1: "other" };
      expect(resolveWithFallback(entity, "primary", ["fallback1"])).toBe(
        "value",
      );
    });

    it("returns first fallback when primary is undefined", () => {
      const entity = { fallback1: "first", fallback2: "second" };
      expect(
        resolveWithFallback(entity, "primary", ["fallback1", "fallback2"]),
      ).toBe("first");
    });

    it("returns second fallback when primary and first are undefined", () => {
      const entity = { fallback2: "second" };
      expect(
        resolveWithFallback(entity, "primary", ["fallback1", "fallback2"]),
      ).toBe("second");
    });

    it("returns undefined when no fields are found", () => {
      const entity = {};
      expect(
        resolveWithFallback(entity, "primary", ["fallback1", "fallback2"]),
      ).toBeUndefined();
    });

    it("works with empty fallbacks array", () => {
      const entity = { primary: "value" };
      expect(resolveWithFallback(entity, "primary", [])).toBe("value");
    });

    it("works with no fallbacks argument", () => {
      const entity = { primary: "value" };
      expect(resolveWithFallback(entity, "primary")).toBe("value");
    });

    it("returns null values (not undefined)", () => {
      const entity = { primary: null };
      expect(resolveWithFallback(entity, "primary", ["fallback"])).toBe(null);
    });

    it("returns falsy values except undefined", () => {
      expect(resolveWithFallback({ primary: 0 }, "primary", [])).toBe(0);
      expect(resolveWithFallback({ primary: "" }, "primary", [])).toBe("");
      expect(resolveWithFallback({ primary: false }, "primary", [])).toBe(
        false,
      );
    });
  });
});
