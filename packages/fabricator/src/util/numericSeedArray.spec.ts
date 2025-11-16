import { describe, it, expect } from "vitest";
import numericSeedArray from "./numericSeedArray.js";

describe("numericSeedArray", () => {
  it("should return single-element array for non-UUID string", () => {
    const result = numericSeedArray("test-string");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(typeof result[0]).toBe("number");
  });

  it("should return 16-element array for valid UUID", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result = numericSeedArray(uuid);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(16);
  });

  it("should produce same result for same input", () => {
    const seed = "test-string";
    const result1 = numericSeedArray(seed);
    const result2 = numericSeedArray(seed);
    expect(result1).toEqual(result2);
  });

  it("should produce same result for same UUID", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result1 = numericSeedArray(uuid);
    const result2 = numericSeedArray(uuid);
    expect(result1).toEqual(result2);
  });

  it("should produce different results for different strings", () => {
    const result1 = numericSeedArray("string1");
    const result2 = numericSeedArray("string2");
    expect(result1).not.toEqual(result2);
  });

  it("should produce different results for different UUIDs", () => {
    const uuid1 = "550e8400-e29b-41d4-a716-446655440000";
    const uuid2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    const result1 = numericSeedArray(uuid1);
    const result2 = numericSeedArray(uuid2);
    expect(result1).not.toEqual(result2);
  });

  it("should handle empty strings", () => {
    const result = numericSeedArray("");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
  });

  it("should handle case-insensitive UUIDs", () => {
    const uuid1 = "550e8400-e29b-41d4-a716-446655440000";
    const uuid2 = "550E8400-E29B-41D4-A716-446655440000";
    const result1 = numericSeedArray(uuid1);
    const result2 = numericSeedArray(uuid2);
    // Should both be recognized as UUIDs and produce 16-byte arrays
    expect(result1.length).toBe(16);
    expect(result2.length).toBe(16);
  });

  it("should return all numeric values", () => {
    const result1 = numericSeedArray("test");
    const result2 = numericSeedArray("550e8400-e29b-41d4-a716-446655440000");

    result1.forEach((val) => expect(typeof val).toBe("number"));
    result2.forEach((val) => expect(typeof val).toBe("number"));
  });
});
