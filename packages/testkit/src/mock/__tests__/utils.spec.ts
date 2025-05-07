import { describe, it, expect, vi } from "vitest";
import {
  createMockFunction,
  createMockResolvedFunction,
  MockValidationError,
  MockNotFoundError,
  createMockError,
  createMockWrappedObject,
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

    it("should create a mock error constructor that is new-able and a vi.fn", () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "CustomError";
        }
      }
      const MockCustomError = createMockError(CustomError);
      expect(typeof MockCustomError).toBe("function");
      const error = new MockCustomError("custom message");
      expect(error).toBeInstanceOf(CustomError);
      expect(error.name).toBe("CustomError");
      expect(error.message).toBe("custom message");
      expect((MockCustomError as any).mock).toBeDefined();
    });

    it("should work with built-in Error using createMockError", () => {
      const MockError = createMockError(Error);
      const error = new MockError("built-in error");
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("built-in error");
      expect((MockError as any).mock).toBeDefined();
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

  describe("createMockWrappedObject", () => {
    it("should create mock functions for all methods in an object", () => {
      const original = {
        method1: (x: number) => x * 2,
        method2: (s: string) => s.toUpperCase(),
        prop: "value",
        nested: {
          nestedMethod: (x: number) => x * 3,
          nestedProp: 42,
        },
      };

      const mock = createMockWrappedObject(original);
      
      // Test method mocking
      expect(mock.method1(5)).toBe(10);
      expect(mock.method2("hello")).toBe("HELLO");
      expect(mock.method1).toHaveProperty("mock");
      expect(mock.method2).toHaveProperty("mock");
      
      // Test property preservation
      expect(mock.prop).toBe("value");
      
      // Test nested objects
      expect(mock.nested.nestedMethod(5)).toBe(15);
      expect(mock.nested.nestedProp).toBe(42);
      expect(mock.nested.nestedMethod).toHaveProperty("mock");
    });

    it("should return fallback value when wrapped function throws", () => {
      const original = {
        method: () => {
          throw new Error("Original implementation error");
        },
      };

      const fallback = "fallback value";
      const mock = createMockWrappedObject(original, fallback);
      
      // Silence console warnings during test
      const consoleWarn = console.warn;
      console.warn = vi.fn();
      
      const result = mock.method();
      
      // Restore console
      console.warn = consoleWarn;
      
      expect(result).toBe(fallback);
      expect(mock.method).toHaveProperty("mock");
    });
  });
});
