import { describe, it, expect } from "vitest";
import uuidToNumber from "./uuidToNumber.js";

describe("uuidToNumber", () => {
  it("should return 0 for empty string", () => {
    expect(uuidToNumber("")).toBe(0);
  });

  it("should convert UUID to numeric value", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result = uuidToNumber(uuid);
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(0);
  });

  it("should produce same result for same UUID", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result1 = uuidToNumber(uuid);
    const result2 = uuidToNumber(uuid);
    expect(result1).toBe(result2);
  });

  it("should produce different results for different UUIDs", () => {
    const uuid1 = "550e8400-e29b-41d4-a716-446655440000";
    const uuid2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    const result1 = uuidToNumber(uuid1);
    const result2 = uuidToNumber(uuid2);
    expect(result1).not.toBe(result2);
  });

  it("should stay within safe integer range", () => {
    const uuid = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    const result = uuidToNumber(uuid);
    expect(result).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });
});
