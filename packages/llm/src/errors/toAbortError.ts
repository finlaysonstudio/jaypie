import { LlmAbortError } from "./LlmError.js";

/**
 * Build the typed error for a caller-initiated abort, carrying the signal's
 * reason when it is a string.
 */
export function toAbortError({
  cause,
  model,
  provider,
  signal,
}: {
  cause?: unknown;
  model?: string;
  provider?: string;
  signal?: AbortSignal;
} = {}): LlmAbortError {
  const reason = typeof signal?.reason === "string" ? signal.reason : undefined;
  return new LlmAbortError(
    reason ? `Request aborted by caller: ${reason}` : undefined,
    { cause: cause ?? signal?.reason, model, provider },
  );
}
