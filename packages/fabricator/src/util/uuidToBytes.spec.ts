import { describe, it, expect } from "vitest";
import uuidToBytes from "./uuidToBytes.js";

describe("uuidToBytes", () => {
  it("should return [0] for empty string", () => {
    expect(uuidToBytes("")).toEqual([0]);
  });

  it("should convert UUID to array of 16 bytes", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result = uuidToBytes(uuid);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(16);
  });

  it("should produce same result for same UUID", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result1 = uuidToBytes(uuid);
    const result2 = uuidToBytes(uuid);
    expect(result1).toEqual(result2);
  });

  it("should produce different results for different UUIDs", () => {
    const uuid1 = "550e8400-e29b-41d4-a716-446655440000";
    const uuid2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    const result1 = uuidToBytes(uuid1);
    const result2 = uuidToBytes(uuid2);
    expect(result1).not.toEqual(result2);
  });

  it("should return array of numbers between 0-255", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result = uuidToBytes(uuid);
    result.forEach((byte) => {
      expect(byte).toBeGreaterThanOrEqual(0);
      expect(byte).toBeLessThanOrEqual(255);
      expect(Number.isInteger(byte)).toBe(true);
    });
  });
});
