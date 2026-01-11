//
//
// Constants
//

export const DEFAULT_INITIAL_DELAY_MS = 1000; // 1 second
export const DEFAULT_MAX_DELAY_MS = 32000; // 32 seconds
export const DEFAULT_BACKOFF_FACTOR = 2; // Exponential backoff multiplier
export const DEFAULT_MAX_RETRIES = 6;
export const MAX_RETRIES_ABSOLUTE_LIMIT = 72;

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

  constructor(config: RetryPolicyConfig = {}) {
    this.initialDelayMs = config.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
    this.maxDelayMs = config.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    this.backoffFactor = config.backoffFactor ?? DEFAULT_BACKOFF_FACTOR;
    this.maxRetries = Math.min(
      config.maxRetries ?? DEFAULT_MAX_RETRIES,
      MAX_RETRIES_ABSOLUTE_LIMIT,
    );
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
}

// Export a default policy instance
export const defaultRetryPolicy = new RetryPolicy();
