import { describe, it, expect } from "vitest";
import {
  createMockFunction,
  createMockResolvedFunction,
  MockValidationError,
  MockNotFoundError,
  createMockError,
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
});
