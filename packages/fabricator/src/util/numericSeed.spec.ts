import { describe, it, expect } from "vitest";
import numericSeed from "./numericSeed.js";

describe("numericSeed", () => {
  it("should return absolute value for numeric input", () => {
    expect(numericSeed(42)).toBe(42);
    expect(numericSeed(-42)).toBe(42);
  });

  it("should convert string to numeric value", () => {
    const result = numericSeed("test-string");
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(0);
  });

  it("should produce same result for same string", () => {
    const seed = "test-string";
    const result1 = numericSeed(seed);
    const result2 = numericSeed(seed);
    expect(result1).toBe(result2);
  });

  it("should produce different results for different strings", () => {
    const result1 = numericSeed("string1");
    const result2 = numericSeed("string2");
    expect(result1).not.toBe(result2);
  });

  it("should handle UUID format using uuidToNumber", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result = numericSeed(uuid);
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(0);
  });

  it("should produce consistent results for UUIDs", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result1 = numericSeed(uuid);
    const result2 = numericSeed(uuid);
    expect(result1).toBe(result2);
  });

  it("should handle empty strings", () => {
    const result = numericSeed("");
    expect(typeof result).toBe("number");
    expect(result).toBe(0);
  });

  it("should always return positive numbers", () => {
    const result1 = numericSeed("test");
    const result2 = numericSeed(-100);
    const result3 = numericSeed("550e8400-e29b-41d4-a716-446655440000");

    expect(result1).toBeGreaterThanOrEqual(0);
    expect(result2).toBeGreaterThanOrEqual(0);
    expect(result3).toBeGreaterThanOrEqual(0);
  });
});
