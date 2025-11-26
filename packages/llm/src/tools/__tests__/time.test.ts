import { describe, it, expect, vi } from "vitest";
import { time } from "../time.js";

describe("time tool", () => {
  it("should have the correct properties", () => {
    expect(time).toHaveProperty("name", "time");
    expect(time).toHaveProperty("description");
    expect(time).toHaveProperty("parameters");
    expect(time).toHaveProperty("type", "function");
    expect(time).toHaveProperty("call");
    expect(time).toHaveProperty("message");
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

  describe("Message Functionality", () => {
    it("returns correct message when no date is provided", () => {
      const message =
        typeof time.message === "function" ? time.message() : time.message;
      expect(message).toBe("Checking current time");
    });

    it("returns correct message when no date is provided with empty object", () => {
      const message =
        typeof time.message === "function" ? time.message({}) : time.message;
      expect(message).toBe("Checking current time");
    });

    it("returns correct message when date is provided as string", () => {
      const message =
        typeof time.message === "function"
          ? time.message({ date: "2025-01-15T12:30:45Z" })
          : time.message;
      expect(message).toBe("Converting date to ISO UTC format");
    });

    it("returns correct message when date is provided as number", () => {
      const message =
        typeof time.message === "function"
          ? time.message({ date: 1705318245000 })
          : time.message;
      expect(message).toBe("Converting date to ISO UTC format");
    });
  });
});
