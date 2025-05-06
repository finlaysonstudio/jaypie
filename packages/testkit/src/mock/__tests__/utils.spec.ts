import { describe, it, expect } from "vitest";
import {
  createMockFunction,
  createAutoMocks,
  createDeepMock,
  createMockResolvedFunction,
  MockValidationError,
  MockNotFoundError,
} from "../utils";

describe("Mock Utils", () => {
  describe("Error Classes", () => {
    it("should create MockValidationError with correct name", () => {
      const error = new MockValidationError("Invalid data");
      expect(error.name).toBe("ValidationError");
      expect(error.message).toBe("Invalid data");
      expect(error instanceof Error).toBe(true);
    });

    it("should create MockNotFoundError with correct name", () => {
      const error = new MockNotFoundError("Resource not found");
      expect(error.name).toBe("NotFoundError");
      expect(error.message).toBe("Resource not found");
      expect(error instanceof Error).toBe(true);
    });
  });

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

  describe("createMockResolvedFunction", () => {
    it("should resolve to the provided value when awaited", async () => {
      const mockFn = createMockResolvedFunction("test value");
      const result = await mockFn();
      expect(result).toBe("test value");
    });

    it("should allow changing the resolved value", async () => {
      const mockFn = createMockResolvedFunction("initial value");
      mockFn.mockResolvedValue("new value");
      const result = await mockFn();
      expect(result).toBe("new value");
    });
  });
});
