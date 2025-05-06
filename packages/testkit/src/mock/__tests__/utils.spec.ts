import { describe, it, expect, vi } from "vitest";
import { createMockFunction, createAutoMocks, createDeepMock } from "../utils";

describe("Mock Utils", () => {
  describe("createMockFunction", () => {
    it("should create a mock function with the implementation", () => {
      const mockFn = createMockFunction<(a: number, b: number) => number>(
        (a, b) => a + b,
      );
      expect(mockFn(2, 3)).toBe(5);
      expect(mockFn.mock.calls.length).toBe(1);
    });

    it("should create a mock function without implementation", () => {
      const mockFn = createMockFunction<(a: string) => number>();
      mockFn("test");
      expect(mockFn.mock.calls.length).toBe(1);
      expect(mockFn.mock.calls[0][0]).toBe("test");
    });
  });

  describe("createAutoMocks", () => {
    it("should create mocks from an object", () => {
      const original = {
        func: (a: number) => a * 2,
        value: "test",
        obj: { prop: "value" },
      };

      const mocks = createAutoMocks(original);

      expect(typeof mocks.func).toBe("function");
      expect(mocks.value).toBe("test");
      expect(mocks.obj).toEqual({ prop: "value" });
    });

    it("should handle errors in original implementation", () => {
      const original = {
        errorFunc: () => {
          throw new Error("Test error");
        },
      };

      const mocks = createAutoMocks(original);
      const result = (mocks.errorFunc as Function)();

      expect(result).toBe("_MOCK_ERRORFUNC_RESULT");
    });
  });

  describe("createDeepMock", () => {
    it("should create a deep mock with overridden values", () => {
      const template = {
        prop1: "value1",
        prop2: "value2",
        nested: {
          nestedProp: "nestedValue",
        },
      };

      const result = createDeepMock(template, {
        prop1: "override1",
      });

      expect(result.prop1).toBe("override1");
      expect(result.prop2).toBe("value2");
    });

    it("should ignore properties not in template", () => {
      const template = { prop1: "value1" };
      const result = createDeepMock(template, {
        prop1: "override1",
        prop2: "value2" as any,
      });

      expect(result.prop1).toBe("override1");
      expect((result as any).prop2).toBeUndefined();
    });
  });
});
