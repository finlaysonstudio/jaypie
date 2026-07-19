import { ClassifiedError, ErrorCategory } from "../operate/types.js";
import {
  LlmError,
  LlmErrorOptions,
  LlmQuotaError,
  LlmRateLimitError,
  LlmTransientError,
  LlmUnrecoverableError,
} from "./LlmError.js";

/**
 * Map a {@link ClassifiedError} to the matching {@link LlmError} subclass,
 * preserving the original error as `cause`. Used by the retry layer to throw a
 * stable, catchable type instead of a bare gateway error.
 */
export function toLlmError(
  classified: ClassifiedError,
  context: { provider?: string; model?: string } = {},
): LlmError {
  const original = classified.error;
  const message =
    original instanceof Error ? original.message : String(original);
  const options: LlmErrorOptions = {
    cause: original,
    model: context.model,
    provider: context.provider,
    retryAfterMs: classified.suggestedDelayMs,
  };

  switch (classified.category) {
    case ErrorCategory.RateLimit:
      return new LlmRateLimitError(message, options);
    case ErrorCategory.Quota:
      return new LlmQuotaError(message, {
        ...options,
        reason: classified.reason ?? "quota",
      });
    case ErrorCategory.Unrecoverable:
      return new LlmUnrecoverableError(message, options);
    case ErrorCategory.Retryable:
    case ErrorCategory.Unknown:
    default:
      return new LlmTransientError(message, options);
  }
}
