import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  setupMockEnvironment,
  teardownMockEnvironment,
} from "../../src/mock/setup";

describe("Mock Setup", () => {
  const originalEnv = { ...process.env };
  const mockBeforeEach = vi.fn();
  const mockAfterEach = vi.fn();

  // Save original functions
  const originalBeforeEach = global.beforeEach;
  const originalAfterEach = global.afterEach;

  beforeEach(() => {
    // Mock global hooks
    global.beforeEach = mockBeforeEach;
    global.afterEach = mockAfterEach;

    // Reset mocks
    mockBeforeEach.mockReset();
    mockAfterEach.mockReset();
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };

    // Restore global hooks
    global.beforeEach = originalBeforeEach;
    global.afterEach = originalAfterEach;
  });

  describe("setupMockEnvironment", () => {
    it("should set environment variables", () => {
      setupMockEnvironment();

      expect(process.env.STAGE).toBe("test");
      expect(process.env.NODE_ENV).toBe("test");
    });

    it("should register beforeEach hook", () => {
      setupMockEnvironment();

      expect(mockBeforeEach).toHaveBeenCalledTimes(1);

      // Execute the registered callback
      const callback = mockBeforeEach.mock.calls[0][0];
      callback();

      // Verify the callback clears mocks
      expect(vi.clearAllMocks).toHaveBeenCalled();
    });

    it("should register afterEach hook", () => {
      setupMockEnvironment();

      expect(mockAfterEach).toHaveBeenCalledTimes(1);

      // Execute the registered callback
      const callback = mockAfterEach.mock.calls[0][0];
      callback();

      // Verify the callback resets modules
      expect(vi.resetModules).toHaveBeenCalled();
    });
  });

  describe("teardownMockEnvironment", () => {
    it("should restore all mocks", () => {
      teardownMockEnvironment();

      expect(vi.restoreAllMocks).toHaveBeenCalled();
    });
  });
});
