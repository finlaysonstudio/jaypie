import { sleep } from "@jaypie/kit";
import { BadGatewayError } from "@jaypie/errors";

import { log } from "../../util/index.js";
import {
  HookRunner,
  hookRunner as defaultHookRunner,
  LlmHooks,
} from "../hooks/HookRunner.js";
import { RetryPolicy, defaultRetryPolicy } from "./RetryPolicy.js";

//
//
// Types
//

export interface RetryContext {
  input: unknown;
  options?: unknown;
  providerRequest: unknown;
}

export interface ErrorClassifier {
  isRetryable(error: unknown): boolean;
  isKnownError(error: unknown): boolean;
}

export interface RetryExecutorConfig {
  errorClassifier: ErrorClassifier;
  hookRunner?: HookRunner;
  policy?: RetryPolicy;
}

export interface ExecuteOptions {
  context: RetryContext;
  hooks?: LlmHooks;
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
   * Execute an operation with retry logic
   *
   * @param operation - The async operation to execute
   * @param options - Execution options including context and hooks
   * @returns The result of the operation
   * @throws BadGatewayError if all retries are exhausted or error is not retryable
   */
  async execute<T>(
    operation: () => Promise<T>,
    options: ExecuteOptions,
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        const result = await operation();

        if (attempt > 0) {
          log.debug(`API call succeeded after ${attempt} retries`);
        }

        return result;
      } catch (error: unknown) {
        // Check if we've exhausted retries
        if (!this.policy.shouldRetry(attempt)) {
          log.error(`API call failed after ${this.policy.maxRetries} retries`);
          log.var({ error });

          await this.hookRunner.runOnUnrecoverableError(options.hooks, {
            input: options.context.input as never,
            options: options.context.options as never,
            providerRequest: options.context.providerRequest,
            error,
          });

          const errorMessage =
            error instanceof Error ? error.message : String(error);
          throw new BadGatewayError(errorMessage);
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

          const errorMessage =
            error instanceof Error ? error.message : String(error);
          throw new BadGatewayError(errorMessage);
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

        await sleep(delay);
        attempt++;
      }
    }
  }
}
