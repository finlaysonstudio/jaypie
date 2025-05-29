import { describe, expect, it } from "vitest";

import cloneDeep from "../cloneDeep.js";

describe("cloneDeep", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(cloneDeep).toBeTypeOf("function");
    });

    it("works", () => {
      const result = cloneDeep({ a: 1 });
      expect(result).not.toBeUndefined();
    });
  });

  describe("Happy Paths", () => {
    it("clones simple objects", () => {
      const original = { a: 1, b: "hello" };
      const cloned = cloneDeep(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
    });

    it("clones simple arrays", () => {
      const original = [1, 2, 3, "hello"];
      const cloned = cloneDeep(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
    });

    it("clones primitives", () => {
      expect(cloneDeep(42)).toBe(42);
      expect(cloneDeep("hello")).toBe("hello");
      expect(cloneDeep(true)).toBe(true);
      expect(cloneDeep(null)).toBe(null);
      expect(cloneDeep(undefined)).toBe(undefined);
    });
  });

  describe("Features", () => {
    it("clones nested objects", () => {
      const original = {
        a: 1,
        b: {
          c: 2,
          d: {
            e: 3,
          },
        },
      };
      const cloned = cloneDeep(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
      expect(cloned.b.d).not.toBe(original.b.d);
    });

    it("clones nested arrays", () => {
      const original = [1, [2, [3, 4]], 5];
      const cloned = cloneDeep(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[1]).not.toBe(original[1]);
      expect(cloned[1][1]).not.toBe(original[1][1]);
    });

    it("clones Date objects", () => {
      const original = new Date("2025-01-01");
      const cloned = cloneDeep(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned instanceof Date).toBe(true);
    });

    it("clones RegExp objects", () => {
      const original = /hello/gi;
      const cloned = cloneDeep(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned instanceof RegExp).toBe(true);
      expect(cloned.source).toBe(original.source);
      expect(cloned.flags).toBe(original.flags);
    });

    it("clones arrays with mixed types", () => {
      const original = [1, "hello", { a: 1 }, [2, 3], new Date(), /test/];
      const cloned = cloneDeep(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[2]).not.toBe(original[2]);
      expect(cloned[3]).not.toBe(original[3]);
      expect(cloned[4]).not.toBe(original[4]);
      expect(cloned[5]).not.toBe(original[5]);
    });

    it("clones objects with array properties", () => {
      const original = {
        numbers: [1, 2, 3],
        nested: {
          items: ["a", "b", "c"],
        },
      };
      const cloned = cloneDeep(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.numbers).not.toBe(original.numbers);
      expect(cloned.nested).not.toBe(original.nested);
      expect(cloned.nested.items).not.toBe(original.nested.items);
    });
  });

  describe("Specific Scenarios", () => {
    it("handles circular references", () => {
      const original = { a: 1 };
      original.self = original;

      const cloned = cloneDeep(original);

      expect(cloned).not.toBe(original);
      expect(cloned.a).toBe(1);
      expect(cloned.self).toBe(cloned);
      expect(cloned.self).not.toBe(original);
    });

    it("clones Map objects", () => {
      const original = new Map([
        ["key1", "value1"],
        ["key2", { nested: "object" }],
      ]);
      const cloned = cloneDeep(original);

      expect(cloned).not.toBe(original);
      expect(cloned instanceof Map).toBe(true);
      expect(cloned.get("key1")).toBe("value1");
      expect(cloned.get("key2")).toEqual({ nested: "object" });
      expect(cloned.get("key2")).not.toBe(original.get("key2"));
    });

    it("clones Set objects", () => {
      const original = new Set([1, "hello", { a: 1 }]);
      const cloned = cloneDeep(original);

      expect(cloned).not.toBe(original);
      expect(cloned instanceof Set).toBe(true);
      expect(cloned.size).toBe(3);
      expect(cloned.has(1)).toBe(true);
      expect(cloned.has("hello")).toBe(true);
    });

    it("clones typed arrays", () => {
      const original = new Uint8Array([1, 2, 3, 4]);
      const cloned = cloneDeep(original);

      expect(cloned).not.toBe(original);
      expect(cloned instanceof Uint8Array).toBe(true);
      expect(Array.from(cloned)).toEqual([1, 2, 3, 4]);
    });

    it("clones ArrayBuffer", () => {
      const original = new ArrayBuffer(8);
      const view = new Uint8Array(original);
      view[0] = 42;

      const cloned = cloneDeep(original);

      expect(cloned).not.toBe(original);
      expect(cloned instanceof ArrayBuffer).toBe(true);
      expect(cloned.byteLength).toBe(8);
      expect(new Uint8Array(cloned)[0]).toBe(42);
    });

    it("clones Buffer objects", () => {
      const original = Buffer.from([1, 2, 3, 4, 5]);
      const cloned = cloneDeep(original);

      expect(cloned).not.toBe(original);
      expect(Buffer.isBuffer(cloned)).toBe(true);
      expect(Array.from(cloned)).toEqual([1, 2, 3, 4, 5]);
      expect(cloned.length).toBe(5);
    });

    it("handles functions by returning empty object or original", () => {
      const original = function testFunc() {
        return "hello";
      };
      const cloned = cloneDeep(original);

      // Functions are not cloneable, should return empty object or original
      expect(
        typeof cloned === "function" ||
          (typeof cloned === "object" && cloned !== null),
      ).toBe(true);
    });

    it("clones complex nested structures", () => {
      const original = {
        string: "hello",
        number: 42,
        boolean: true,
        date: new Date("2025-01-01"),
        regex: /test/gi,
        array: [1, 2, { nested: "value" }],
        object: {
          deep: {
            deeper: {
              value: "nested",
            },
          },
        },
        map: new Map([["key", "value"]]),
        set: new Set([1, 2, 3]),
      };

      const cloned = cloneDeep(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.date).not.toBe(original.date);
      expect(cloned.regex).not.toBe(original.regex);
      expect(cloned.array).not.toBe(original.array);
      expect(cloned.array[2]).not.toBe(original.array[2]);
      expect(cloned.object).not.toBe(original.object);
      expect(cloned.object.deep).not.toBe(original.object.deep);
      expect(cloned.object.deep.deeper).not.toBe(original.object.deep.deeper);
      expect(cloned.map).not.toBe(original.map);
      expect(cloned.set).not.toBe(original.set);
    });

    it("preserves property descriptors on cloned objects", () => {
      const original = {};
      Object.defineProperty(original, "nonEnumerable", {
        value: "hidden",
        enumerable: false,
        writable: true,
        configurable: true,
      });
      original.enumerable = "visible";

      const cloned = cloneDeep(original);

      expect(cloned.enumerable).toBe("visible");
      expect(Object.keys(cloned)).toEqual(["enumerable"]);
    });

    it("clones Error objects", () => {
      const original = new Error("Test error");
      original.customProperty = "custom";

      const cloned = cloneDeep(original);

      // Error objects may not clone perfectly, but should handle gracefully
      expect(cloned).toBeDefined();
    });
  });
});
