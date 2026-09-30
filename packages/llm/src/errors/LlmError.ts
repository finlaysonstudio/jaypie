import { JaypieError } from "@jaypie/errors";
import { ErrorCategory } from "../operate/types.js";
import type { LlmOperateResponse } from "../types/LlmProvider.interface.js";

//
//
// Types
//

export interface LlmErrorOptions {
  /** Provider name that produced the error (e.g. "anthropic", "google") */
  provider?: string;
  /** Model in use when the error occurred */
  model?: string;
  /** Milliseconds to wait before retrying, when the provider suggests one */
  retryAfterMs?: number;
  /** The original provider error, preserved for inspection */
  cause?: unknown;
}

//
//
// Constants
//

const ABORT_MESSAGE = "Request aborted by caller";
const ABORT_STATUS = 499;
const ABORT_TITLE = "Client Closed Request";
const INCOMPLETE_MESSAGE = "Model stopped before finishing";
const INCOMPLETE_TITLE = "Incomplete Response";
const TIMEOUT_MESSAGE = "Request attempt timed out";

//
//
// Base
//

/**
 * Normalized, provider-agnostic LLM error. Thrown by the operate/stream retry
 * layer when a request cannot be completed, so consumers can `catch` a stable
 * type regardless of which provider failed. Extends {@link JaypieError} so
 * `isJaypieError()` and `.status` continue to work; the original provider error
 * is preserved on `.cause`.
 */
export class LlmError extends JaypieError {
  readonly category: ErrorCategory;
  readonly provider?: string;
  readonly model?: string;
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    category: ErrorCategory,
    {
      status = 502,
      title = "Bad Gateway",
      provider,
      model,
      retryAfterMs,
      cause,
    }: LlmErrorOptions & { status?: number; title?: string } = {},
  ) {
    super(message, { cause, status, title }, { _type: "LlmError" });
    this.name = "LlmError";
    this.category = category;
    this.provider = provider;
    this.model = model;
    this.retryAfterMs = retryAfterMs;
  }
}

//
//
// Subclasses
//

/**
 * The caller aborted the request through the `signal` option. Terminal and
 * never retried: the request stopped because the caller asked it to, not
 * because the provider failed.
 */
export class LlmAbortError extends LlmError {
  constructor(message: string = ABORT_MESSAGE, options: LlmErrorOptions = {}) {
    super(message, ErrorCategory.Aborted, {
      status: ABORT_STATUS,
      title: ABORT_TITLE,
      ...options,
    });
    this.name = "LlmAbortError";
  }
}

/**
 * The provider cut the answer short (output token ceiling, content filter)
 * and the caller asked `operate` to throw rather than return the partial
 * (`incomplete: "throw"`). The settled response, partial content and
 * `stopReason` included, rides on `.response`.
 */
export class LlmIncompleteError extends LlmError {
  readonly response?: LlmOperateResponse;

  constructor(
    message: string = INCOMPLETE_MESSAGE,
    {
      response,
      ...options
    }: LlmErrorOptions & { response?: LlmOperateResponse } = {},
  ) {
    super(message, ErrorCategory.Incomplete, {
      model: response?.model,
      provider: response?.provider,
      ...options,
      status: 502,
      title: INCOMPLETE_TITLE,
    });
    this.name = "LlmIncompleteError";
    this.response = response;
  }
}

/**
 * Short-term rate limiting (per-minute 429). Terminal within the request
 * budget; `retryAfterMs` carries the provider's suggested wait when available.
 */
export class LlmRateLimitError extends LlmError {
  constructor(message: string, options: LlmErrorOptions = {}) {
    super(message, ErrorCategory.RateLimit, {
      status: 429,
      title: "Too Many Requests",
      ...options,
    });
    this.name = "LlmRateLimitError";
  }
}

/**
 * Provider quota is exhausted or the account cannot be billed. Terminal and
 * actionable. `reason` distinguishes an exhausted usage quota from insufficient
 * funds.
 */
export class LlmQuotaError extends LlmError {
  readonly reason: "quota" | "billing";

  constructor(
    message: string,
    {
      reason = "quota",
      ...options
    }: LlmErrorOptions & {
      reason?: "quota" | "billing";
    } = {},
  ) {
    super(message, ErrorCategory.Quota, {
      status: 402,
      title: "Payment Required",
      ...options,
    });
    this.name = "LlmQuotaError";
    this.reason = reason;
  }
}

/**
 * The request cannot be recovered from (bad request, authentication,
 * permission, not found). Terminal.
 */
export class LlmUnrecoverableError extends LlmError {
  constructor(message: string, options: LlmErrorOptions = {}) {
    super(message, ErrorCategory.Unrecoverable, {
      status: 502,
      title: "Bad Gateway",
      ...options,
    });
    this.name = "LlmUnrecoverableError";
  }
}

/**
 * A transient or unknown error survived the retry budget. Terminal only because
 * retries were exhausted; the underlying condition may succeed later.
 */
export class LlmTransientError extends LlmError {
  constructor(message: string, options: LlmErrorOptions = {}) {
    super(message, ErrorCategory.Retryable, {
      status: 504,
      title: "Gateway Timeout",
      ...options,
    });
    this.name = "LlmTransientError";
  }
}

/**
 * A provider attempt outlived its `timeout` deadline and was aborted. Unlike
 * {@link LlmAbortError}, the caller did not ask for it: the attempt retries on
 * the transient budget, and a fallback chain moves to its next model.
 */
export class LlmTimeoutError extends LlmTransientError {
  readonly timeoutMs?: number;

  constructor(
    message: string = TIMEOUT_MESSAGE,
    { timeoutMs, ...options }: LlmErrorOptions & { timeoutMs?: number } = {},
  ) {
    super(message, options);
    this.name = "LlmTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}
