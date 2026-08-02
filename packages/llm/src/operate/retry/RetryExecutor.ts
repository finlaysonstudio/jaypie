import { abortableSleep } from "../../util/abortableSleep.js";
import { combineAbortSignals } from "../../util/abortSignal.js";
import { getLogger } from "../../util/index.js";
import { toAbortError } from "../../errors/toAbortError.js";
import { createStaleRejectionGuard } from "./createStaleRejectionGuard.js";
import {
  HookRunner,
  hookRunner as defaultHookRunner,
  LlmHooks,
} from "../hooks/HookRunner.js";
import { RetryPolicy, defaultRetryPolicy } from "./RetryPolicy.js";
import { ClassifiedError, ErrorCategory } from "../types.js";
import { toLlmError } from "../../errors/toLlmError.js";

//
//
// Types
//

export interface RetryContext {
  input: unknown;
  options?: unknown;
  providerRequest: unknown;
  /** Provider name, carried onto the thrown LlmError */
  provider?: string;
  /** Model in use, carried onto the thrown LlmError */
  model?: string;
}

export interface ErrorClassifier {
  isRetryable(error: unknown): boolean;
  isKnownError(error: unknown): boolean;
  /** Full classification, used to throw a typed LlmError on terminal failure */
  classify(error: unknown): ClassifiedError;
}

export interface RetryExecutorConfig {
  errorClassifier: ErrorClassifier;
  hookRunner?: HookRunner;
  policy?: RetryPolicy;
}

export interface ExecuteOptions {
  context: RetryContext;
  hooks?: LlmHooks;
  /** Caller-owned cancellation; linked into every attempt's signal */
  signal?: AbortSignal;
}

//
//
// Main
//

/**
 * RetryExecutor handles the retry loop logic for LLM API calls.
 * It provides exponential backoff, error classification, and hook execution.
 */
export class RetryExecutor {
  private readonly policy: RetryPolicy;
  private readonly hookRunner: HookRunner;
  private readonly errorClassifier: ErrorClassifier;

  constructor(config: RetryExecutorConfig) {
    this.policy = config.policy ?? defaultRetryPolicy;
    this.hookRunner = config.hookRunner ?? defaultHookRunner;
    this.errorClassifier = config.errorClassifier;
  }

  /**
   * Build the typed, provider-agnostic error thrown when a request cannot be
   * completed — classified (rate limit / quota / unrecoverable / transient)
   * and carrying the provider, model, and original error as `cause`.
   */
  private toTerminalError(error: unknown, context: RetryContext) {
    const classified = this.errorClassifier.classify(error);
    return toLlmError(classified, {
      model: context.model,
      provider: context.provider,
    });
  }

  /**
   * Build the error thrown when the caller's own signal aborts the request.
   */
  private toCallerAbortError(error: unknown, options: ExecuteOptions) {
    return toAbortError({
      cause: error,
      model: options.context.model,
      provider: options.context.provider,
      signal: options.signal,
    });
  }

  /**
   * Execute an operation with retry logic.
   * Each attempt receives an AbortSignal, the caller's `signal` linked into it
   * when one was passed. On failure, the attempt's controller is aborted before
   * sleeping — this kills lingering socket callbacks from the previous request
   * and prevents stale async errors from escaping the retry loop. A caller
   * abort is terminal: it throws {@link LlmAbortError} without retrying.
   *
   * @param operation - The async operation to execute (receives AbortSignal)
   * @param options - Execution options including context, hooks, and signal
   * @returns The result of the operation
   * @throws BadGatewayError if all retries are exhausted or error is not retryable
   */
  async execute<T>(
    operation: ((signal: AbortSignal) => Promise<T>) | (() => Promise<T>),
    options: ExecuteOptions,
  ): Promise<T> {
    const log = getLogger();
    let attempt = 0;
    let rateLimitAttempt = 0;

    // Guard against stale rejections firing on a subsequent microtask after
    // the retry layer has already caught the originating error: undici socket
    // teardown (TypeError: terminated) and twin upstream-SDK rejections
    // (e.g. issue #336 — OpenRouter SyntaxError siblings).
    const guard = createStaleRejectionGuard();

    try {
      while (true) {
        // A caller abort is terminal, whether it arrived before the first
        // attempt or during a backoff sleep
        if (options.signal?.aborted) {
          throw this.toCallerAbortError(undefined, options);
        }

        const controller = new AbortController();

        try {
          const result = await operation(
            combineAbortSignals({ controller, signal: options.signal }),
          );

          if (attempt > 0) {
            log.debug(`API call succeeded after ${attempt} retries`);
          }

          return result;
        } catch (error: unknown) {
          controller.abort("retry");

          guard.recordCaught(error);
          guard.install();

          // The caller cancelled: report the abort, not the provider error it
          // manifested as, and do not retry
          if (options.signal?.aborted) {
            log.debug("API call aborted by caller");
            throw this.toCallerAbortError(error, options);
          }

          // A rate limit clears on wall-clock time. It draws on its own budget
          // so throttling never consumes the transient-error retries, and it
          // waits the provider's suggested delay rather than a backoff ramp.
          // Quota is a sibling category and stays terminal: waiting does not
          // refill an exhausted plan.
          const classified = this.errorClassifier.classify(error);
          if (classified.category === ErrorCategory.RateLimit) {
            if (!this.policy.shouldRetryRateLimit(rateLimitAttempt)) {
              log.error(
                `API call rate limited after ${this.policy.rateLimitRetries} retries`,
              );
              log.var({ error });

              await this.hookRunner.runOnUnrecoverableError(options.hooks, {
                input: options.context.input as never,
                options: options.context.options as never,
                providerRequest: options.context.providerRequest,
                error,
              });

              throw this.toTerminalError(error, options.context);
            }

            const rateLimitDelay = this.policy.getRateLimitDelay({
              attempt: rateLimitAttempt,
              suggestedDelayMs: classified.suggestedDelayMs,
            });
            log.warn(
              `API call rate limited. Retrying in ${rateLimitDelay}ms...`,
            );

            await this.hookRunner.runOnRetryableError(options.hooks, {
              input: options.context.input as never,
              options: options.context.options as never,
              providerRequest: options.context.providerRequest,
              error,
            });

            await abortableSleep({
              ms: rateLimitDelay,
              signal: options.signal,
            });
            rateLimitAttempt++;
            continue;
          }

          // Check if we've exhausted retries
          if (!this.policy.shouldRetry(attempt)) {
            log.error(
              `API call failed after ${this.policy.maxRetries} retries`,
            );
            log.var({ error });

            await this.hookRunner.runOnUnrecoverableError(options.hooks, {
              input: options.context.input as never,
              options: options.context.options as never,
              providerRequest: options.context.providerRequest,
              error,
            });

            throw this.toTerminalError(error, options.context);
          }

          // Check if error is not retryable
          if (!this.errorClassifier.isRetryable(error)) {
            log.error("API call failed with non-retryable error");
            log.var({ error });

            await this.hookRunner.runOnUnrecoverableError(options.hooks, {
              input: options.context.input as never,
              options: options.context.options as never,
              providerRequest: options.context.providerRequest,
              error,
            });

            throw this.toTerminalError(error, options.context);
          }

          // Warn if this is an unknown error type
          if (!this.errorClassifier.isKnownError(error)) {
            log.warn("API returned unknown error type, will retry");
            log.var({ error });
          }

          const delay = this.policy.getDelayForAttempt(attempt);
          log.warn(`API call failed. Retrying in ${delay}ms...`);

          await this.hookRunner.runOnRetryableError(options.hooks, {
            input: options.context.input as never,
            options: options.context.options as never,
            providerRequest: options.context.providerRequest,
            error,
          });

          await abortableSleep({ ms: delay, signal: options.signal });
          attempt++;
        }
      }
    } finally {
      guard.remove();
    }
  }
}
