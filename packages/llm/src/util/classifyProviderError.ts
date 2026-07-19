import { ClassifiedError, ErrorCategory } from "../operate/types.js";

//
//
// Constants
//

/**
 * Transient structured-output compile failures. The provider caches the
 * compiled grammar after a successful compile, so an immediate retry of the
 * identical request typically succeeds (issue #422).
 */
const RETRYABLE_MESSAGE_PATTERNS = [
  "grammar compilation timed out",
  "grammar compilation timeout",
] as const;

/** Billing / insufficient-funds signals — the account cannot be charged. */
const BILLING_MESSAGE_PATTERNS = [
  "insufficient_quota",
  "insufficient funds",
  "insufficient credit",
  "credit balance",
  "billing",
  "payment required",
  "plan and billing",
] as const;

/** Exhausted usage quota (per-day / per-model limits). */
const QUOTA_MESSAGE_PATTERNS = [
  "quota exceeded",
  "exceeded your current quota",
  "resource_exhausted",
  "quota_exceeded",
] as const;

//
//
// Helpers
//

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error === "string") return error.toLowerCase();
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message.toLowerCase();
  }
  return "";
}

//
//
// Main
//

/**
 * Shared, provider-agnostic first pass over an error. Returns a
 * {@link ClassifiedError} when the message unambiguously identifies a
 * cross-provider condition (retryable structured-output timeout, exhausted
 * quota, or a billing failure), or `undefined` to defer to the adapter's own
 * status/name classification.
 *
 * Adapters call this before their existing logic so that, for example, a
 * `429` carrying a daily-quota message is classified as {@link
 * ErrorCategory.Quota} rather than {@link ErrorCategory.RateLimit}.
 */
export function classifyProviderError(
  error: unknown,
): ClassifiedError | undefined {
  const message = extractMessage(error);
  if (!message) return undefined;

  for (const pattern of RETRYABLE_MESSAGE_PATTERNS) {
    if (message.includes(pattern)) {
      return { category: ErrorCategory.Retryable, error, shouldRetry: true };
    }
  }

  for (const pattern of BILLING_MESSAGE_PATTERNS) {
    if (message.includes(pattern)) {
      return {
        category: ErrorCategory.Quota,
        error,
        reason: "billing",
        shouldRetry: false,
      };
    }
  }

  for (const pattern of QUOTA_MESSAGE_PATTERNS) {
    if (message.includes(pattern)) {
      return {
        category: ErrorCategory.Quota,
        error,
        reason: "quota",
        shouldRetry: false,
      };
    }
  }

  return undefined;
}
