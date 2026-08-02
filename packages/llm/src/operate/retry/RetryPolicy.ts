//
//
// Constants
//

export const DEFAULT_INITIAL_DELAY_MS = 1000; // 1 second
export const DEFAULT_MAX_DELAY_MS = 32000; // 32 seconds
export const DEFAULT_BACKOFF_FACTOR = 2; // Exponential backoff multiplier
export const DEFAULT_MAX_RETRIES = 6;
export const MAX_RETRIES_ABSOLUTE_LIMIT = 72;

// A rate limit clears on wall-clock time, not on a retry, so its budget is
// counted and capped apart from the transient-error budget: few attempts,
// each sleeping far longer than an exponential backoff would.
export const DEFAULT_RATE_LIMIT_RETRIES = 2;
export const DEFAULT_RATE_LIMIT_DELAY_MS = 60000; // 1 minute
export const DEFAULT_RATE_LIMIT_MAX_DELAY_MS = 90000; // 90 seconds

//
//
// Types
//

export interface RetryPolicyConfig {
  /** Initial delay in milliseconds before first retry. Default: 1000 */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds between retries. Default: 32000 */
  maxDelayMs?: number;
  /** Backoff multiplier for exponential backoff. Default: 2 */
  backoffFactor?: number;
  /** Maximum number of retries. Default: 6 */
  maxRetries?: number;
  /** Retries granted to a rate-limited request. 0 disables. Default: 2 */
  rateLimitRetries?: number;
  /** Ceiling on a single rate-limit wait. Default: 90000 */
  rateLimitMaxDelayMs?: number;
}

/**
 * Caller-facing retry controls, exposed as `LlmOperateOptions.retry`.
 */
export interface LlmRetryOptions {
  /**
   * Whether a rate-limited request waits and retries. `true` (the default)
   * uses the policy budget; `false` restores the terminal behavior; an object
   * tunes the budget.
   */
  rateLimit?: boolean | { maxRetries?: number; maxDelayMs?: number };
}

//
//
// Main
//

/**
 * RetryPolicy encapsulates retry configuration and delay calculation
 * for the operate loop's retry logic.
 */
export class RetryPolicy {
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffFactor: number;
  readonly maxRetries: number;
  readonly rateLimitRetries: number;
  readonly rateLimitMaxDelayMs: number;

  constructor(config: RetryPolicyConfig = {}) {
    this.initialDelayMs = config.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
    this.maxDelayMs = config.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    this.backoffFactor = config.backoffFactor ?? DEFAULT_BACKOFF_FACTOR;
    this.maxRetries = Math.min(
      config.maxRetries ?? DEFAULT_MAX_RETRIES,
      MAX_RETRIES_ABSOLUTE_LIMIT,
    );
    this.rateLimitRetries = Math.max(
      0,
      Math.min(
        config.rateLimitRetries ?? DEFAULT_RATE_LIMIT_RETRIES,
        MAX_RETRIES_ABSOLUTE_LIMIT,
      ),
    );
    this.rateLimitMaxDelayMs =
      config.rateLimitMaxDelayMs ?? DEFAULT_RATE_LIMIT_MAX_DELAY_MS;
  }

  /**
   * Calculate the delay for a given attempt number (0-indexed)
   */
  getDelayForAttempt(attempt: number): number {
    const delay = this.initialDelayMs * Math.pow(this.backoffFactor, attempt);
    return Math.min(delay, this.maxDelayMs);
  }

  /**
   * Check if another retry should be attempted
   */
  shouldRetry(currentAttempt: number): boolean {
    return currentAttempt < this.maxRetries;
  }

  /**
   * Check if a rate-limited request has budget left. Counted apart from
   * {@link shouldRetry} so throttling never spends the transient budget.
   */
  shouldRetryRateLimit(currentAttempt: number): boolean {
    return currentAttempt < this.rateLimitRetries;
  }

  /**
   * Milliseconds to wait before re-issuing a rate-limited request. The
   * provider's suggestion wins when there is one; otherwise the wait grows
   * from a one-minute floor. Either way it is capped.
   */
  getRateLimitDelay({
    attempt = 0,
    suggestedDelayMs,
  }: { attempt?: number; suggestedDelayMs?: number } = {}): number {
    const base =
      suggestedDelayMs && suggestedDelayMs > 0
        ? suggestedDelayMs
        : DEFAULT_RATE_LIMIT_DELAY_MS * Math.pow(this.backoffFactor, attempt);
    return Math.min(base, this.rateLimitMaxDelayMs);
  }
}

// Export a default policy instance
export const defaultRetryPolicy = new RetryPolicy();

/**
 * Apply a caller's `retry` option on top of a policy. Returns the policy
 * unchanged when the caller said nothing, so the common path allocates nothing.
 */
export function resolveRetryPolicy({
  policy = defaultRetryPolicy,
  retry,
}: { policy?: RetryPolicy; retry?: LlmRetryOptions } = {}): RetryPolicy {
  const rateLimit = retry?.rateLimit;
  if (rateLimit === undefined) {
    return policy;
  }

  const overrides: RetryPolicyConfig = {
    backoffFactor: policy.backoffFactor,
    initialDelayMs: policy.initialDelayMs,
    maxDelayMs: policy.maxDelayMs,
    maxRetries: policy.maxRetries,
    rateLimitMaxDelayMs: policy.rateLimitMaxDelayMs,
    rateLimitRetries: policy.rateLimitRetries,
  };

  if (rateLimit === false) {
    overrides.rateLimitRetries = 0;
  } else if (rateLimit !== true) {
    overrides.rateLimitRetries =
      rateLimit.maxRetries ?? overrides.rateLimitRetries;
    overrides.rateLimitMaxDelayMs =
      rateLimit.maxDelayMs ?? overrides.rateLimitMaxDelayMs;
  }

  return new RetryPolicy(overrides);
}
