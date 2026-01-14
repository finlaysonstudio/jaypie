/**
 * Tests for Date conversion
 */

import { describe, expect, it } from "vitest";

import {
  convertFromDate,
  convertToDate,
  isDateType,
  isValidDate,
} from "../convert-date.js";

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
// convertToDate
// =============================================================================

describe("convertToDate", () => {
  describe("from Date", () => {
    it("returns valid Date as-is", () => {
      const date = new Date("2026-01-01");
      const result = convertToDate(date);
      expect(result).toBe(date);
    });

    it("throws for invalid Date", () => {
      expect(() => convertToDate(new Date("invalid"))).toThrow("Invalid Date");
    });
  });

  describe("from Number", () => {
    it("converts timestamp to Date", () => {
      const timestamp = 1704067200000; // 2024-01-01T00:00:00.000Z
      const result = convertToDate(timestamp);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(timestamp);
    });

    it("throws for NaN", () => {
      expect(() => convertToDate(NaN)).toThrow("Cannot convert NaN to Date");
    });
  });

  describe("from String", () => {
    it("converts ISO string to Date", () => {
      const result = convertToDate("2026-01-01T00:00:00.000Z");
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });

    it("converts date string to Date", () => {
      const result = convertToDate("2026-01-01");
      expect(result).toBeInstanceOf(Date);
    });

    it("throws for empty string", () => {
      expect(() => convertToDate("")).toThrow("Cannot convert empty string");
    });

    it("throws for whitespace string", () => {
      expect(() => convertToDate("   ")).toThrow("Cannot convert empty string");
    });

    it("throws for invalid date string", () => {
      expect(() => convertToDate("not a date")).toThrow("Cannot convert");
    });
  });

  describe("from Object with value", () => {
    it("unwraps and converts value property", () => {
      const result = convertToDate({ value: "2026-01-01" });
      expect(result).toBeInstanceOf(Date);
    });

    it("handles nested value objects", () => {
      const result = convertToDate({ value: { value: "2026-01-01" } });
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("from Array", () => {
    it("converts single-element array", () => {
      const result = convertToDate(["2026-01-01"]);
      expect(result).toBeInstanceOf(Date);
    });

    it("throws for multi-element array", () => {
      expect(() => convertToDate(["2026-01-01", "2026-01-02"])).toThrow(
        "Cannot convert array with 2 elements",
      );
    });

    it("throws for empty array", () => {
      expect(() => convertToDate([])).toThrow(
        "Cannot convert array with 0 elements",
      );
    });
  });

  describe("from invalid types", () => {
    it("throws for null", () => {
      expect(() => convertToDate(null)).toThrow(
        "Cannot convert null or undefined",
      );
    });

    it("throws for undefined", () => {
      expect(() => convertToDate(undefined)).toThrow(
        "Cannot convert null or undefined",
      );
    });

    it("throws for boolean", () => {
      expect(() => convertToDate(true)).toThrow("Cannot convert boolean to Date");
      expect(() => convertToDate(false)).toThrow(
        "Cannot convert boolean to Date",
      );
    });
  });
});

// =============================================================================
// convertFromDate
// =============================================================================

describe("convertFromDate", () => {
  const testDate = new Date("2026-01-01T12:00:00.000Z");

  describe("to String", () => {
    it("converts to ISO string", () => {
      const result = convertFromDate(testDate, String);
      expect(result).toBe("2026-01-01T12:00:00.000Z");
    });
  });

  describe("to Number", () => {
    it("converts to timestamp", () => {
      const result = convertFromDate(testDate, Number);
      expect(result).toBe(testDate.getTime());
    });
  });

  describe("invalid conversions", () => {
    it("throws for invalid Date", () => {
      expect(() => convertFromDate(new Date("invalid"), String)).toThrow(
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
