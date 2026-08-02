import { describe, expect, it } from "vitest";

import {
  DEFAULT_BACKOFF_FACTOR,
  DEFAULT_INITIAL_DELAY_MS,
  DEFAULT_MAX_DELAY_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RATE_LIMIT_DELAY_MS,
  DEFAULT_RATE_LIMIT_MAX_DELAY_MS,
  DEFAULT_RATE_LIMIT_RETRIES,
  defaultRetryPolicy,
  MAX_RETRIES_ABSOLUTE_LIMIT,
  resolveRetryPolicy,
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

  describe("Rate Limit Budget", () => {
    it("defaults to a small dedicated budget", () => {
      expect(defaultRetryPolicy.rateLimitRetries).toBe(
        DEFAULT_RATE_LIMIT_RETRIES,
      );
      expect(defaultRetryPolicy.rateLimitMaxDelayMs).toBe(
        DEFAULT_RATE_LIMIT_MAX_DELAY_MS,
      );
    });

    it("counts rate limit attempts against their own budget", () => {
      const policy = new RetryPolicy({ maxRetries: 6, rateLimitRetries: 2 });

      expect(policy.shouldRetryRateLimit(0)).toBe(true);
      expect(policy.shouldRetryRateLimit(1)).toBe(true);
      expect(policy.shouldRetryRateLimit(2)).toBe(false);
    });

    it("never accepts a negative budget", () => {
      expect(new RetryPolicy({ rateLimitRetries: -5 }).rateLimitRetries).toBe(
        0,
      );
    });

    it("prefers the provider's suggested delay", () => {
      expect(
        defaultRetryPolicy.getRateLimitDelay({ suggestedDelayMs: 30000 }),
      ).toBe(30000);
    });

    it("caps the suggested delay", () => {
      expect(
        defaultRetryPolicy.getRateLimitDelay({ suggestedDelayMs: 600000 }),
      ).toBe(DEFAULT_RATE_LIMIT_MAX_DELAY_MS);
    });

    it("falls back to a growing delay from a one-minute floor", () => {
      expect(defaultRetryPolicy.getRateLimitDelay()).toBe(
        DEFAULT_RATE_LIMIT_DELAY_MS,
      );
      expect(defaultRetryPolicy.getRateLimitDelay({ attempt: 1 })).toBe(
        DEFAULT_RATE_LIMIT_MAX_DELAY_MS,
      );
    });
  });

  describe("resolveRetryPolicy", () => {
    it("returns the policy unchanged when no option is given", () => {
      const policy = new RetryPolicy({ maxRetries: 3 });

      expect(resolveRetryPolicy({ policy })).toBe(policy);
      expect(resolveRetryPolicy({ policy, retry: {} })).toBe(policy);
    });

    it("disables the budget with rateLimit false", () => {
      const resolved = resolveRetryPolicy({ retry: { rateLimit: false } });

      expect(resolved.rateLimitRetries).toBe(0);
    });

    it("keeps the budget with rateLimit true", () => {
      const resolved = resolveRetryPolicy({ retry: { rateLimit: true } });

      expect(resolved.rateLimitRetries).toBe(DEFAULT_RATE_LIMIT_RETRIES);
    });

    it("tunes the budget from an object", () => {
      const resolved = resolveRetryPolicy({
        retry: { rateLimit: { maxDelayMs: 5000, maxRetries: 4 } },
      });

      expect(resolved.rateLimitRetries).toBe(4);
      expect(resolved.rateLimitMaxDelayMs).toBe(5000);
    });

    it("preserves the transient budget when overriding rate limits", () => {
      const policy = new RetryPolicy({ backoffFactor: 3, maxRetries: 5 });
      const resolved = resolveRetryPolicy({
        policy,
        retry: { rateLimit: false },
      });

      expect(resolved.maxRetries).toBe(5);
      expect(resolved.backoffFactor).toBe(3);
    });
  });
});
