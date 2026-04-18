import { BadRequestError } from "openai";

import { PROVIDER } from "../../constants.js";
import { ClassifiedError, ErrorCategory } from "../types.js";
import { OpenAiAdapter } from "./OpenAiAdapter.js";

/**
 * Error-message substrings that indicate a transient xAI media-ingest flake.
 * The xAI ingest service enters a bad state after ~12 consecutive file-bearing
 * calls and rejects subsequent requests with HTTP 400. The condition is
 * self-clearing, so these errors should be retried with backoff rather than
 * surfaced as unrecoverable.
 *
 * See: github.com/finlaysonstudio/jaypie issue #301
 */
const TRANSIENT_INGEST_MESSAGE_PATTERNS = [
  "failed to ingest inline file bytes",
] as const;

function isTransientIngestError(error: unknown): boolean {
  if (!(error instanceof BadRequestError)) return false;
  const message = (error.message ?? "").toLowerCase();
  return TRANSIENT_INGEST_MESSAGE_PATTERNS.some((pattern) =>
    message.includes(pattern),
  );
}

/**
 * XaiAdapter extends OpenAiAdapter since xAI (Grok) uses an OpenAI-compatible API.
 * Name, default model, and transient-ingest-error detection are overridden;
 * all request building, response parsing, tool handling, and streaming are
 * inherited.
 */
export class XaiAdapter extends OpenAiAdapter {
  // @ts-expect-error Narrowing override: xAI name differs from parent's literal "openai"
  readonly name = PROVIDER.XAI.NAME;
  // @ts-expect-error Narrowing override: xAI default model differs from parent's literal
  readonly defaultModel = PROVIDER.XAI.MODEL.DEFAULT;

  classifyError(error: unknown): ClassifiedError {
    if (isTransientIngestError(error)) {
      return {
        error,
        category: ErrorCategory.Retryable,
        shouldRetry: true,
      };
    }
    return super.classifyError(error);
  }
}

// Export singleton instance
export const xaiAdapter = new XaiAdapter();
