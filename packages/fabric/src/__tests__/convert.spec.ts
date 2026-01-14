import { BadRequestError } from "@jaypie/errors";
import { describe, expect, it } from "vitest";

import {
  convert,
  convertFromArray,
  convertFromObject,
  convertToArray,
  convertToBoolean,
  convertToNumber,
  convertToObject,
  convertToString,
} from "..";

describe("convert", () => {
  describe("convertToBoolean", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(convertToBoolean(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(convertToBoolean(null)).toBeUndefined();
      });

      it("returns undefined for empty string", () => {
        expect(convertToBoolean("")).toBeUndefined();
      });

      it("passes through boolean true", () => {
        expect(convertToBoolean(true)).toBe(true);
      });

      it("passes through boolean false", () => {
        expect(convertToBoolean(false)).toBe(false);
      });

      it('converts string "true" to true', () => {
        expect(convertToBoolean("true")).toBe(true);
        expect(convertToBoolean("TRUE")).toBe(true);
        expect(convertToBoolean("True")).toBe(true);
      });

      it('converts string "false" to false', () => {
        expect(convertToBoolean("false")).toBe(false);
        expect(convertToBoolean("FALSE")).toBe(false);
        expect(convertToBoolean("False")).toBe(false);
      });

      it("converts positive numbers to true", () => {
        expect(convertToBoolean(1)).toBe(true);
        expect(convertToBoolean(42)).toBe(true);
        expect(convertToBoolean(0.1)).toBe(true);
      });

      it("converts zero to false", () => {
        expect(convertToBoolean(0)).toBe(false);
      });

      it("converts negative numbers to false", () => {
        expect(convertToBoolean(-1)).toBe(false);
        expect(convertToBoolean(-42)).toBe(false);
      });

      it("converts numeric strings based on value", () => {
        expect(convertToBoolean("1")).toBe(true);
        expect(convertToBoolean("0")).toBe(false);
        expect(convertToBoolean("-1")).toBe(false);
        expect(convertToBoolean("42")).toBe(true);
      });
    });

    describe("Unwrapping", () => {
      it("unwraps object with value property", () => {
        expect(convertToBoolean({ value: "true" })).toBe(true);
        expect(convertToBoolean({ value: true })).toBe(true);
        expect(convertToBoolean({ value: 1 })).toBe(true);
        expect(convertToBoolean({ value: 0 })).toBe(false);
      });

      it("unwraps single-element array", () => {
        expect(convertToBoolean([true])).toBe(true);
        expect(convertToBoolean(["true"])).toBe(true);
        expect(convertToBoolean([1])).toBe(true);
        expect(convertToBoolean([0])).toBe(false);
      });

      it("unwraps nested array with object", () => {
        expect(convertToBoolean([{ value: "true" }])).toBe(true);
      });

      it("parses JSON string to object and unwraps", () => {
        expect(convertToBoolean('{"value":"true"}')).toBe(true);
        expect(convertToBoolean('{"value":true}')).toBe(true);
        expect(convertToBoolean('{"value":1}')).toBe(true);
      });

      it("parses JSON string to array and unwraps", () => {
        expect(convertToBoolean('["true"]')).toBe(true);
        expect(convertToBoolean("[true]")).toBe(true);
        expect(convertToBoolean("[1]")).toBe(true);
      });

      it("parses JSON string with nested structure", () => {
        expect(convertToBoolean('[{"value":true}]')).toBe(true);
        expect(convertToBoolean('[{"value":"true"}]')).toBe(true);
      });

      it("returns undefined for empty array", () => {
        expect(convertToBoolean([])).toBeUndefined();
      });
    });

    describe("Error Cases", () => {
      it("throws on non-numeric string", () => {
        expect(() => convertToBoolean("hello")).toThrow(BadRequestError);
      });

      it("throws on NaN number", () => {
        expect(() => convertToBoolean(NaN)).toThrow(BadRequestError);
      });

      it("throws on object without value property", () => {
        expect(() => convertToBoolean({ foo: "bar" })).toThrow(BadRequestError);
      });

      it("throws on multi-element array", () => {
        expect(() => convertToBoolean([true, false])).toThrow(BadRequestError);
      });
    });
  });

  describe("convertToNumber", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(convertToNumber(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(convertToNumber(null)).toBeUndefined();
      });

      it("returns undefined for empty string", () => {
        expect(convertToNumber("")).toBeUndefined();
      });

      it("passes through numbers", () => {
        expect(convertToNumber(42)).toBe(42);
        expect(convertToNumber(0)).toBe(0);
        expect(convertToNumber(-42)).toBe(-42);
        expect(convertToNumber(3.14)).toBe(3.14);
      });

      it("converts boolean true to 1", () => {
        expect(convertToNumber(true)).toBe(1);
      });

      it("converts boolean false to 0", () => {
        expect(convertToNumber(false)).toBe(0);
      });

      it('converts string "true" to 1', () => {
        expect(convertToNumber("true")).toBe(1);
        expect(convertToNumber("TRUE")).toBe(1);
      });

      it('converts string "false" to 0', () => {
        expect(convertToNumber("false")).toBe(0);
        expect(convertToNumber("FALSE")).toBe(0);
      });

      it("parses numeric strings", () => {
        expect(convertToNumber("42")).toBe(42);
        expect(convertToNumber("3.14")).toBe(3.14);
        expect(convertToNumber("-42")).toBe(-42);
      });
    });

    describe("Unwrapping", () => {
      it("unwraps object with value property", () => {
        expect(convertToNumber({ value: "42" })).toBe(42);
        expect(convertToNumber({ value: 42 })).toBe(42);
        expect(convertToNumber({ value: true })).toBe(1);
      });

      it("unwraps single-element array", () => {
        expect(convertToNumber([42])).toBe(42);
        expect(convertToNumber(["42"])).toBe(42);
        expect(convertToNumber([true])).toBe(1);
      });

      it("unwraps nested array with object", () => {
        expect(convertToNumber([{ value: 42 }])).toBe(42);
      });

      it("parses JSON string to object and unwraps", () => {
        expect(convertToNumber('{"value":"42"}')).toBe(42);
        expect(convertToNumber('{"value":42}')).toBe(42);
      });

      it("parses JSON string to array and unwraps", () => {
        expect(convertToNumber('["42"]')).toBe(42);
        expect(convertToNumber("[42]")).toBe(42);
      });

      it("parses JSON string with nested structure", () => {
        expect(convertToNumber('[{"value":42}]')).toBe(42);
      });

      it("returns undefined for empty array", () => {
        expect(convertToNumber([])).toBeUndefined();
      });
    });

    describe("Error Cases", () => {
      it("throws on non-numeric string", () => {
        expect(() => convertToNumber("hello")).toThrow(BadRequestError);
      });

      it("throws on NaN number", () => {
        expect(() => convertToNumber(NaN)).toThrow(BadRequestError);
      });

      it("throws on object without value property", () => {
        expect(() => convertToNumber({ foo: "bar" })).toThrow(BadRequestError);
      });

      it("throws on multi-element array", () => {
        expect(() => convertToNumber([1, 2])).toThrow(BadRequestError);
      });
    });
  });

  describe("convertToString", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(convertToString(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(convertToString(null)).toBeUndefined();
      });

      it("returns undefined for empty string", () => {
        expect(convertToString("")).toBeUndefined();
      });

      it("passes through strings", () => {
        expect(convertToString("hello")).toBe("hello");
      });

      it('converts boolean true to "true"', () => {
        expect(convertToString(true)).toBe("true");
      });

      it('converts boolean false to "false"', () => {
        expect(convertToString(false)).toBe("false");
      });

      it("converts numbers to strings", () => {
        expect(convertToString(42)).toBe("42");
        expect(convertToString(0)).toBe("0");
        expect(convertToString(-42)).toBe("-42");
        expect(convertToString(3.14)).toBe("3.14");
      });
    });

    describe("Unwrapping", () => {
      it("unwraps object with value property", () => {
        expect(convertToString({ value: "hello" })).toBe("hello");
        expect(convertToString({ value: 42 })).toBe("42");
        expect(convertToString({ value: true })).toBe("true");
      });

      it("unwraps single-element array", () => {
        expect(convertToString(["hello"])).toBe("hello");
        expect(convertToString([42])).toBe("42");
        expect(convertToString([true])).toBe("true");
      });

      it("unwraps nested array with object", () => {
        expect(convertToString([{ value: "hello" }])).toBe("hello");
      });

      it("parses JSON string to object and unwraps", () => {
        expect(convertToString('{"value":"hello"}')).toBe("hello");
        expect(convertToString('{"value":42}')).toBe("42");
      });

      it("parses JSON string to array and unwraps", () => {
        expect(convertToString('["hello"]')).toBe("hello");
        expect(convertToString("[42]")).toBe("42");
      });

      it("parses JSON string with nested structure", () => {
        expect(convertToString('[{"value":"hello"}]')).toBe("hello");
      });

      it("returns undefined for empty array", () => {
        expect(convertToString([])).toBeUndefined();
      });
    });

    describe("Error Cases", () => {
      it("throws on NaN number", () => {
        expect(() => convertToString(NaN)).toThrow(BadRequestError);
      });

      it("throws on object without value property", () => {
        expect(() => convertToString({ foo: "bar" })).toThrow(BadRequestError);
      });

      it("throws on multi-element array", () => {
        expect(() => convertToString(["a", "b"])).toThrow(BadRequestError);
      });
    });
  });

  describe("convertToArray", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(convertToArray(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(convertToArray(null)).toBeUndefined();
      });

      it("passes through arrays", () => {
        expect(convertToArray([1, 2, 3])).toEqual([1, 2, 3]);
        expect(convertToArray([])).toEqual([]);
        expect(convertToArray(["a"])).toEqual(["a"]);
      });

      it("wraps scalars in an array", () => {
        expect(convertToArray(42)).toEqual([42]);
        expect(convertToArray("hello")).toEqual(["hello"]);
        expect(convertToArray(true)).toEqual([true]);
      });

      it("wraps objects in an array", () => {
        expect(convertToArray({ a: 1 })).toEqual([{ a: 1 }]);
      });
    });
  });

  describe("convertFromArray", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(convertFromArray(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(convertFromArray(null)).toBeUndefined();
      });

      it("returns undefined for empty array", () => {
        expect(convertFromArray([])).toBeUndefined();
      });

      it("unwraps single-element arrays", () => {
        expect(convertFromArray([42])).toBe(42);
        expect(convertFromArray(["hello"])).toBe("hello");
        expect(convertFromArray([true])).toBe(true);
      });

      it("passes through non-arrays", () => {
        expect(convertFromArray(42)).toBe(42);
        expect(convertFromArray("hello")).toBe("hello");
        expect(convertFromArray({ a: 1 })).toEqual({ a: 1 });
      });
    });

    describe("Error Cases", () => {
      it("throws on multi-element array", () => {
        expect(() => convertFromArray([1, 2])).toThrow(BadRequestError);
        expect(() => convertFromArray([1, 2, 3])).toThrow(BadRequestError);
      });
    });
  });

  describe("convertToObject", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(convertToObject(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(convertToObject(null)).toBeUndefined();
      });

      it("wraps scalars in { value }", () => {
        expect(convertToObject(42)).toEqual({ value: 42 });
        expect(convertToObject("hello")).toEqual({ value: "hello" });
        expect(convertToObject(true)).toEqual({ value: true });
      });

      it("wraps arrays in { value }", () => {
        expect(convertToObject([1, 2, 3])).toEqual({ value: [1, 2, 3] });
      });

      it("passes through objects with value property", () => {
        expect(convertToObject({ value: 42 })).toEqual({ value: 42 });
        expect(convertToObject({ value: "hello", extra: true })).toEqual({
          value: "hello",
          extra: true,
        });
      });
    });

    describe("Error Cases", () => {
      it("throws on object without value property", () => {
        expect(() => convertToObject({ a: 1 })).toThrow(BadRequestError);
        expect(() => convertToObject({})).toThrow(BadRequestError);
      });
    });
  });

  describe("convertFromObject", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(convertFromObject(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(convertFromObject(null)).toBeUndefined();
      });

      it("extracts value from objects", () => {
        expect(convertFromObject({ value: 42 })).toBe(42);
        expect(convertFromObject({ value: "hello" })).toBe("hello");
        expect(convertFromObject({ value: [1, 2, 3] })).toEqual([1, 2, 3]);
      });

      it("passes through scalars", () => {
        expect(convertFromObject(42)).toBe(42);
        expect(convertFromObject("hello")).toBe("hello");
        expect(convertFromObject(true)).toBe(true);
      });

      it("passes through arrays", () => {
        expect(convertFromObject([1, 2, 3])).toEqual([1, 2, 3]);
      });
    });

    describe("Error Cases", () => {
      it("throws on object without value property", () => {
        expect(() => convertFromObject({ a: 1 })).toThrow(BadRequestError);
        expect(() => convertFromObject({})).toThrow(BadRequestError);
      });
    });
  });

  describe("convert (generic)", () => {
    it("converts to Boolean", () => {
      expect(convert("true", Boolean)).toBe(true);
      expect(convert("true", "boolean")).toBe(true);
    });

    it("converts to Number", () => {
      expect(convert("42", Number)).toBe(42);
      expect(convert("42", "number")).toBe(42);
    });

    it("converts to String", () => {
      expect(convert(42, String)).toBe("42");
      expect(convert(42, "string")).toBe("42");
    });

    it("converts to Array", () => {
      expect(convert(42, Array)).toEqual([42]);
      expect(convert(42, "array")).toEqual([42]);
      expect(convert([1, 2], Array)).toEqual([1, 2]);
    });

    it("converts to Object", () => {
      expect(convert(42, Object)).toEqual({ value: 42 });
      expect(convert(42, "object")).toEqual({ value: 42 });
      expect(convert({ value: "test" }, Object)).toEqual({ value: "test" });
    });
  });

  describe("Typed Arrays", () => {
    describe("[String] - Array of Strings", () => {
      it("converts array elements to strings", () => {
        expect(convert([1, 2, 3], [String])).toEqual(["1", "2", "3"]);
        expect(convert([true, false], [String])).toEqual(["true", "false"]);
      });

      it("wraps non-array in array and converts", () => {
        expect(convert(42, [String])).toEqual(["42"]);
        expect(convert(true, [String])).toEqual(["true"]);
      });

      it("returns undefined for undefined/null", () => {
        expect(convert(undefined, [String])).toBeUndefined();
        expect(convert(null, [String])).toBeUndefined();
      });

      it("supports string type shorthand", () => {
        expect(convert([1, 2], ["string"])).toEqual(["1", "2"]);
      });

      it('supports "" shorthand for String', () => {
        expect(convert([1, 2], [""])).toEqual(["1", "2"]);
      });
    });

    describe("[Number] - Array of Numbers", () => {
      it("converts array elements to numbers", () => {
        expect(convert(["1", "2", "3"], [Number])).toEqual([1, 2, 3]);
        expect(convert([true, false], [Number])).toEqual([1, 0]);
      });

      it("wraps non-array in array and converts", () => {
        expect(convert("42", [Number])).toEqual([42]);
        expect(convert(true, [Number])).toEqual([1]);
      });

      it("returns undefined for undefined/null", () => {
        expect(convert(undefined, [Number])).toBeUndefined();
        expect(convert(null, [Number])).toBeUndefined();
      });

      it("supports string type shorthand", () => {
        expect(convert(["1", "2"], ["number"])).toEqual([1, 2]);
      });

      it("throws on non-numeric element", () => {
        expect(() => convert(["1", "hello", "3"], [Number])).toThrow(
          BadRequestError,
        );
      });
    });

    describe("[Boolean] - Array of Booleans", () => {
      it("converts array elements to booleans", () => {
        expect(convert(["true", "false"], [Boolean])).toEqual([true, false]);
        expect(convert([1, 0, -1], [Boolean])).toEqual([true, false, false]);
      });

      it("wraps non-array in array and converts", () => {
        expect(convert("true", [Boolean])).toEqual([true]);
        expect(convert(1, [Boolean])).toEqual([true]);
      });

      it("returns undefined for undefined/null", () => {
        expect(convert(undefined, [Boolean])).toBeUndefined();
        expect(convert(null, [Boolean])).toBeUndefined();
      });

      it("supports string type shorthand", () => {
        expect(convert(["true", "false"], ["boolean"])).toEqual([true, false]);
      });

      it("throws on non-boolean-convertible element", () => {
        expect(() => convert(["true", "hello"], [Boolean])).toThrow(
          BadRequestError,
        );
      });
    });

    describe("[Object] - Array of Objects", () => {
      it("converts array elements to objects", () => {
        expect(convert([1, "hello"], [Object])).toEqual([
          { value: 1 },
          { value: "hello" },
        ]);
      });

      it("passes through objects with value property", () => {
        expect(convert([{ value: 1 }, { value: 2 }], [Object])).toEqual([
          { value: 1 },
          { value: 2 },
        ]);
      });

      it("wraps non-array in array and converts", () => {
        expect(convert(42, [Object])).toEqual([{ value: 42 }]);
      });

      it("returns undefined for undefined/null", () => {
        expect(convert(undefined, [Object])).toBeUndefined();
        expect(convert(null, [Object])).toBeUndefined();
      });

      it("supports string type shorthand", () => {
        expect(convert([1, 2], ["object"])).toEqual([
          { value: 1 },
          { value: 2 },
        ]);
      });

      it("supports {} shorthand for Object", () => {
        expect(convert([1, 2], [{}])).toEqual([{ value: 1 }, { value: 2 }]);
      });

      it("throws on object without value property", () => {
        expect(() => convert([{ foo: "bar" }], [Object])).toThrow(
          BadRequestError,
        );
      });
    });

    describe("[] - Untyped Array", () => {
      it("wraps non-array in array without conversion", () => {
        expect(convert(42, [])).toEqual([42]);
        expect(convert("hello", [])).toEqual(["hello"]);
        expect(convert(true, [])).toEqual([true]);
      });

      it("passes through arrays without element conversion", () => {
        expect(convert([1, "two", true], [])).toEqual([1, "two", true]);
      });

      it("returns undefined for undefined/null", () => {
        expect(convert(undefined, [])).toBeUndefined();
        expect(convert(null, [])).toBeUndefined();
      });
    });

    describe("Error reporting", () => {
      it("includes index in error message", () => {
        expect(() => convert(["1", "hello", "3"], [Number])).toThrow(/index 1/);
      });
    });

    describe("String splitting (comma/tab)", () => {
      describe("Comma-separated strings", () => {
        it("splits comma-separated string into [Number]", () => {
          expect(convert("1,2,3", [Number])).toEqual([1, 2, 3]);
        });

        it("splits comma-separated string into [String]", () => {
          expect(convert("a,b,c", [String])).toEqual(["a", "b", "c"]);
        });

        it("splits comma-separated string into [Boolean]", () => {
          expect(convert("true,false,true", [Boolean])).toEqual([
            true,
            false,
            true,
          ]);
        });

        it("trims whitespace around comma-separated values", () => {
          expect(convert("1, 2, 3", [Number])).toEqual([1, 2, 3]);
          expect(convert("a , b , c", [String])).toEqual(["a", "b", "c"]);
        });

        it("handles single value without comma", () => {
          expect(convert("42", [Number])).toEqual([42]);
        });
      });

      describe("Tab-separated strings", () => {
        it("splits tab-separated string into [Number]", () => {
          expect(convert("1\t2\t3", [Number])).toEqual([1, 2, 3]);
        });

        it("splits tab-separated string into [String]", () => {
          expect(convert("a\tb\tc", [String])).toEqual(["a", "b", "c"]);
        });

        it("splits tab-separated string into [Boolean]", () => {
          expect(convert("true\tfalse", [Boolean])).toEqual([true, false]);
        });

        it("trims whitespace around tab-separated values", () => {
          expect(convert("1\t 2\t 3", [Number])).toEqual([1, 2, 3]);
        });
      });

      describe("Priority: JSON > comma/tab splitting", () => {
        it("parses JSON array before splitting", () => {
          // JSON array should be parsed, not split on comma
          expect(convert("[1,2,3]", [Number])).toEqual([1, 2, 3]);
          expect(convert('["a","b","c"]', [String])).toEqual(["a", "b", "c"]);
        });

        it("falls back to comma splitting for non-JSON", () => {
          // Not valid JSON, should split on comma
          expect(convert("1,2,3", [Number])).toEqual([1, 2, 3]);
        });
      });

      describe("Comma takes priority over tab", () => {
        it("splits on comma when both comma and tab present", () => {
          expect(convert("a,b\tc", [String])).toEqual(["a", "b\tc"]);
        });
      });

      describe("Untyped arrays with string splitting", () => {
        it("splits comma-separated string for untyped array", () => {
          expect(convert("a,b,c", [])).toEqual(["a", "b", "c"]);
        });

        it("splits tab-separated string for untyped array", () => {
          expect(convert("a\tb\tc", [])).toEqual(["a", "b", "c"]);
        });
      });
    });
  });
});
