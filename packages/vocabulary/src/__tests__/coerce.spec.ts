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

    describe("Unwrapping", () => {
      it("unwraps object with value property", () => {
        expect(coerceToBoolean({ value: "true" })).toBe(true);
        expect(coerceToBoolean({ value: true })).toBe(true);
        expect(coerceToBoolean({ value: 1 })).toBe(true);
        expect(coerceToBoolean({ value: 0 })).toBe(false);
      });

      it("unwraps single-element array", () => {
        expect(coerceToBoolean([true])).toBe(true);
        expect(coerceToBoolean(["true"])).toBe(true);
        expect(coerceToBoolean([1])).toBe(true);
        expect(coerceToBoolean([0])).toBe(false);
      });

      it("unwraps nested array with object", () => {
        expect(coerceToBoolean([{ value: "true" }])).toBe(true);
      });

      it("parses JSON string to object and unwraps", () => {
        expect(coerceToBoolean('{"value":"true"}')).toBe(true);
        expect(coerceToBoolean('{"value":true}')).toBe(true);
        expect(coerceToBoolean('{"value":1}')).toBe(true);
      });

      it("parses JSON string to array and unwraps", () => {
        expect(coerceToBoolean('["true"]')).toBe(true);
        expect(coerceToBoolean("[true]")).toBe(true);
        expect(coerceToBoolean("[1]")).toBe(true);
      });

      it("parses JSON string with nested structure", () => {
        expect(coerceToBoolean('[{"value":true}]')).toBe(true);
        expect(coerceToBoolean('[{"value":"true"}]')).toBe(true);
      });

      it("returns undefined for empty array", () => {
        expect(coerceToBoolean([])).toBeUndefined();
      });
    });

    describe("Error Cases", () => {
      it("throws on non-numeric string", () => {
        expect(() => coerceToBoolean("hello")).toThrow(BadRequestError);
      });

      it("throws on NaN number", () => {
        expect(() => coerceToBoolean(NaN)).toThrow(BadRequestError);
      });

      it("throws on object without value property", () => {
        expect(() => coerceToBoolean({ foo: "bar" })).toThrow(BadRequestError);
      });

      it("throws on multi-element array", () => {
        expect(() => coerceToBoolean([true, false])).toThrow(BadRequestError);
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

    describe("Unwrapping", () => {
      it("unwraps object with value property", () => {
        expect(coerceToNumber({ value: "42" })).toBe(42);
        expect(coerceToNumber({ value: 42 })).toBe(42);
        expect(coerceToNumber({ value: true })).toBe(1);
      });

      it("unwraps single-element array", () => {
        expect(coerceToNumber([42])).toBe(42);
        expect(coerceToNumber(["42"])).toBe(42);
        expect(coerceToNumber([true])).toBe(1);
      });

      it("unwraps nested array with object", () => {
        expect(coerceToNumber([{ value: 42 }])).toBe(42);
      });

      it("parses JSON string to object and unwraps", () => {
        expect(coerceToNumber('{"value":"42"}')).toBe(42);
        expect(coerceToNumber('{"value":42}')).toBe(42);
      });

      it("parses JSON string to array and unwraps", () => {
        expect(coerceToNumber('["42"]')).toBe(42);
        expect(coerceToNumber("[42]")).toBe(42);
      });

      it("parses JSON string with nested structure", () => {
        expect(coerceToNumber('[{"value":42}]')).toBe(42);
      });

      it("returns undefined for empty array", () => {
        expect(coerceToNumber([])).toBeUndefined();
      });
    });

    describe("Error Cases", () => {
      it("throws on non-numeric string", () => {
        expect(() => coerceToNumber("hello")).toThrow(BadRequestError);
      });

      it("throws on NaN number", () => {
        expect(() => coerceToNumber(NaN)).toThrow(BadRequestError);
      });

      it("throws on object without value property", () => {
        expect(() => coerceToNumber({ foo: "bar" })).toThrow(BadRequestError);
      });

      it("throws on multi-element array", () => {
        expect(() => coerceToNumber([1, 2])).toThrow(BadRequestError);
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

    describe("Unwrapping", () => {
      it("unwraps object with value property", () => {
        expect(coerceToString({ value: "hello" })).toBe("hello");
        expect(coerceToString({ value: 42 })).toBe("42");
        expect(coerceToString({ value: true })).toBe("true");
      });

      it("unwraps single-element array", () => {
        expect(coerceToString(["hello"])).toBe("hello");
        expect(coerceToString([42])).toBe("42");
        expect(coerceToString([true])).toBe("true");
      });

      it("unwraps nested array with object", () => {
        expect(coerceToString([{ value: "hello" }])).toBe("hello");
      });

      it("parses JSON string to object and unwraps", () => {
        expect(coerceToString('{"value":"hello"}')).toBe("hello");
        expect(coerceToString('{"value":42}')).toBe("42");
      });

      it("parses JSON string to array and unwraps", () => {
        expect(coerceToString('["hello"]')).toBe("hello");
        expect(coerceToString("[42]")).toBe("42");
      });

      it("parses JSON string with nested structure", () => {
        expect(coerceToString('[{"value":"hello"}]')).toBe("hello");
      });

      it("returns undefined for empty array", () => {
        expect(coerceToString([])).toBeUndefined();
      });
    });

    describe("Error Cases", () => {
      it("throws on NaN number", () => {
        expect(() => coerceToString(NaN)).toThrow(BadRequestError);
      });

      it("throws on object without value property", () => {
        expect(() => coerceToString({ foo: "bar" })).toThrow(BadRequestError);
      });

      it("throws on multi-element array", () => {
        expect(() => coerceToString(["a", "b"])).toThrow(BadRequestError);
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

  describe("Typed Arrays", () => {
    describe("[String] - Array of Strings", () => {
      it("coerces array elements to strings", () => {
        expect(coerce([1, 2, 3], [String])).toEqual(["1", "2", "3"]);
        expect(coerce([true, false], [String])).toEqual(["true", "false"]);
      });

      it("wraps non-array in array and coerces", () => {
        expect(coerce(42, [String])).toEqual(["42"]);
        expect(coerce(true, [String])).toEqual(["true"]);
      });

      it("returns undefined for undefined/null", () => {
        expect(coerce(undefined, [String])).toBeUndefined();
        expect(coerce(null, [String])).toBeUndefined();
      });

      it("supports string type shorthand", () => {
        expect(coerce([1, 2], ["string"])).toEqual(["1", "2"]);
      });

      it('supports "" shorthand for String', () => {
        expect(coerce([1, 2], [""])).toEqual(["1", "2"]);
      });
    });

    describe("[Number] - Array of Numbers", () => {
      it("coerces array elements to numbers", () => {
        expect(coerce(["1", "2", "3"], [Number])).toEqual([1, 2, 3]);
        expect(coerce([true, false], [Number])).toEqual([1, 0]);
      });

      it("wraps non-array in array and coerces", () => {
        expect(coerce("42", [Number])).toEqual([42]);
        expect(coerce(true, [Number])).toEqual([1]);
      });

      it("returns undefined for undefined/null", () => {
        expect(coerce(undefined, [Number])).toBeUndefined();
        expect(coerce(null, [Number])).toBeUndefined();
      });

      it("supports string type shorthand", () => {
        expect(coerce(["1", "2"], ["number"])).toEqual([1, 2]);
      });

      it("throws on non-numeric element", () => {
        expect(() => coerce(["1", "hello", "3"], [Number])).toThrow(
          BadRequestError,
        );
      });
    });

    describe("[Boolean] - Array of Booleans", () => {
      it("coerces array elements to booleans", () => {
        expect(coerce(["true", "false"], [Boolean])).toEqual([true, false]);
        expect(coerce([1, 0, -1], [Boolean])).toEqual([true, false, false]);
      });

      it("wraps non-array in array and coerces", () => {
        expect(coerce("true", [Boolean])).toEqual([true]);
        expect(coerce(1, [Boolean])).toEqual([true]);
      });

      it("returns undefined for undefined/null", () => {
        expect(coerce(undefined, [Boolean])).toBeUndefined();
        expect(coerce(null, [Boolean])).toBeUndefined();
      });

      it("supports string type shorthand", () => {
        expect(coerce(["true", "false"], ["boolean"])).toEqual([true, false]);
      });

      it("throws on non-boolean-convertible element", () => {
        expect(() => coerce(["true", "hello"], [Boolean])).toThrow(
          BadRequestError,
        );
      });
    });

    describe("[Object] - Array of Objects", () => {
      it("coerces array elements to objects", () => {
        expect(coerce([1, "hello"], [Object])).toEqual([
          { value: 1 },
          { value: "hello" },
        ]);
      });

      it("passes through objects with value property", () => {
        expect(coerce([{ value: 1 }, { value: 2 }], [Object])).toEqual([
          { value: 1 },
          { value: 2 },
        ]);
      });

      it("wraps non-array in array and coerces", () => {
        expect(coerce(42, [Object])).toEqual([{ value: 42 }]);
      });

      it("returns undefined for undefined/null", () => {
        expect(coerce(undefined, [Object])).toBeUndefined();
        expect(coerce(null, [Object])).toBeUndefined();
      });

      it("supports string type shorthand", () => {
        expect(coerce([1, 2], ["object"])).toEqual([
          { value: 1 },
          { value: 2 },
        ]);
      });

      it("supports {} shorthand for Object", () => {
        expect(coerce([1, 2], [{}])).toEqual([{ value: 1 }, { value: 2 }]);
      });

      it("throws on object without value property", () => {
        expect(() => coerce([{ foo: "bar" }], [Object])).toThrow(
          BadRequestError,
        );
      });
    });

    describe("[] - Untyped Array", () => {
      it("wraps non-array in array without coercion", () => {
        expect(coerce(42, [])).toEqual([42]);
        expect(coerce("hello", [])).toEqual(["hello"]);
        expect(coerce(true, [])).toEqual([true]);
      });

      it("passes through arrays without element coercion", () => {
        expect(coerce([1, "two", true], [])).toEqual([1, "two", true]);
      });

      it("returns undefined for undefined/null", () => {
        expect(coerce(undefined, [])).toBeUndefined();
        expect(coerce(null, [])).toBeUndefined();
      });
    });

    describe("Error reporting", () => {
      it("includes index in error message", () => {
        expect(() => coerce(["1", "hello", "3"], [Number])).toThrow(/index 1/);
      });
    });

    describe("String splitting (comma/tab)", () => {
      describe("Comma-separated strings", () => {
        it("splits comma-separated string into [Number]", () => {
          expect(coerce("1,2,3", [Number])).toEqual([1, 2, 3]);
        });

        it("splits comma-separated string into [String]", () => {
          expect(coerce("a,b,c", [String])).toEqual(["a", "b", "c"]);
        });

        it("splits comma-separated string into [Boolean]", () => {
          expect(coerce("true,false,true", [Boolean])).toEqual([
            true,
            false,
            true,
          ]);
        });

        it("trims whitespace around comma-separated values", () => {
          expect(coerce("1, 2, 3", [Number])).toEqual([1, 2, 3]);
          expect(coerce("a , b , c", [String])).toEqual(["a", "b", "c"]);
        });

        it("handles single value without comma", () => {
          expect(coerce("42", [Number])).toEqual([42]);
        });
      });

      describe("Tab-separated strings", () => {
        it("splits tab-separated string into [Number]", () => {
          expect(coerce("1\t2\t3", [Number])).toEqual([1, 2, 3]);
        });

        it("splits tab-separated string into [String]", () => {
          expect(coerce("a\tb\tc", [String])).toEqual(["a", "b", "c"]);
        });

        it("splits tab-separated string into [Boolean]", () => {
          expect(coerce("true\tfalse", [Boolean])).toEqual([true, false]);
        });

        it("trims whitespace around tab-separated values", () => {
          expect(coerce("1\t 2\t 3", [Number])).toEqual([1, 2, 3]);
        });
      });

      describe("Priority: JSON > comma/tab splitting", () => {
        it("parses JSON array before splitting", () => {
          // JSON array should be parsed, not split on comma
          expect(coerce("[1,2,3]", [Number])).toEqual([1, 2, 3]);
          expect(coerce('["a","b","c"]', [String])).toEqual(["a", "b", "c"]);
        });

        it("falls back to comma splitting for non-JSON", () => {
          // Not valid JSON, should split on comma
          expect(coerce("1,2,3", [Number])).toEqual([1, 2, 3]);
        });
      });

      describe("Comma takes priority over tab", () => {
        it("splits on comma when both comma and tab present", () => {
          expect(coerce("a,b\tc", [String])).toEqual(["a", "b\tc"]);
        });
      });

      describe("Untyped arrays with string splitting", () => {
        it("splits comma-separated string for untyped array", () => {
          expect(coerce("a,b,c", [])).toEqual(["a", "b", "c"]);
        });

        it("splits tab-separated string for untyped array", () => {
          expect(coerce("a\tb\tc", [])).toEqual(["a", "b", "c"]);
        });
      });
    });
  });
});
