import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RetryExecutor, ErrorClassifier } from "../RetryExecutor.js";
import { RetryPolicy } from "../RetryPolicy.js";

//
//
// Mock
//

vi.mock("@jaypie/core", () => ({
  resolveValue: vi.fn(async (value) => {
    if (value instanceof Promise) {
      return await value;
    }
    return value;
  }),
  sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@jaypie/errors", () => ({
  BadGatewayError: class BadGatewayError extends Error {
    constructor() {
      super("Bad Gateway");
      this.name = "BadGatewayError";
    }
  },
}));

vi.mock("../../../util/index.js", () => ({
  log: {
    debug: vi.fn(),
    error: vi.fn(),
    var: vi.fn(),
    warn: vi.fn(),
  },
}));

//
//
// Test Setup
//

class RetryableError extends Error {
  constructor() {
    super("Retryable");
    this.name = "RetryableError";
  }
}

class NonRetryableError extends Error {
  constructor() {
    super("Non-retryable");
    this.name = "NonRetryableError";
  }
}

const createTestErrorClassifier = (): ErrorClassifier => ({
  isRetryable: (error: unknown) => error instanceof RetryableError,
  isKnownError: (error: unknown) =>
    error instanceof RetryableError || error instanceof NonRetryableError,
});

//
//
// Tests
//

describe("RetryExecutor", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("exports RetryExecutor class", () => {
      expect(RetryExecutor).toBeDefined();
      expect(typeof RetryExecutor).toBe("function");
    });

    it("can be instantiated with required config", () => {
      const executor = new RetryExecutor({
        errorClassifier: createTestErrorClassifier(),
      });
      expect(executor).toBeInstanceOf(RetryExecutor);
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    let executor: RetryExecutor;
    const mockContext = {
      input: "test",
      options: {},
      providerRequest: {},
    };

    beforeEach(() => {
      executor = new RetryExecutor({
        errorClassifier: createTestErrorClassifier(),
        policy: new RetryPolicy({ maxRetries: 3 }),
      });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("returns result on successful operation", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await executor.execute(operation, {
        context: mockContext,
      });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("retries on retryable error and succeeds", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new RetryableError())
        .mockRejectedValueOnce(new RetryableError())
        .mockResolvedValue("success");

      const result = await executor.execute(operation, {
        context: mockContext,
      });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  // Error Conditions
  describe("Error Conditions", () => {
    let executor: RetryExecutor;
    const mockContext = {
      input: "test",
      options: {},
      providerRequest: {},
    };

    beforeEach(() => {
      executor = new RetryExecutor({
        errorClassifier: createTestErrorClassifier(),
        policy: new RetryPolicy({ maxRetries: 3 }),
      });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("throws BadGatewayError on non-retryable error", async () => {
      const operation = vi.fn().mockRejectedValue(new NonRetryableError());

      await expect(
        executor.execute(operation, { context: mockContext }),
      ).rejects.toThrow("Bad Gateway");

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("throws BadGatewayError after exhausting retries", async () => {
      const operation = vi.fn().mockRejectedValue(new RetryableError());

      await expect(
        executor.execute(operation, { context: mockContext }),
      ).rejects.toThrow("Bad Gateway");

      // Initial attempt + 3 retries
      expect(operation).toHaveBeenCalledTimes(4);
    });
  });

  // Features
  describe("Features", () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it("calls hooks on retryable error", async () => {
      const onRetryableModelError = vi.fn();
      const executor = new RetryExecutor({
        errorClassifier: createTestErrorClassifier(),
        policy: new RetryPolicy({ maxRetries: 1 }),
      });

      const operation = vi
        .fn()
        .mockRejectedValueOnce(new RetryableError())
        .mockResolvedValue("success");

      await executor.execute(operation, {
        context: { input: "test", providerRequest: {} },
        hooks: { onRetryableModelError },
      });

      expect(onRetryableModelError).toHaveBeenCalled();
    });

    it("calls hooks on unrecoverable error (exhausted retries)", async () => {
      const onUnrecoverableModelError = vi.fn();
      const executor = new RetryExecutor({
        errorClassifier: createTestErrorClassifier(),
        policy: new RetryPolicy({ maxRetries: 0 }),
      });

      const operation = vi.fn().mockRejectedValue(new RetryableError());

      await expect(
        executor.execute(operation, {
          context: { input: "test", providerRequest: {} },
          hooks: { onUnrecoverableModelError },
        }),
      ).rejects.toThrow();

      expect(onUnrecoverableModelError).toHaveBeenCalled();
    });

    it("calls hooks on unrecoverable error (non-retryable)", async () => {
      const onUnrecoverableModelError = vi.fn();
      const executor = new RetryExecutor({
        errorClassifier: createTestErrorClassifier(),
        policy: new RetryPolicy({ maxRetries: 5 }),
      });

      const operation = vi.fn().mockRejectedValue(new NonRetryableError());

      await expect(
        executor.execute(operation, {
          context: { input: "test", providerRequest: {} },
          hooks: { onUnrecoverableModelError },
        }),
      ).rejects.toThrow();

      expect(onUnrecoverableModelError).toHaveBeenCalled();
    });

    it("accepts custom retry policy", async () => {
      const customPolicy = new RetryPolicy({ maxRetries: 1 });
      const executor = new RetryExecutor({
        errorClassifier: createTestErrorClassifier(),
        policy: customPolicy,
      });

      const operation = vi.fn().mockRejectedValue(new RetryableError());

      await expect(
        executor.execute(operation, {
          context: { input: "test", providerRequest: {} },
        }),
      ).rejects.toThrow();

      // Initial attempt + 1 retry
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});
