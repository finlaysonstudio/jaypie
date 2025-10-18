import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { restoreLog, spyLog } from "@jaypie/testkit";
import { roll } from "../roll.js";
import * as util from "../../util";

const log = util.log;

beforeEach(async () => {
  spyLog(log);
});

afterEach(() => {
  vi.clearAllMocks();
  restoreLog(log);
});

describe("roll tool", () => {
  describe("Base Cases", () => {
    it("has the correct properties", () => {
      expect(roll).toHaveProperty("name", "roll");
      expect(roll).toHaveProperty("description");
      expect(roll).toHaveProperty("parameters");
      expect(roll).toHaveProperty("type", "function");
      expect(roll).toHaveProperty("call");
      expect(roll).toHaveProperty("message");
    });

    it("works with default parameters", () => {
      // Create a mock function that will be returned by the random function
      const mockRandomFn = vi.fn().mockReturnValue(3);
      // Mock the random module's named export to return our mock function
      vi.spyOn(util, "random").mockImplementation(() => mockRandomFn);

      const result = roll.call({});

      expect(result).toBeDefined();
      expect(result).toEqual({
        rolls: [3],
        total: 3,
      });

      // Verify our mock function was called with the correct parameters
      expect(mockRandomFn).toHaveBeenCalledWith({
        min: 1,
        max: 6,
        integer: true,
      });

      vi.restoreAllMocks();
    });
  });

  describe("Message Functionality", () => {
    it("returns correct message with default parameters", () => {
      const message = typeof roll.message === "function" ? roll.message({}) : roll.message;
      expect(message).toBe("Rolling 1 6-sided dice");
    });

    it("returns correct message with specified parameters", () => {
      const message = typeof roll.message === "function" ? roll.message({ number: 3, sides: 20 }) : roll.message;
      expect(message).toBe("Rolling 3 20-sided dice");
    });

    it("returns correct message with no parameters", () => {
      const message = typeof roll.message === "function" ? roll.message() : roll.message;
      expect(message).toBe("Rolling 1 6-sided dice");
    });
  });

  describe("Observability", () => {
    it("warns when number is not a number", () => {
      // Reset mock counts before test
      vi.clearAllMocks();
      expect(log.warn).not.toHaveBeenCalled();

      roll.call({ number: "a" });

      expect(log.warn).toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe("Happy Paths", () => {
    it("rolls a single die with specified sides", () => {
      // Create a mock function that will be returned by the random function
      const mockRandomFn = vi.fn().mockReturnValue(4);
      // Mock the random module's named export to return our mock function
      vi.spyOn(util, "random").mockImplementation(() => mockRandomFn);

      const result = roll.call({ number: 1, sides: 8 });

      expect(result).toEqual({
        rolls: [4],
        total: 4,
      });

      // Verify our mock function was called with the correct parameters
      expect(mockRandomFn).toHaveBeenCalledWith({
        min: 1,
        max: 8,
        integer: true,
      });

      vi.restoreAllMocks();
    });

    it("rolls multiple dice and calculates total correctly", () => {
      // Create a mock function that returns sequential values
      const mockValues = [2, 5, 1];
      let callCount = 0;
      const mockRandomFn = vi
        .fn()
        .mockImplementation(() => mockValues[callCount++]);
      // Mock the random module's named export to return our mock function
      vi.spyOn(util, "random").mockImplementation(() => mockRandomFn);

      const result = roll.call({ number: 3, sides: 6 });

      expect(result).toEqual({
        rolls: [2, 5, 1],
        total: 8, // 2 + 5 + 1 = 8
      });

      // Verify our mock function was called the correct number of times
      expect(mockRandomFn).toHaveBeenCalledTimes(3);
      // Verify each call had the correct parameters
      expect(mockRandomFn).toHaveBeenNthCalledWith(1, {
        min: 1,
        max: 6,
        integer: true,
      });
      expect(mockRandomFn).toHaveBeenNthCalledWith(2, {
        min: 1,
        max: 6,
        integer: true,
      });
      expect(mockRandomFn).toHaveBeenNthCalledWith(3, {
        min: 1,
        max: 6,
        integer: true,
      });

      vi.restoreAllMocks();
    });
  });

  describe("Features", () => {
    it("handles large number of dice", () => {
      // Create a mock function that will be returned by the random function
      const mockRandomFn = vi.fn().mockReturnValue(3);
      // Mock the random module's named export to return our mock function
      vi.spyOn(util, "random").mockImplementation(() => mockRandomFn);

      const result = roll.call({
        number: 100,
        sides: 6,
      }) as { rolls: number[]; total: number } | undefined;

      expect(result?.rolls).toHaveLength(100);
      expect(result?.rolls).toEqual(Array(100).fill(3));
      expect(result?.total).toBe(300); // 100 * 3 = 300

      // Verify our mock function was called the correct number of times
      expect(mockRandomFn).toHaveBeenCalledTimes(100);
      // Verify the first call had the correct parameters
      expect(mockRandomFn).toHaveBeenNthCalledWith(1, {
        min: 1,
        max: 6,
        integer: true,
      });

      vi.restoreAllMocks();
    });

    it("handles dice with many sides", () => {
      // Create a mock function that will be returned by the random function
      const mockRandomFn = vi.fn().mockReturnValue(42);
      // Mock the random module's named export to return our mock function
      vi.spyOn(util, "random").mockImplementation(() => mockRandomFn);

      const result = roll.call({ number: 1, sides: 100 });

      expect(result).toEqual({
        rolls: [42],
        total: 42,
      });

      // Verify our mock function was called with the correct parameters
      expect(mockRandomFn).toHaveBeenCalledWith({
        min: 1,
        max: 100,
        integer: true,
      });

      vi.restoreAllMocks();
    });
  });

  describe("Specific Scenarios", () => {
    it("handles zero dice gracefully", () => {
      // Create a mock function that will be returned by the random function
      const mockRandomFn = vi.fn();
      // Mock the random module's named export to return our mock function
      vi.spyOn(util, "random").mockImplementation(() => mockRandomFn);

      const result = roll.call({ number: 0, sides: 6 });

      expect(result).toEqual({
        rolls: [],
        total: 0,
      });

      // Verify our mock function was not called
      expect(mockRandomFn).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it("uses correct random number generation parameters", () => {
      // Create a mock function that will be returned by the random function
      const mockRandomFn = vi.fn().mockReturnValue(3);
      // Mock the random module's named export to return our mock function
      vi.spyOn(util, "random").mockImplementation(() => mockRandomFn);

      roll.call({ number: 1, sides: 20 });

      // Verify our mock function was called with the correct parameters
      expect(mockRandomFn).toHaveBeenCalledWith({
        min: 1,
        max: 20,
        integer: true,
      });

      vi.restoreAllMocks();
    });
  });
});
