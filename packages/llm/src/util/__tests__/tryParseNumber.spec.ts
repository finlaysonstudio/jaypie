import { describe, expect, it, vi } from "vitest";
import { tryParseNumber } from "../tryParseNumber";

describe("tryParseNumber", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(typeof tryParseNumber).toBe("function");
    });

    it("works", () => {
      expect(tryParseNumber("123")).not.toBeUndefined();
    });
  });

  describe("Error Conditions", () => {
    it("returns the original input when parsing fails", () => {
      const input = "not a number";
      expect(tryParseNumber(input)).toBe(input);
    });

    it("returns null when input is null", () => {
      expect(tryParseNumber(null)).toBe(null);
    });

    it("returns undefined when input is undefined", () => {
      expect(tryParseNumber(undefined)).toBe(undefined);
    });
  });

  describe("Happy Paths", () => {
    it("parses integer string to number", () => {
      expect(tryParseNumber("123")).toBe(123);
    });

    it("parses float string to number", () => {
      expect(tryParseNumber("123.45")).toBe(123.45);
    });

    it("parses negative number string to number", () => {
      expect(tryParseNumber("-123")).toBe(-123);
    });

    it("returns number when input is already a number", () => {
      expect(tryParseNumber(123)).toBe(123);
    });
  });

  describe("Features", () => {
    it("uses defaultValue when specified and parsing fails", () => {
      expect(tryParseNumber("not a number", { defaultValue: 42 })).toBe(42);
      expect(tryParseNumber(null, { defaultValue: 42 })).toBe(null);
      expect(tryParseNumber(undefined, { defaultValue: 42 })).toBe(undefined);
    });

    it("calls warnFunction when specified and parsing fails", () => {
      const mockWarn = vi.fn();
      tryParseNumber("not a number", { warnFunction: mockWarn });
      expect(mockWarn).toHaveBeenCalledWith(
        'Failed to parse "not a number" as number',
      );
    });

    it("uses defaultValue and calls warnFunction together", () => {
      const mockWarn = vi.fn();
      const result = tryParseNumber("not a number", {
        defaultValue: 42,
        warnFunction: mockWarn,
      });
      expect(result).toBe(42);
      expect(mockWarn).toHaveBeenCalled();
    });

    it("handles warnFunction that throws an error", () => {
      const throwingWarnFn = vi.fn().mockImplementation(() => {
        throw new Error("Error in warnFunction");
      });

      // This should not throw despite the warnFunction throwing
      const result = tryParseNumber("not a number", {
        defaultValue: 42,
        warnFunction: throwingWarnFn,
      });

      // The function should complete and return the expected value
      expect(result).toBe(42);
      // The throwing function should have been called
      expect(throwingWarnFn).toHaveBeenCalled();
    });
  });

  describe("Specific Scenarios", () => {
    it("returns original input for NaN result", () => {
      expect(tryParseNumber("abc123")).toBe("abc123");
    });

    it("handles boolean values", () => {
      expect(tryParseNumber(true)).toBe(1);
      expect(tryParseNumber(false)).toBe(0);
    });

    it("handles empty string", () => {
      expect(tryParseNumber("")).toBe(0);
    });

    it("handles objects", () => {
      const obj: Record<string, string> = { test: "value" };
      expect(tryParseNumber(obj)).toBe(obj);
    });

    it("handles arrays", () => {
      const emptyArray: unknown[] = [];
      expect(tryParseNumber(emptyArray)).toBe(0);

      const numArray: number[] = [1, 2, 3];
      expect(tryParseNumber(numArray)).toBe(numArray);
    });
  });
});
