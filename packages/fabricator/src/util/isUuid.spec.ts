import { describe, it, expect } from "vitest";
import isUuid from "./isUuid.js";

describe("isUuid", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("should return true for valid UUID v4", () => {
      expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(isUuid("")).toBe(false);
    });

    it("should return false for non-UUID string", () => {
      expect(isUuid("not-a-uuid")).toBe(false);
    });

    it("should return false for random text", () => {
      expect(isUuid("hello world")).toBe(false);
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    it("should validate UUID v1", () => {
      expect(isUuid("c9a646d3-9c61-11ec-b909-0242ac120002")).toBe(true);
    });

    it("should validate UUID v3", () => {
      expect(isUuid("a3bb189e-8bf9-3888-9912-ace4e6543002")).toBe(true);
    });

    it("should validate UUID v4", () => {
      expect(isUuid("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
    });

    it("should validate UUID v5", () => {
      expect(isUuid("886313e1-3b8a-5372-9b90-0c9aee199e5d")).toBe(true);
    });

    it("should be case insensitive", () => {
      expect(isUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
      expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(isUuid("550E8400-e29b-41D4-a716-446655440000")).toBe(true);
    });
  });

  // Error Conditions
  describe("Error Conditions", () => {
    it("should reject UUID without hyphens", () => {
      expect(isUuid("550e8400e29b41d4a716446655440000")).toBe(false);
    });

    it("should reject UUID with wrong segment lengths", () => {
      expect(isUuid("550e840-e29b-41d4-a716-446655440000")).toBe(false);
      expect(isUuid("550e8400-e29-41d4-a716-446655440000")).toBe(false);
      expect(isUuid("550e8400-e29b-41d-a716-446655440000")).toBe(false);
      expect(isUuid("550e8400-e29b-41d4-a71-446655440000")).toBe(false);
      expect(isUuid("550e8400-e29b-41d4-a716-44665544000")).toBe(false);
    });

    it("should reject UUID with invalid characters", () => {
      expect(isUuid("550g8400-e29b-41d4-a716-446655440000")).toBe(false);
      expect(isUuid("550e8400-x29b-41d4-a716-446655440000")).toBe(false);
      expect(isUuid("550e8400-e29b-41d4-z716-446655440000")).toBe(false);
    });

    it("should reject UUID with extra characters", () => {
      expect(isUuid("550e8400-e29b-41d4-a716-446655440000x")).toBe(false);
      expect(isUuid("x550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    });

    it("should reject UUID with spaces", () => {
      expect(isUuid("550e8400 e29b-41d4-a716-446655440000")).toBe(false);
      expect(isUuid(" 550e8400-e29b-41d4-a716-446655440000")).toBe(false);
      expect(isUuid("550e8400-e29b-41d4-a716-446655440000 ")).toBe(false);
    });
  });

  // Features
  describe("Features", () => {
    it("should handle all lowercase", () => {
      expect(isUuid("abcdef00-1234-5678-9abc-def012345678")).toBe(true);
    });

    it("should handle all uppercase", () => {
      expect(isUuid("ABCDEF00-1234-5678-9ABC-DEF012345678")).toBe(true);
    });

    it("should handle all zeros", () => {
      expect(isUuid("00000000-0000-0000-0000-000000000000")).toBe(true);
    });

    it("should handle all fs", () => {
      expect(isUuid("ffffffff-ffff-ffff-ffff-ffffffffffff")).toBe(true);
    });
  });

  // Specific Scenarios
  describe("Specific Scenarios", () => {
    it("should reject partial UUID", () => {
      expect(isUuid("550e8400-e29b")).toBe(false);
    });

    it("should reject numeric-only string", () => {
      expect(isUuid("12345")).toBe(false);
    });

    it("should reject URL with UUID in it", () => {
      expect(
        isUuid("https://example.com/550e8400-e29b-41d4-a716-446655440000"),
      ).toBe(false);
    });

    it("should reject curly-braced UUID", () => {
      expect(isUuid("{550e8400-e29b-41d4-a716-446655440000}")).toBe(false);
    });

    it("should reject NIL UUID variant", () => {
      // NIL UUID is valid format-wise
      expect(isUuid("00000000-0000-0000-0000-000000000000")).toBe(true);
    });
  });
});
