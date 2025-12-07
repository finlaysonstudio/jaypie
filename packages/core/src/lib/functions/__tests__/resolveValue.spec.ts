import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import resolveValue from "../resolveValue.js";

//
//
// Mock constants
//

//
//
// Mock modules
//

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
});
afterEach(() => {
  process.env = DEFAULT_ENV;
});

//
//
// Run tests
//

describe("resolveValue Function", () => {
  describe("Base Cases", () => {
    it("Returns non-function values as-is", async () => {
      const value = "test string";
      const result = await resolveValue(value);
      expect(result).toBe(value);
    });

    it("Returns numbers as-is", async () => {
      const value = 42;
      const result = await resolveValue(value);
      expect(result).toBe(value);
    });

    it("Returns objects as-is", async () => {
      const value = { key: "value" };
      const result = await resolveValue(value);
      expect(result).toBe(value);
    });

    it("Returns null as-is", async () => {
      const result = await resolveValue(null);
      expect(result).toBe(null);
    });

    it("Returns undefined as-is", async () => {
      const result = await resolveValue(undefined);
      expect(result).toBe(undefined);
    });
  });

  describe("Happy Paths", () => {
    it("Calls function and returns result", async () => {
      const mockFunction = vi.fn(() => "function result");
      const result = await resolveValue(mockFunction);
      expect(mockFunction).toHaveBeenCalledOnce();
      expect(result).toBe("function result");
    });

    it("Awaits promise returned by function", async () => {
      const mockFunction = vi.fn(() => Promise.resolve("promise result"));
      const result = await resolveValue(mockFunction);
      expect(mockFunction).toHaveBeenCalledOnce();
      expect(result).toBe("promise result");
    });

    it("Returns synchronous function result", async () => {
      const mockFunction = () => 123;
      const result = await resolveValue(mockFunction);
      expect(result).toBe(123);
    });
  });

  describe("Features", () => {
    it("Handles async function", async () => {
      const asyncFunction = async () => "async result";
      const result = await resolveValue(asyncFunction);
      expect(result).toBe("async result");
    });

    it("Handles function returning promise", async () => {
      const promiseFunction = () =>
        new Promise((resolve) => {
          setTimeout(() => resolve("delayed result"), 10);
        });
      const result = await resolveValue(promiseFunction);
      expect(result).toBe("delayed result");
    });

    it("Handles function with no return value", async () => {
      const voidFunction = () => {};
      const result = await resolveValue(voidFunction);
      expect(result).toBe(undefined);
    });
  });

  describe("Error Conditions", () => {
    it("Handles function that throws error", async () => {
      const errorFunction = () => {
        throw new Error("Function error");
      };
      await expect(resolveValue(errorFunction)).rejects.toThrow(
        "Function error",
      );
    });

    it("Handles async function that rejects", async () => {
      const rejectFunction = async () => {
        throw new Error("Async error");
      };
      await expect(resolveValue(rejectFunction)).rejects.toThrow("Async error");
    });
  });
});
