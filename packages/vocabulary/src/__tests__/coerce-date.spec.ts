/**
 * Tests for Date coercion
 */

import { describe, expect, it } from "vitest";

import {
  coerceFromDate,
  coerceToDate,
  isDateType,
  isValidDate,
} from "../coerce-date.js";

// =============================================================================
// isValidDate
// =============================================================================

describe("isValidDate", () => {
  it("returns true for valid Date", () => {
    expect(isValidDate(new Date())).toBe(true);
    expect(isValidDate(new Date("2026-01-01"))).toBe(true);
  });

  it("returns false for invalid Date", () => {
    expect(isValidDate(new Date("invalid"))).toBe(false);
  });

  it("returns false for non-Date values", () => {
    expect(isValidDate("2026-01-01")).toBe(false);
    expect(isValidDate(1234567890)).toBe(false);
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });
});

// =============================================================================
// coerceToDate
// =============================================================================

describe("coerceToDate", () => {
  describe("from Date", () => {
    it("returns valid Date as-is", () => {
      const date = new Date("2026-01-01");
      const result = coerceToDate(date);
      expect(result).toBe(date);
    });

    it("throws for invalid Date", () => {
      expect(() => coerceToDate(new Date("invalid"))).toThrow("Invalid Date");
    });
  });

  describe("from Number", () => {
    it("coerces timestamp to Date", () => {
      const timestamp = 1704067200000; // 2024-01-01T00:00:00.000Z
      const result = coerceToDate(timestamp);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(timestamp);
    });

    it("throws for NaN", () => {
      expect(() => coerceToDate(NaN)).toThrow("Cannot coerce NaN to Date");
    });
  });

  describe("from String", () => {
    it("coerces ISO string to Date", () => {
      const result = coerceToDate("2026-01-01T00:00:00.000Z");
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });

    it("coerces date string to Date", () => {
      const result = coerceToDate("2026-01-01");
      expect(result).toBeInstanceOf(Date);
    });

    it("throws for empty string", () => {
      expect(() => coerceToDate("")).toThrow("Cannot coerce empty string");
    });

    it("throws for whitespace string", () => {
      expect(() => coerceToDate("   ")).toThrow("Cannot coerce empty string");
    });

    it("throws for invalid date string", () => {
      expect(() => coerceToDate("not a date")).toThrow("Cannot coerce");
    });
  });

  describe("from Object with value", () => {
    it("unwraps and coerces value property", () => {
      const result = coerceToDate({ value: "2026-01-01" });
      expect(result).toBeInstanceOf(Date);
    });

    it("handles nested value objects", () => {
      const result = coerceToDate({ value: { value: "2026-01-01" } });
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("from Array", () => {
    it("coerces single-element array", () => {
      const result = coerceToDate(["2026-01-01"]);
      expect(result).toBeInstanceOf(Date);
    });

    it("throws for multi-element array", () => {
      expect(() => coerceToDate(["2026-01-01", "2026-01-02"])).toThrow(
        "Cannot coerce array with 2 elements",
      );
    });

    it("throws for empty array", () => {
      expect(() => coerceToDate([])).toThrow(
        "Cannot coerce array with 0 elements",
      );
    });
  });

  describe("from invalid types", () => {
    it("throws for null", () => {
      expect(() => coerceToDate(null)).toThrow(
        "Cannot coerce null or undefined",
      );
    });

    it("throws for undefined", () => {
      expect(() => coerceToDate(undefined)).toThrow(
        "Cannot coerce null or undefined",
      );
    });

    it("throws for boolean", () => {
      expect(() => coerceToDate(true)).toThrow("Cannot coerce boolean to Date");
      expect(() => coerceToDate(false)).toThrow(
        "Cannot coerce boolean to Date",
      );
    });
  });
});

// =============================================================================
// coerceFromDate
// =============================================================================

describe("coerceFromDate", () => {
  const testDate = new Date("2026-01-01T12:00:00.000Z");

  describe("to String", () => {
    it("converts to ISO string", () => {
      const result = coerceFromDate(testDate, String);
      expect(result).toBe("2026-01-01T12:00:00.000Z");
    });
  });

  describe("to Number", () => {
    it("converts to timestamp", () => {
      const result = coerceFromDate(testDate, Number);
      expect(result).toBe(testDate.getTime());
    });
  });

  describe("invalid conversions", () => {
    it("throws for invalid Date", () => {
      expect(() => coerceFromDate(new Date("invalid"), String)).toThrow(
        "Invalid Date",
      );
    });
  });
});

// =============================================================================
// isDateType
// =============================================================================

describe("isDateType", () => {
  it("returns true for Date constructor", () => {
    expect(isDateType(Date)).toBe(true);
  });

  it("returns false for other types", () => {
    expect(isDateType(String)).toBe(false);
    expect(isDateType(Number)).toBe(false);
    expect(isDateType(Boolean)).toBe(false);
    expect(isDateType(Array)).toBe(false);
    expect(isDateType(Object)).toBe(false);
  });

  it("returns false for Date instances", () => {
    expect(isDateType(new Date())).toBe(false);
  });
});
