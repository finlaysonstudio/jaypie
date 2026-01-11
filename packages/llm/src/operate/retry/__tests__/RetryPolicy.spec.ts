import { describe, expect, it } from "vitest";

import {
  DEFAULT_BACKOFF_FACTOR,
  DEFAULT_INITIAL_DELAY_MS,
  DEFAULT_MAX_DELAY_MS,
  DEFAULT_MAX_RETRIES,
  defaultRetryPolicy,
  MAX_RETRIES_ABSOLUTE_LIMIT,
  RetryPolicy,
} from "../RetryPolicy.js";

//
//
// Tests
//

describe("RetryPolicy", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("exports RetryPolicy class", () => {
      expect(RetryPolicy).toBeDefined();
      expect(typeof RetryPolicy).toBe("function");
    });

    it("exports defaultRetryPolicy singleton", () => {
      expect(defaultRetryPolicy).toBeDefined();
      expect(defaultRetryPolicy).toBeInstanceOf(RetryPolicy);
    });

    it("exports constants", () => {
      expect(DEFAULT_INITIAL_DELAY_MS).toBe(1000);
      expect(DEFAULT_MAX_DELAY_MS).toBe(32000);
      expect(DEFAULT_BACKOFF_FACTOR).toBe(2);
      expect(DEFAULT_MAX_RETRIES).toBe(6);
      expect(MAX_RETRIES_ABSOLUTE_LIMIT).toBe(72);
    });

    it("can be instantiated with no arguments", () => {
      const policy = new RetryPolicy();
      expect(policy).toBeInstanceOf(RetryPolicy);
    });

    it("uses default values when no config provided", () => {
      const policy = new RetryPolicy();
      expect(policy.initialDelayMs).toBe(DEFAULT_INITIAL_DELAY_MS);
      expect(policy.maxDelayMs).toBe(DEFAULT_MAX_DELAY_MS);
      expect(policy.backoffFactor).toBe(DEFAULT_BACKOFF_FACTOR);
      expect(policy.maxRetries).toBe(DEFAULT_MAX_RETRIES);
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    it("accepts custom configuration", () => {
      const policy = new RetryPolicy({
        backoffFactor: 3,
        initialDelayMs: 500,
        maxDelayMs: 10000,
        maxRetries: 10,
      });

      expect(policy.initialDelayMs).toBe(500);
      expect(policy.maxDelayMs).toBe(10000);
      expect(policy.backoffFactor).toBe(3);
      expect(policy.maxRetries).toBe(10);
    });

    it("caps maxRetries at absolute limit", () => {
      const policy = new RetryPolicy({
        maxRetries: 100,
      });

      expect(policy.maxRetries).toBe(MAX_RETRIES_ABSOLUTE_LIMIT);
    });
  });

  // Features
  describe("Features", () => {
    describe("getDelayForAttempt", () => {
      it("returns initial delay for first attempt", () => {
        const policy = new RetryPolicy({
          initialDelayMs: 1000,
        });

        expect(policy.getDelayForAttempt(0)).toBe(1000);
      });

      it("applies exponential backoff", () => {
        const policy = new RetryPolicy({
          backoffFactor: 2,
          initialDelayMs: 1000,
          maxDelayMs: 100000,
        });

        expect(policy.getDelayForAttempt(0)).toBe(1000);
        expect(policy.getDelayForAttempt(1)).toBe(2000);
        expect(policy.getDelayForAttempt(2)).toBe(4000);
        expect(policy.getDelayForAttempt(3)).toBe(8000);
        expect(policy.getDelayForAttempt(4)).toBe(16000);
        expect(policy.getDelayForAttempt(5)).toBe(32000);
      });

      it("caps delay at maxDelayMs", () => {
        const policy = new RetryPolicy({
          backoffFactor: 2,
          initialDelayMs: 1000,
          maxDelayMs: 5000,
        });

        expect(policy.getDelayForAttempt(0)).toBe(1000);
        expect(policy.getDelayForAttempt(1)).toBe(2000);
        expect(policy.getDelayForAttempt(2)).toBe(4000);
        expect(policy.getDelayForAttempt(3)).toBe(5000); // Capped
        expect(policy.getDelayForAttempt(10)).toBe(5000); // Still capped
      });
    });

    describe("shouldRetry", () => {
      it("returns true when under max retries", () => {
        const policy = new RetryPolicy({ maxRetries: 5 });

        expect(policy.shouldRetry(0)).toBe(true);
        expect(policy.shouldRetry(1)).toBe(true);
        expect(policy.shouldRetry(4)).toBe(true);
      });

      it("returns false when at or above max retries", () => {
        const policy = new RetryPolicy({ maxRetries: 5 });

        expect(policy.shouldRetry(5)).toBe(false);
        expect(policy.shouldRetry(6)).toBe(false);
        expect(policy.shouldRetry(100)).toBe(false);
      });
    });
  });

  // Specific Scenarios
  describe("Specific Scenarios", () => {
    it("default policy matches OpenAI operate.ts constants", () => {
      const policy = new RetryPolicy();

      // These should match the constants from OpenAI operate.ts
      expect(policy.initialDelayMs).toBe(1000); // INITIAL_RETRY_DELAY_MS
      expect(policy.maxDelayMs).toBe(32000); // MAX_RETRY_DELAY_MS
      expect(policy.backoffFactor).toBe(2); // RETRY_BACKOFF_FACTOR
    });

    it("partial config uses defaults for missing values", () => {
      const policy = new RetryPolicy({
        maxRetries: 10,
      });

      expect(policy.initialDelayMs).toBe(DEFAULT_INITIAL_DELAY_MS);
      expect(policy.maxDelayMs).toBe(DEFAULT_MAX_DELAY_MS);
      expect(policy.backoffFactor).toBe(DEFAULT_BACKOFF_FACTOR);
      expect(policy.maxRetries).toBe(10);
    });
  });
});
