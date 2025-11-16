import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uuidFrom } from "./uuidFrom.js";

describe("uuidFrom", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });
  // Base Cases
  describe("Base Cases", () => {
    it("should generate a UUID from a string", () => {
      const result = uuidFrom("test-string");
      expect(typeof result).toBe("string");
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should generate a UUID from a number", () => {
      const result = uuidFrom(12345);
      expect(typeof result).toBe("string");
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should generate a UUID from an empty string", () => {
      const result = uuidFrom("");
      expect(typeof result).toBe("string");
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should generate a UUID from zero", () => {
      const result = uuidFrom(0);
      expect(typeof result).toBe("string");
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    it("should be deterministic for the same string", () => {
      const result1 = uuidFrom("my-entity");
      const result2 = uuidFrom("my-entity");
      expect(result1).toBe(result2);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should be deterministic for the same number", () => {
      const result1 = uuidFrom(12345);
      const result2 = uuidFrom(12345);
      expect(result1).toBe(result2);
    });

    it("should generate different UUIDs for different strings", () => {
      const result1 = uuidFrom("entity-1");
      const result2 = uuidFrom("entity-2");
      expect(result1).not.toBe(result2);
    });

    it("should generate different UUIDs for different numbers", () => {
      const result1 = uuidFrom(1);
      const result2 = uuidFrom(2);
      expect(result1).not.toBe(result2);
    });
  });

  // Features
  describe("Features", () => {
    it("should generate UUID v5 format", () => {
      const result = uuidFrom("test");
      // UUID v5 has version 5 in the version field (position 14, value '5')
      expect(result.charAt(14)).toBe("5");
    });

    it("should handle special characters in strings", () => {
      const result = uuidFrom("test@example.com");
      expect(typeof result).toBe("string");
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should handle very long strings", () => {
      const longString = "a".repeat(10000);
      const result = uuidFrom(longString);
      expect(typeof result).toBe("string");
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should handle negative numbers", () => {
      const result = uuidFrom(-12345);
      expect(typeof result).toBe("string");
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should handle decimal numbers", () => {
      const result = uuidFrom(123.456);
      expect(typeof result).toBe("string");
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  // Specific Scenarios
  describe("Specific Scenarios", () => {
    it("should treat number and string representation differently", () => {
      const numResult = uuidFrom(123);
      const strResult = uuidFrom("123");
      expect(numResult).toBe(strResult); // They're converted to same string
    });

    it("should return UUID input unchanged and log warning", () => {
      const inputUuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = uuidFrom(inputUuid);

      // Should return the same UUID
      expect(result).toBe(inputUuid);

      // Should have logged a warning
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `[uuidFrom] Input is already a UUID: ${inputUuid}. Returning input unchanged.`,
      );
    });

    it("should handle uppercase UUID input", () => {
      const inputUuid = "550E8400-E29B-41D4-A716-446655440000";
      const result = uuidFrom(inputUuid);

      expect(result).toBe(inputUuid);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("should consistently map common entity names", () => {
      const userId = uuidFrom("user");
      const productId = uuidFrom("product");
      const orderId = uuidFrom("order");

      expect(userId).not.toBe(productId);
      expect(userId).not.toBe(orderId);
      expect(productId).not.toBe(orderId);

      // Should be reproducible
      expect(uuidFrom("user")).toBe(userId);
      expect(uuidFrom("product")).toBe(productId);
      expect(uuidFrom("order")).toBe(orderId);
    });

    it("should handle whitespace in strings", () => {
      const result1 = uuidFrom("hello world");
      const result2 = uuidFrom("helloworld");
      expect(result1).not.toBe(result2); // Whitespace matters
    });
  });
});
