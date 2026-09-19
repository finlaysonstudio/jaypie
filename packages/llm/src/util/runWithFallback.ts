import log from "@jaypie/logger";

import { LlmFallbackConfig } from "../types/LlmProvider.interface.js";

export interface FallbackAttemptContext<TInstance> {
  /** 1 for the primary, incrementing through the chain */
  attempts: number;
  instance: TInstance;
  /** True on the final candidate: nowhere left to fall to */
  isLast: boolean;
  provider: string;
}

/**
 * Try the primary, then each fallback in turn, returning the first success.
 * Every candidate's failure is logged and the last error is rethrown when the
 * chain is exhausted.
 *
 * The attempt callback owns what "success" means, so the same loop serves
 * `operate` (which settles an exchange on success) and `question` (which does
 * not). `isLast` is how a caller tells the final attempt to stop failing fast:
 * reaching for another provider beats waiting out a rate limit right up until
 * there is no other provider.
 */
export async function runWithFallback<TInstance, TResult>({
  attempt,
  chain,
  createInstance,
  onExhausted,
  primary,
  primaryProvider,
}: {
  attempt: (context: FallbackAttemptContext<TInstance>) => Promise<TResult>;
  chain: LlmFallbackConfig[];
  createInstance: (config: LlmFallbackConfig) => TInstance;
  onExhausted?: (context: {
    attempts: number;
    error: Error;
  }) => Promise<void> | void;
  primary: TInstance;
  primaryProvider: string;
}): Promise<TResult> {
  let attempts = 0;
  let lastError: Error | undefined;

  attempts++;
  try {
    return await attempt({
      attempts,
      instance: primary,
      isLast: chain.length === 0,
      provider: primaryProvider,
    });
  } catch (error) {
    lastError = error as Error;
    log.warn(`Provider ${primaryProvider} failed`, {
      error: lastError.message,
      fallbacksRemaining: chain.length,
    });
  }

  for (const [index, config] of chain.entries()) {
    attempts++;
    try {
      return await attempt({
        attempts,
        instance: createInstance(config),
        isLast: index === chain.length - 1,
        provider: config.provider,
      });
    } catch (error) {
      lastError = error as Error;
      log.warn(`Fallback provider ${config.provider} failed`, {
        error: lastError.message,
        fallbacksRemaining: chain.length - attempts + 1,
      });
    }
  }

  await onExhausted?.({ attempts, error: lastError as Error });
  throw lastError;
}
