import { describe, it, expect, vi } from "vitest";
import { time } from "../time.js";

describe("time tool", () => {
  it("should have the correct properties", () => {
    expect(time).toHaveProperty("name", "time");
    expect(time).toHaveProperty("description");
    expect(time).toHaveProperty("parameters");
    expect(time).toHaveProperty("type", "function");
    expect(time).toHaveProperty("call");
  });

  it("should return current time when no date is provided", () => {
    // Mock current date
    const mockDate = new Date("2025-03-20T21:16:05Z");
    const originalDate = global.Date;
    global.Date = vi.fn(() => mockDate) as unknown as DateConstructor;
    global.Date.UTC = originalDate.UTC;
    global.Date.parse = originalDate.parse;
    global.Date.now = vi.fn(() => mockDate.getTime());

    try {
      const result = time.call();
      expect(result).toBe("2025-03-20T21:16:05.000Z");
    } finally {
      // Restore original Date
      global.Date = originalDate;
    }
  });

  it("should convert provided date to ISO UTC string", () => {
    // Create a date with a specific UTC time
    const testDate = new Date(Date.UTC(2023, 0, 15, 12, 30, 45));
    const result = time.call({ date: testDate.toISOString() });
    expect(result).toBe("2023-01-15T12:30:45.000Z");
  });

  it("should throw error for invalid date format", () => {
    expect(() => time.call({ date: "invalid-date" })).toThrow(
      "Invalid date format: invalid-date",
    );
  });
});
