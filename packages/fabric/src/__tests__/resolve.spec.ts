import { BadRequestError } from "@jaypie/errors";
import { describe, expect, it } from "vitest";

import {
  fabric,
  fabricArray,
  fabricBoolean,
  fabricNumber,
  fabricObject,
  fabricString,
  resolveFromArray,
  resolveFromObject,
} from "..";

describe("resolve", () => {
  describe("convertToBoolean", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(fabricBoolean(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(fabricBoolean(null)).toBeUndefined();
      });

      it("returns undefined for empty string", () => {
        expect(fabricBoolean("")).toBeUndefined();
      });

      it("passes through boolean true", () => {
        expect(fabricBoolean(true)).toBe(true);
      });

      it("passes through boolean false", () => {
        expect(fabricBoolean(false)).toBe(false);
      });

      it('converts string "true" to true', () => {
        expect(fabricBoolean("true")).toBe(true);
        expect(fabricBoolean("TRUE")).toBe(true);
        expect(fabricBoolean("True")).toBe(true);
      });

      it('converts string "false" to false', () => {
        expect(fabricBoolean("false")).toBe(false);
        expect(fabricBoolean("FALSE")).toBe(false);
        expect(fabricBoolean("False")).toBe(false);
      });

      it("converts positive numbers to true", () => {
        expect(fabricBoolean(1)).toBe(true);
        expect(fabricBoolean(42)).toBe(true);
        expect(fabricBoolean(0.1)).toBe(true);
      });

      it("converts zero to false", () => {
        expect(fabricBoolean(0)).toBe(false);
      });

      it("converts negative numbers to false", () => {
        expect(fabricBoolean(-1)).toBe(false);
        expect(fabricBoolean(-42)).toBe(false);
      });

      it("converts numeric strings based on value", () => {
        expect(fabricBoolean("1")).toBe(true);
        expect(fabricBoolean("0")).toBe(false);
        expect(fabricBoolean("-1")).toBe(false);
        expect(fabricBoolean("42")).toBe(true);
      });
    });

    describe("Unwrapping", () => {
      it("unwraps object with value property", () => {
        expect(fabricBoolean({ value: "true" })).toBe(true);
        expect(fabricBoolean({ value: true })).toBe(true);
        expect(fabricBoolean({ value: 1 })).toBe(true);
        expect(fabricBoolean({ value: 0 })).toBe(false);
      });

      it("unwraps single-element array", () => {
        expect(fabricBoolean([true])).toBe(true);
        expect(fabricBoolean(["true"])).toBe(true);
        expect(fabricBoolean([1])).toBe(true);
        expect(fabricBoolean([0])).toBe(false);
      });

      it("unwraps nested array with object", () => {
        expect(fabricBoolean([{ value: "true" }])).toBe(true);
      });

      it("parses JSON string to object and unwraps", () => {
        expect(fabricBoolean('{"value":"true"}')).toBe(true);
        expect(fabricBoolean('{"value":true}')).toBe(true);
        expect(fabricBoolean('{"value":1}')).toBe(true);
      });

      it("parses JSON string to array and unwraps", () => {
        expect(fabricBoolean('["true"]')).toBe(true);
        expect(fabricBoolean("[true]")).toBe(true);
        expect(fabricBoolean("[1]")).toBe(true);
      });

      it("parses JSON string with nested structure", () => {
        expect(fabricBoolean('[{"value":true}]')).toBe(true);
        expect(fabricBoolean('[{"value":"true"}]')).toBe(true);
      });

      it("returns undefined for empty array", () => {
        expect(fabricBoolean([])).toBeUndefined();
      });
    });

    describe("Error Cases", () => {
      it("throws on non-numeric string", () => {
        expect(() => fabricBoolean("hello")).toThrow(BadRequestError);
      });

      it("throws on NaN number", () => {
        expect(() => fabricBoolean(NaN)).toThrow(BadRequestError);
      });

      it("throws on object without value property", () => {
        expect(() => fabricBoolean({ foo: "bar" })).toThrow(BadRequestError);
      });

      it("throws on multi-element array", () => {
        expect(() => fabricBoolean([true, false])).toThrow(BadRequestError);
      });
    });
  });

  describe("convertToNumber", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(fabricNumber(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(fabricNumber(null)).toBeUndefined();
      });

      it("returns undefined for empty string", () => {
        expect(fabricNumber("")).toBeUndefined();
      });

      it("passes through numbers", () => {
        expect(fabricNumber(42)).toBe(42);
        expect(fabricNumber(0)).toBe(0);
        expect(fabricNumber(-42)).toBe(-42);
        expect(fabricNumber(3.14)).toBe(3.14);
      });

      it("converts boolean true to 1", () => {
        expect(fabricNumber(true)).toBe(1);
      });

      it("converts boolean false to 0", () => {
        expect(fabricNumber(false)).toBe(0);
      });

      it('converts string "true" to 1', () => {
        expect(fabricNumber("true")).toBe(1);
        expect(fabricNumber("TRUE")).toBe(1);
      });

      it('converts string "false" to 0', () => {
        expect(fabricNumber("false")).toBe(0);
        expect(fabricNumber("FALSE")).toBe(0);
      });

      it("parses numeric strings", () => {
        expect(fabricNumber("42")).toBe(42);
        expect(fabricNumber("3.14")).toBe(3.14);
        expect(fabricNumber("-42")).toBe(-42);
      });
    });

    describe("Unwrapping", () => {
      it("unwraps object with value property", () => {
        expect(fabricNumber({ value: "42" })).toBe(42);
        expect(fabricNumber({ value: 42 })).toBe(42);
        expect(fabricNumber({ value: true })).toBe(1);
      });

      it("unwraps single-element array", () => {
        expect(fabricNumber([42])).toBe(42);
        expect(fabricNumber(["42"])).toBe(42);
        expect(fabricNumber([true])).toBe(1);
      });

      it("unwraps nested array with object", () => {
        expect(fabricNumber([{ value: 42 }])).toBe(42);
      });

      it("parses JSON string to object and unwraps", () => {
        expect(fabricNumber('{"value":"42"}')).toBe(42);
        expect(fabricNumber('{"value":42}')).toBe(42);
      });

      it("parses JSON string to array and unwraps", () => {
        expect(fabricNumber('["42"]')).toBe(42);
        expect(fabricNumber("[42]")).toBe(42);
      });

      it("parses JSON string with nested structure", () => {
        expect(fabricNumber('[{"value":42}]')).toBe(42);
      });

      it("returns undefined for empty array", () => {
        expect(fabricNumber([])).toBeUndefined();
      });
    });

    describe("Error Cases", () => {
      it("throws on non-numeric string", () => {
        expect(() => fabricNumber("hello")).toThrow(BadRequestError);
      });

      it("throws on NaN number", () => {
        expect(() => fabricNumber(NaN)).toThrow(BadRequestError);
      });

      it("throws on object without value property", () => {
        expect(() => fabricNumber({ foo: "bar" })).toThrow(BadRequestError);
      });

      it("throws on multi-element array", () => {
        expect(() => fabricNumber([1, 2])).toThrow(BadRequestError);
      });
    });
  });

  describe("convertToString", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(fabricString(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(fabricString(null)).toBeUndefined();
      });

      it("returns undefined for empty string", () => {
        expect(fabricString("")).toBeUndefined();
      });

      it("passes through strings", () => {
        expect(fabricString("hello")).toBe("hello");
      });

      it('converts boolean true to "true"', () => {
        expect(fabricString(true)).toBe("true");
      });

      it('converts boolean false to "false"', () => {
        expect(fabricString(false)).toBe("false");
      });

      it("converts numbers to strings", () => {
        expect(fabricString(42)).toBe("42");
        expect(fabricString(0)).toBe("0");
        expect(fabricString(-42)).toBe("-42");
        expect(fabricString(3.14)).toBe("3.14");
      });
    });

    describe("Unwrapping", () => {
      it("unwraps object with value property", () => {
        expect(fabricString({ value: "hello" })).toBe("hello");
        expect(fabricString({ value: 42 })).toBe("42");
        expect(fabricString({ value: true })).toBe("true");
      });

      it("unwraps single-element array", () => {
        expect(fabricString(["hello"])).toBe("hello");
        expect(fabricString([42])).toBe("42");
        expect(fabricString([true])).toBe("true");
      });

      it("unwraps nested array with object", () => {
        expect(fabricString([{ value: "hello" }])).toBe("hello");
      });

      it("parses JSON string to object and unwraps", () => {
        expect(fabricString('{"value":"hello"}')).toBe("hello");
        expect(fabricString('{"value":42}')).toBe("42");
      });

      it("parses JSON string to array and unwraps", () => {
        expect(fabricString('["hello"]')).toBe("hello");
        expect(fabricString("[42]")).toBe("42");
      });

      it("parses JSON string with nested structure", () => {
        expect(fabricString('[{"value":"hello"}]')).toBe("hello");
      });

      it("returns undefined for empty array", () => {
        expect(fabricString([])).toBeUndefined();
      });
    });

    describe("Error Cases", () => {
      it("throws on NaN number", () => {
        expect(() => fabricString(NaN)).toThrow(BadRequestError);
      });

      it("throws on object without value property", () => {
        expect(() => fabricString({ foo: "bar" })).toThrow(BadRequestError);
      });

      it("throws on multi-element array", () => {
        expect(() => fabricString(["a", "b"])).toThrow(BadRequestError);
      });
    });
  });

  describe("convertToArray", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(fabricArray(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(fabricArray(null)).toBeUndefined();
      });

      it("passes through arrays", () => {
        expect(fabricArray([1, 2, 3])).toEqual([1, 2, 3]);
        expect(fabricArray([])).toEqual([]);
        expect(fabricArray(["a"])).toEqual(["a"]);
      });

      it("wraps scalars in an array", () => {
        expect(fabricArray(42)).toEqual([42]);
        expect(fabricArray("hello")).toEqual(["hello"]);
        expect(fabricArray(true)).toEqual([true]);
      });

      it("wraps objects in an array", () => {
        expect(fabricArray({ a: 1 })).toEqual([{ a: 1 }]);
      });
    });
  });

  describe("resolveFromArray", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(resolveFromArray(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(resolveFromArray(null)).toBeUndefined();
      });

      it("returns undefined for empty array", () => {
        expect(resolveFromArray([])).toBeUndefined();
      });

      it("unwraps single-element arrays", () => {
        expect(resolveFromArray([42])).toBe(42);
        expect(resolveFromArray(["hello"])).toBe("hello");
        expect(resolveFromArray([true])).toBe(true);
      });

      it("passes through non-arrays", () => {
        expect(resolveFromArray(42)).toBe(42);
        expect(resolveFromArray("hello")).toBe("hello");
        expect(resolveFromArray({ a: 1 })).toEqual({ a: 1 });
      });
    });

    describe("Error Cases", () => {
      it("throws on multi-element array", () => {
        expect(() => resolveFromArray([1, 2])).toThrow(BadRequestError);
        expect(() => resolveFromArray([1, 2, 3])).toThrow(BadRequestError);
      });
    });
  });

  describe("convertToObject", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(fabricObject(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(fabricObject(null)).toBeUndefined();
      });

      it("wraps scalars in { value }", () => {
        expect(fabricObject(42)).toEqual({ value: 42 });
        expect(fabricObject("hello")).toEqual({ value: "hello" });
        expect(fabricObject(true)).toEqual({ value: true });
      });

      it("wraps arrays in { value }", () => {
        expect(fabricObject([1, 2, 3])).toEqual({ value: [1, 2, 3] });
      });

      it("passes through objects with value property", () => {
        expect(fabricObject({ value: 42 })).toEqual({ value: 42 });
        expect(fabricObject({ value: "hello", extra: true })).toEqual({
          value: "hello",
          extra: true,
        });
      });
    });

    describe("Passthrough", () => {
      it("passes through object without value property", () => {
        expect(fabricObject({ a: 1 })).toEqual({ a: 1 });
        expect(fabricObject({})).toEqual({});
        expect(fabricObject({ query: "test", from: "now-1h" })).toEqual({
          from: "now-1h",
          query: "test",
        });
      });
    });
  });

  describe("resolveFromObject", () => {
    describe("Happy Paths", () => {
      it("returns undefined for undefined", () => {
        expect(resolveFromObject(undefined)).toBeUndefined();
      });

      it("returns undefined for null", () => {
        expect(resolveFromObject(null)).toBeUndefined();
      });

      it("extracts value from objects", () => {
        expect(resolveFromObject({ value: 42 })).toBe(42);
        expect(resolveFromObject({ value: "hello" })).toBe("hello");
        expect(resolveFromObject({ value: [1, 2, 3] })).toEqual([1, 2, 3]);
      });

      it("passes through scalars", () => {
        expect(resolveFromObject(42)).toBe(42);
        expect(resolveFromObject("hello")).toBe("hello");
        expect(resolveFromObject(true)).toBe(true);
      });

      it("passes through arrays", () => {
        expect(resolveFromObject([1, 2, 3])).toEqual([1, 2, 3]);
      });
    });

    describe("Passthrough", () => {
      it("passes through object without value property", () => {
        expect(resolveFromObject({ a: 1 })).toEqual({ a: 1 });
        expect(resolveFromObject({})).toEqual({});
        expect(resolveFromObject({ query: "test", from: "now-1h" })).toEqual({
          from: "now-1h",
          query: "test",
        });
      });
    });
  });

  describe("convert (generic)", () => {
    it("converts to Boolean", () => {
      expect(fabric("true", Boolean)).toBe(true);
      expect(fabric("true", "boolean")).toBe(true);
    });

    it("converts to Number", () => {
      expect(fabric("42", Number)).toBe(42);
      expect(fabric("42", "number")).toBe(42);
    });

    it("converts to String", () => {
      expect(fabric(42, String)).toBe("42");
      expect(fabric(42, "string")).toBe("42");
    });

    it("converts to Array", () => {
      expect(fabric(42, Array)).toEqual([42]);
      expect(fabric(42, "array")).toEqual([42]);
      expect(fabric([1, 2], Array)).toEqual([1, 2]);
    });

    it("converts to Object", () => {
      expect(fabric(42, Object)).toEqual({ value: 42 });
      expect(fabric(42, "object")).toEqual({ value: 42 });
      expect(fabric({ value: "test" }, Object)).toEqual({ value: "test" });
    });
  });

  describe("Typed Arrays", () => {
    describe("[String] - Array of Strings", () => {
      it("converts array elements to strings", () => {
        expect(fabric([1, 2, 3], [String])).toEqual(["1", "2", "3"]);
        expect(fabric([true, false], [String])).toEqual(["true", "false"]);
      });

      it("wraps non-array in array and converts", () => {
        expect(fabric(42, [String])).toEqual(["42"]);
        expect(fabric(true, [String])).toEqual(["true"]);
      });

      it("returns undefined for undefined/null", () => {
        expect(fabric(undefined, [String])).toBeUndefined();
        expect(fabric(null, [String])).toBeUndefined();
      });

      it("supports string type shorthand", () => {
        expect(fabric([1, 2], ["string"])).toEqual(["1", "2"]);
      });

      it('supports "" shorthand for String', () => {
        expect(fabric([1, 2], [""])).toEqual(["1", "2"]);
      });
    });

    describe("[Number] - Array of Numbers", () => {
      it("converts array elements to numbers", () => {
        expect(fabric(["1", "2", "3"], [Number])).toEqual([1, 2, 3]);
        expect(fabric([true, false], [Number])).toEqual([1, 0]);
      });

      it("wraps non-array in array and converts", () => {
        expect(fabric("42", [Number])).toEqual([42]);
        expect(fabric(true, [Number])).toEqual([1]);
      });

      it("returns undefined for undefined/null", () => {
        expect(fabric(undefined, [Number])).toBeUndefined();
        expect(fabric(null, [Number])).toBeUndefined();
      });

      it("supports string type shorthand", () => {
        expect(fabric(["1", "2"], ["number"])).toEqual([1, 2]);
      });

      it("throws on non-numeric element", () => {
        expect(() => fabric(["1", "hello", "3"], [Number])).toThrow(
          BadRequestError,
        );
      });
    });

    describe("[Boolean] - Array of Booleans", () => {
      it("converts array elements to booleans", () => {
        expect(fabric(["true", "false"], [Boolean])).toEqual([true, false]);
        expect(fabric([1, 0, -1], [Boolean])).toEqual([true, false, false]);
      });

      it("wraps non-array in array and converts", () => {
        expect(fabric("true", [Boolean])).toEqual([true]);
        expect(fabric(1, [Boolean])).toEqual([true]);
      });

      it("returns undefined for undefined/null", () => {
        expect(fabric(undefined, [Boolean])).toBeUndefined();
        expect(fabric(null, [Boolean])).toBeUndefined();
      });

      it("supports string type shorthand", () => {
        expect(fabric(["true", "false"], ["boolean"])).toEqual([true, false]);
      });

      it("throws on non-boolean-convertible element", () => {
        expect(() => fabric(["true", "hello"], [Boolean])).toThrow(
          BadRequestError,
        );
      });
    });

    describe("[Object] - Array of Objects", () => {
      it("converts array elements to objects", () => {
        expect(fabric([1, "hello"], [Object])).toEqual([
          { value: 1 },
          { value: "hello" },
        ]);
      });

      it("passes through objects with value property", () => {
        expect(fabric([{ value: 1 }, { value: 2 }], [Object])).toEqual([
          { value: 1 },
          { value: 2 },
        ]);
      });

      it("wraps non-array in array and converts", () => {
        expect(fabric(42, [Object])).toEqual([{ value: 42 }]);
      });

      it("returns undefined for undefined/null", () => {
        expect(fabric(undefined, [Object])).toBeUndefined();
        expect(fabric(null, [Object])).toBeUndefined();
      });

      it("supports string type shorthand", () => {
        expect(fabric([1, 2], ["object"])).toEqual([
          { value: 1 },
          { value: 2 },
        ]);
      });

      it("supports {} shorthand for Object", () => {
        expect(fabric([1, 2], [{}])).toEqual([{ value: 1 }, { value: 2 }]);
      });

      it("passes through object without value property", () => {
        expect(fabric([{ foo: "bar" }], [Object])).toEqual([{ foo: "bar" }]);
        expect(fabric([{ query: "test" }], [Object])).toEqual([
          { query: "test" },
        ]);
      });
    });

    describe("[] - Untyped Array", () => {
      it("wraps non-array in array without conversion", () => {
        expect(fabric(42, [])).toEqual([42]);
        expect(fabric("hello", [])).toEqual(["hello"]);
        expect(fabric(true, [])).toEqual([true]);
      });

      it("passes through arrays without element conversion", () => {
        expect(fabric([1, "two", true], [])).toEqual([1, "two", true]);
      });

      it("returns undefined for undefined/null", () => {
        expect(fabric(undefined, [])).toBeUndefined();
        expect(fabric(null, [])).toBeUndefined();
      });
    });

    describe("Error reporting", () => {
      it("includes index in error message", () => {
        expect(() => fabric(["1", "hello", "3"], [Number])).toThrow(/index 1/);
      });
    });

    describe("String splitting (comma/tab)", () => {
      describe("Comma-separated strings", () => {
        it("splits comma-separated string into [Number]", () => {
          expect(fabric("1,2,3", [Number])).toEqual([1, 2, 3]);
        });

        it("splits comma-separated string into [String]", () => {
          expect(fabric("a,b,c", [String])).toEqual(["a", "b", "c"]);
        });

        it("splits comma-separated string into [Boolean]", () => {
          expect(fabric("true,false,true", [Boolean])).toEqual([
            true,
            false,
            true,
          ]);
        });

        it("trims whitespace around comma-separated values", () => {
          expect(fabric("1, 2, 3", [Number])).toEqual([1, 2, 3]);
          expect(fabric("a , b , c", [String])).toEqual(["a", "b", "c"]);
        });

        it("handles single value without comma", () => {
          expect(fabric("42", [Number])).toEqual([42]);
        });
      });

      describe("Tab-separated strings", () => {
        it("splits tab-separated string into [Number]", () => {
          expect(fabric("1\t2\t3", [Number])).toEqual([1, 2, 3]);
        });

        it("splits tab-separated string into [String]", () => {
          expect(fabric("a\tb\tc", [String])).toEqual(["a", "b", "c"]);
        });

        it("splits tab-separated string into [Boolean]", () => {
          expect(fabric("true\tfalse", [Boolean])).toEqual([true, false]);
        });

        it("trims whitespace around tab-separated values", () => {
          expect(fabric("1\t 2\t 3", [Number])).toEqual([1, 2, 3]);
        });
      });

      describe("Priority: JSON > comma/tab splitting", () => {
        it("parses JSON array before splitting", () => {
          // JSON array should be parsed, not split on comma
          expect(fabric("[1,2,3]", [Number])).toEqual([1, 2, 3]);
          expect(fabric('["a","b","c"]', [String])).toEqual(["a", "b", "c"]);
        });

        it("falls back to comma splitting for non-JSON", () => {
          // Not valid JSON, should split on comma
          expect(fabric("1,2,3", [Number])).toEqual([1, 2, 3]);
        });
      });

      describe("Comma takes priority over tab", () => {
        it("splits on comma when both comma and tab present", () => {
          expect(fabric("a,b\tc", [String])).toEqual(["a", "b\tc"]);
        });
      });

      describe("Untyped arrays with string splitting", () => {
        it("splits comma-separated string for untyped array", () => {
          expect(fabric("a,b,c", [])).toEqual(["a", "b", "c"]);
        });

        it("splits tab-separated string for untyped array", () => {
          expect(fabric("a\tb\tc", [])).toEqual(["a", "b", "c"]);
        });
      });
    });
  });
});
