import { LlmRateLimitError, LlmTransientError } from "../errors/LlmError.js";
import { toAbortError } from "../errors/toAbortError.js";
import { resolveRetryPolicy } from "../operate/retry/index.js";
import { isTransientNetworkError } from "../operate/retry/isTransientNetworkError.js";
import { type LlmRetryOptions } from "../operate/retry/RetryPolicy.js";
import { abortableSleep } from "../util/abortableSleep.js";
import { getLogger } from "../util/logger.js";

//
//
// Main
//

/**
 * Run one OCR request under the shared retry policy: rate limits wait out
 * their budget (unless the caller turned that off), transient failures back
 * off and retry, everything else throws at once. Both OCR providers share
 * this loop, so `retry` and `signal` mean the same thing on each.
 */
export async function runOcrAttempts<T>({
  attempt,
  model,
  provider,
  retry,
  signal,
}: {
  attempt: () => Promise<T>;
  model: string;
  provider: string;
  retry?: LlmRetryOptions;
  signal?: AbortSignal;
}): Promise<T> {
  const log = getLogger();
  const policy = resolveRetryPolicy({ retry });
  let rateLimitAttempt = 0;
  let transientAttempt = 0;

  for (;;) {
    if (signal?.aborted) {
      throw toAbortError({ model, provider, signal });
    }
    try {
      return await attempt();
    } catch (error) {
      if (signal?.aborted) {
        throw toAbortError({ cause: error, model, provider, signal });
      }
      if (
        error instanceof LlmRateLimitError &&
        policy.shouldRetryRateLimit(rateLimitAttempt)
      ) {
        const ms = policy.getRateLimitDelay({
          attempt: rateLimitAttempt,
          suggestedDelayMs: error.retryAfterMs,
        });
        log.warn(`${provider} OCR rate limited; waiting before retry`, { ms });
        rateLimitAttempt += 1;
        await abortableSleep({ ms, signal });
        continue;
      }
      const transient =
        error instanceof LlmTransientError || isTransientNetworkError(error);
      if (transient && policy.shouldRetry(transientAttempt)) {
        const ms = policy.getDelayForAttempt(transientAttempt);
        log.warn(`${provider} OCR request failed; retrying`, { ms });
        transientAttempt += 1;
        await abortableSleep({ ms, signal });
        continue;
      }
      throw error;
    }
  }
}
