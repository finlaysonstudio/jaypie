import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import invokeChaos from "../invokeChaos.function.js";

//
//
// Mock
//

vi.mock("../sleep.function.js", () => ({
  default: vi.fn(),
}));

// Mock process.exit to prevent test runner from exiting

//
//
// Run Tests
//

describe("invokeChaos", () => {
  let mockProcessExit;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Math.random for each test
    vi.spyOn(Math, "random");
    // Mock process.exit for each test
    mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Base Cases
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(invokeChaos).toBeFunction();
    });

    it("returns a promise", () => {
      const result = invokeChaos();
      expect(result).toBeInstanceOf(Promise);
    });
  });

  // Error Conditions
  describe("Error Conditions", () => {
    it("handles invalid input gracefully", async () => {
      // No specific error conditions for this function
      // Function should handle all inputs without throwing
      await expect(invokeChaos(null)).resolves.toBeUndefined();
      await expect(invokeChaos(undefined)).resolves.toBeUndefined();
    });

    it("throws 500 error when message is 'error'", async () => {
      await expect(invokeChaos("error")).rejects.toThrow();
      try {
        await invokeChaos("error");
      } catch (error) {
        expect(error.status).toBe(500);
      }
    });

    it("throws specific status code when message is 'error=404'", async () => {
      await expect(invokeChaos("error=404")).rejects.toThrow();
      try {
        await invokeChaos("error=404");
      } catch (error) {
        expect(error.status).toBe(404);
      }
    });

    it("throws specific status code when message is 'error=403'", async () => {
      await expect(invokeChaos("error=403")).rejects.toThrow();
      try {
        await invokeChaos("error=403");
      } catch (error) {
        expect(error.status).toBe(403);
      }
    });

    it("throws specific status code when message is 'error=502'", async () => {
      await expect(invokeChaos("error=502")).rejects.toThrow();
      try {
        await invokeChaos("error=502");
      } catch (error) {
        expect(error.status).toBe(502);
      }
    });

    it("handles timeout case with 15-minute sleep then 500 error", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      await expect(invokeChaos("timeout")).rejects.toThrow();
      expect(sleep).toHaveBeenCalledWith(15 * 60 * 1000); // 15 minutes in ms
      try {
        await invokeChaos("timeout");
      } catch (error) {
        expect(error.status).toBe(500);
      }
    });

    it("calls process.exit(1) when message is 'exit'", async () => {
      await expect(invokeChaos("exit")).rejects.toThrow("process.exit called");
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("attempts to exhaust memory when message is 'memory'", async () => {
      // Mock Array constructor to prevent actual memory exhaustion
      const originalArray = global.Array;
      let arrayCallCount = 0;
      global.Array = new Proxy(originalArray, {
        construct(target, args) {
          arrayCallCount++;
          // After a few iterations, throw to prevent infinite loop in tests
          if (arrayCallCount > 3) {
            throw new Error("Out of memory");
          }
          // Return small array instead of large one
          return new originalArray(10);
        },
      });

      await expect(invokeChaos("memory")).rejects.toThrow("Out of memory");
      expect(arrayCallCount).toBeGreaterThan(3);

      // Restore original Array
      global.Array = originalArray;
    });
  });

  // Security
  describe("Security", () => {
    it("does not expose internal constants", () => {
      expect(invokeChaos.CHAOS_RATE_HIGH).toBeUndefined();
      expect(invokeChaos.CHAOS_RATE_MEDIUM).toBeUndefined();
      expect(invokeChaos.CHAOS_RATE_LOW).toBeUndefined();
    });
  });

  // Observability
  describe("Observability", () => {
    it("is properly observable", () => {
      // No specific observability requirements
      // Function name should be accessible for debugging
      expect(invokeChaos.name).toBe("invokeChaos");
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    it("does nothing when message is 'false'", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      await invokeChaos("false");
      expect(sleep).not.toHaveBeenCalled();
    });

    it("does nothing when message is '0'", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      await invokeChaos("0");
      expect(sleep).not.toHaveBeenCalled();
    });

    it("does nothing when message is 'none'", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      await invokeChaos("none");
      expect(sleep).not.toHaveBeenCalled();
    });

    it("does nothing when message is 'off'", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      await invokeChaos("off");
      expect(sleep).not.toHaveBeenCalled();
    });

    it("does nothing when message is empty string", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      await invokeChaos("");
      expect(sleep).not.toHaveBeenCalled();
    });

    it("sleeps when random value is below high rate (0.382)", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      Math.random = vi.fn().mockReturnValueOnce(0.3).mockReturnValueOnce(0.5);
      await invokeChaos("high");
      expect(sleep).toHaveBeenCalledExactlyOnceWith(expect.any(Number));
      const sleepDuration = sleep.mock.calls[0][0];
      expect(sleepDuration).toBeGreaterThanOrEqual(0);
      expect(sleepDuration).toBeLessThanOrEqual(12000);
    });

    it("sleeps when random value is below medium rate (0.146)", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      Math.random = vi.fn().mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);
      await invokeChaos("medium");
      expect(sleep).toHaveBeenCalledExactlyOnceWith(expect.any(Number));
      const sleepDuration = sleep.mock.calls[0][0];
      expect(sleepDuration).toBeGreaterThanOrEqual(0);
      expect(sleepDuration).toBeLessThanOrEqual(12000);
    });

    it("sleeps when random value is below low rate (0.021)", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      Math.random = vi.fn().mockReturnValueOnce(0.01).mockReturnValueOnce(0.5);
      await invokeChaos("low");
      expect(sleep).toHaveBeenCalledExactlyOnceWith(expect.any(Number));
      const sleepDuration = sleep.mock.calls[0][0];
      expect(sleepDuration).toBeGreaterThanOrEqual(0);
      expect(sleepDuration).toBeLessThanOrEqual(12000);
    });

    it("does not sleep when random value is above high rate", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      Math.random = vi.fn().mockReturnValue(0.4);
      await invokeChaos("high");
      expect(sleep).not.toHaveBeenCalled();
    });

    it("does not sleep when random value is above medium rate", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      Math.random = vi.fn().mockReturnValue(0.2);
      await invokeChaos("medium");
      expect(sleep).not.toHaveBeenCalled();
    });

    it("does not sleep when random value is above low rate", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      Math.random = vi.fn().mockReturnValue(0.03);
      await invokeChaos("low");
      expect(sleep).not.toHaveBeenCalled();
    });
  });

  // Features
  describe("Features", () => {
    it("always sleeps when message is 'always'", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      Math.random = vi.fn().mockReturnValue(0.5); // For sleep duration
      await invokeChaos("always");
      expect(sleep).toHaveBeenCalledExactlyOnceWith(6000); // 0.5 * 12000
    });

    it("defaults to medium when no message is provided", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      Math.random = vi.fn().mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);
      await invokeChaos();
      expect(sleep).toHaveBeenCalledOnce();
    });

    it("treats unknown values as medium", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      Math.random = vi.fn().mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);
      await invokeChaos("unknown");
      expect(sleep).toHaveBeenCalledOnce();
    });

    it("treats numeric values other than 0 as medium", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      Math.random = vi.fn().mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);
      await invokeChaos("123");
      expect(sleep).toHaveBeenCalledOnce();
    });

    it("calculates sleep duration within expected range", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      // Mock Math.random to return specific values
      Math.random = vi
        .fn()
        .mockReturnValueOnce(0.01) // For chaos trigger
        .mockReturnValueOnce(0.75); // For sleep duration calculation
      await invokeChaos("high");
      expect(sleep).toHaveBeenCalledOnce();
      const sleepDuration = sleep.mock.calls[0][0];
      // 0.75 * (12000 - 0) + 0 = 9000
      expect(sleepDuration).toBeCloseTo(9000, 1);
    });
  });

  // Specific Scenarios
  describe("Specific Scenarios", () => {
    it("handles case sensitivity correctly", async () => {
      const sleep = (await import("../sleep.function.js")).default;

      // "HIGH" should be treated as medium (unknown value)
      Math.random = vi.fn().mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);
      await invokeChaos("HIGH");
      expect(sleep).toHaveBeenCalledOnce();

      vi.clearAllMocks();

      // "Low" should be treated as medium (unknown value)
      Math.random = vi.fn().mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);
      await invokeChaos("Low");
      expect(sleep).toHaveBeenCalledOnce();
    });

    it("handles minimum sleep duration correctly", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      Math.random = vi
        .fn()
        .mockReturnValueOnce(0.01) // Trigger chaos
        .mockReturnValueOnce(0); // Minimum sleep duration
      await invokeChaos("high");
      expect(sleep).toHaveBeenCalledWith(0);
    });

    it("handles maximum sleep duration correctly", async () => {
      const sleep = (await import("../sleep.function.js")).default;
      Math.random = vi
        .fn()
        .mockReturnValueOnce(0.01) // Trigger chaos
        .mockReturnValueOnce(1); // Maximum sleep duration
      await invokeChaos("high");
      expect(sleep).toHaveBeenCalledWith(12000);
    });
  });
});
