import { BadRequestError } from "@jaypie/errors";
import { describe, expect, it } from "vitest";

import {
  coerce,
  coerceFromArray,
  coerceFromObject,
  coerceToArray,
  coerceToBoolean,
  coerceToNumber,
  coerceToObject,
  coerceToString,
} from "..";

describe("coerce", () => {
  describe("coerceToBoolean", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(coerceToBoolean(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(coerceToBoolean(null)).toBeUndefined();
      });

      it("returns undefined for empty string", () => {
        expect(coerceToBoolean("")).toBeUndefined();
      });

      it("passes through boolean true", () => {
        expect(coerceToBoolean(true)).toBe(true);
      });

      it("passes through boolean false", () => {
        expect(coerceToBoolean(false)).toBe(false);
      });

      it('converts string "true" to true', () => {
        expect(coerceToBoolean("true")).toBe(true);
        expect(coerceToBoolean("TRUE")).toBe(true);
        expect(coerceToBoolean("True")).toBe(true);
      });

      it('converts string "false" to false', () => {
        expect(coerceToBoolean("false")).toBe(false);
        expect(coerceToBoolean("FALSE")).toBe(false);
        expect(coerceToBoolean("False")).toBe(false);
      });

      it("converts positive numbers to true", () => {
        expect(coerceToBoolean(1)).toBe(true);
        expect(coerceToBoolean(42)).toBe(true);
        expect(coerceToBoolean(0.1)).toBe(true);
      });

      it("converts zero to false", () => {
        expect(coerceToBoolean(0)).toBe(false);
      });

      it("converts negative numbers to false", () => {
        expect(coerceToBoolean(-1)).toBe(false);
        expect(coerceToBoolean(-42)).toBe(false);
      });

      it("converts numeric strings based on value", () => {
        expect(coerceToBoolean("1")).toBe(true);
        expect(coerceToBoolean("0")).toBe(false);
        expect(coerceToBoolean("-1")).toBe(false);
        expect(coerceToBoolean("42")).toBe(true);
      });
    });

    describe("Error Cases", () => {
      it("throws on non-numeric string", () => {
        expect(() => coerceToBoolean("hello")).toThrow(BadRequestError);
      });

      it("throws on NaN number", () => {
        expect(() => coerceToBoolean(NaN)).toThrow(BadRequestError);
      });

      it("throws on object", () => {
        expect(() => coerceToBoolean({})).toThrow(BadRequestError);
      });

      it("throws on array", () => {
        expect(() => coerceToBoolean([])).toThrow(BadRequestError);
      });
    });
  });

  describe("coerceToNumber", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(coerceToNumber(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(coerceToNumber(null)).toBeUndefined();
      });

      it("returns undefined for empty string", () => {
        expect(coerceToNumber("")).toBeUndefined();
      });

      it("passes through numbers", () => {
        expect(coerceToNumber(42)).toBe(42);
        expect(coerceToNumber(0)).toBe(0);
        expect(coerceToNumber(-42)).toBe(-42);
        expect(coerceToNumber(3.14)).toBe(3.14);
      });

      it("converts boolean true to 1", () => {
        expect(coerceToNumber(true)).toBe(1);
      });

      it("converts boolean false to 0", () => {
        expect(coerceToNumber(false)).toBe(0);
      });

      it('converts string "true" to 1', () => {
        expect(coerceToNumber("true")).toBe(1);
        expect(coerceToNumber("TRUE")).toBe(1);
      });

      it('converts string "false" to 0', () => {
        expect(coerceToNumber("false")).toBe(0);
        expect(coerceToNumber("FALSE")).toBe(0);
      });

      it("parses numeric strings", () => {
        expect(coerceToNumber("42")).toBe(42);
        expect(coerceToNumber("3.14")).toBe(3.14);
        expect(coerceToNumber("-42")).toBe(-42);
      });
    });

    describe("Error Cases", () => {
      it("throws on non-numeric string", () => {
        expect(() => coerceToNumber("hello")).toThrow(BadRequestError);
      });

      it("throws on NaN number", () => {
        expect(() => coerceToNumber(NaN)).toThrow(BadRequestError);
      });

      it("throws on object", () => {
        expect(() => coerceToNumber({})).toThrow(BadRequestError);
      });

      it("throws on array", () => {
        expect(() => coerceToNumber([])).toThrow(BadRequestError);
      });
    });
  });

  describe("coerceToString", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(coerceToString(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(coerceToString(null)).toBeUndefined();
      });

      it("returns undefined for empty string", () => {
        expect(coerceToString("")).toBeUndefined();
      });

      it("passes through strings", () => {
        expect(coerceToString("hello")).toBe("hello");
      });

      it('converts boolean true to "true"', () => {
        expect(coerceToString(true)).toBe("true");
      });

      it('converts boolean false to "false"', () => {
        expect(coerceToString(false)).toBe("false");
      });

      it("converts numbers to strings", () => {
        expect(coerceToString(42)).toBe("42");
        expect(coerceToString(0)).toBe("0");
        expect(coerceToString(-42)).toBe("-42");
        expect(coerceToString(3.14)).toBe("3.14");
      });
    });

    describe("Error Cases", () => {
      it("throws on NaN number", () => {
        expect(() => coerceToString(NaN)).toThrow(BadRequestError);
      });

      it("throws on object", () => {
        expect(() => coerceToString({})).toThrow(BadRequestError);
      });

      it("throws on array", () => {
        expect(() => coerceToString([])).toThrow(BadRequestError);
      });
    });
  });

  describe("coerceToArray", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(coerceToArray(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(coerceToArray(null)).toBeUndefined();
      });

      it("passes through arrays", () => {
        expect(coerceToArray([1, 2, 3])).toEqual([1, 2, 3]);
        expect(coerceToArray([])).toEqual([]);
        expect(coerceToArray(["a"])).toEqual(["a"]);
      });

      it("wraps scalars in an array", () => {
        expect(coerceToArray(42)).toEqual([42]);
        expect(coerceToArray("hello")).toEqual(["hello"]);
        expect(coerceToArray(true)).toEqual([true]);
      });

      it("wraps objects in an array", () => {
        expect(coerceToArray({ a: 1 })).toEqual([{ a: 1 }]);
      });
    });
  });

  describe("coerceFromArray", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(coerceFromArray(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(coerceFromArray(null)).toBeUndefined();
      });

      it("returns undefined for empty array", () => {
        expect(coerceFromArray([])).toBeUndefined();
      });

      it("unwraps single-element arrays", () => {
        expect(coerceFromArray([42])).toBe(42);
        expect(coerceFromArray(["hello"])).toBe("hello");
        expect(coerceFromArray([true])).toBe(true);
      });

      it("passes through non-arrays", () => {
        expect(coerceFromArray(42)).toBe(42);
        expect(coerceFromArray("hello")).toBe("hello");
        expect(coerceFromArray({ a: 1 })).toEqual({ a: 1 });
      });
    });

    describe("Error Cases", () => {
      it("throws on multi-element array", () => {
        expect(() => coerceFromArray([1, 2])).toThrow(BadRequestError);
        expect(() => coerceFromArray([1, 2, 3])).toThrow(BadRequestError);
      });
    });
  });

  describe("coerceToObject", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(coerceToObject(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(coerceToObject(null)).toBeUndefined();
      });

      it("wraps scalars in { value }", () => {
        expect(coerceToObject(42)).toEqual({ value: 42 });
        expect(coerceToObject("hello")).toEqual({ value: "hello" });
        expect(coerceToObject(true)).toEqual({ value: true });
      });

      it("wraps arrays in { value }", () => {
        expect(coerceToObject([1, 2, 3])).toEqual({ value: [1, 2, 3] });
      });

      it("passes through objects with value property", () => {
        expect(coerceToObject({ value: 42 })).toEqual({ value: 42 });
        expect(coerceToObject({ value: "hello", extra: true })).toEqual({
          value: "hello",
          extra: true,
        });
      });
    });

    describe("Error Cases", () => {
      it("throws on object without value property", () => {
        expect(() => coerceToObject({ a: 1 })).toThrow(BadRequestError);
        expect(() => coerceToObject({})).toThrow(BadRequestError);
      });
    });
  });

  describe("coerceFromObject", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(coerceFromObject(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(coerceFromObject(null)).toBeUndefined();
      });

      it("extracts value from objects", () => {
        expect(coerceFromObject({ value: 42 })).toBe(42);
        expect(coerceFromObject({ value: "hello" })).toBe("hello");
        expect(coerceFromObject({ value: [1, 2, 3] })).toEqual([1, 2, 3]);
      });

      it("passes through scalars", () => {
        expect(coerceFromObject(42)).toBe(42);
        expect(coerceFromObject("hello")).toBe("hello");
        expect(coerceFromObject(true)).toBe(true);
      });

      it("passes through arrays", () => {
        expect(coerceFromObject([1, 2, 3])).toEqual([1, 2, 3]);
      });
    });

    describe("Error Cases", () => {
      it("throws on object without value property", () => {
        expect(() => coerceFromObject({ a: 1 })).toThrow(BadRequestError);
        expect(() => coerceFromObject({})).toThrow(BadRequestError);
      });
    });
  });

  describe("coerce (generic)", () => {
    it("coerces to Boolean", () => {
      expect(coerce("true", Boolean)).toBe(true);
      expect(coerce("true", "boolean")).toBe(true);
    });

    it("coerces to Number", () => {
      expect(coerce("42", Number)).toBe(42);
      expect(coerce("42", "number")).toBe(42);
    });

    it("coerces to String", () => {
      expect(coerce(42, String)).toBe("42");
      expect(coerce(42, "string")).toBe("42");
    });

    it("coerces to Array", () => {
      expect(coerce(42, Array)).toEqual([42]);
      expect(coerce(42, "array")).toEqual([42]);
      expect(coerce([1, 2], Array)).toEqual([1, 2]);
    });

    it("coerces to Object", () => {
      expect(coerce(42, Object)).toEqual({ value: 42 });
      expect(coerce(42, "object")).toEqual({ value: 42 });
      expect(coerce({ value: "test" }, Object)).toEqual({ value: "test" });
    });
  });
});
