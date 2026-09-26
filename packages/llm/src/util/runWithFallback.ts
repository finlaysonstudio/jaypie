import log from "@jaypie/logger";

import { LlmAbortError } from "../errors/LlmError.js";
import { LlmFallbackConfig } from "../types/LlmProvider.interface.js";

export interface FallbackAttemptContext<TInstance> {
  /** 1 for the primary, incrementing through the chain and the linger pass */
  attempts: number;
  /**
   * True while working down a chain: the attempt should throw on its first
   * failure (rate limit, transient, anything) so the next model takes over.
   * False on a lone model and on the final linger pass, which keep the full
   * retry policy.
   */
  failFast: boolean;
  instance: TInstance;
  provider: string;
}

/**
 * Try the primary, then each fallback in turn, returning the first success.
 *
 * With a chain, every candidate (the last included) fails fast so the next
 * model takes over at once. When the whole chain fails, the primary runs one
 * more time with `failFast: false`, lingering on its full retry policy. If
 * that fails too, the last error is rethrown. A lone model (empty chain)
 * runs once with the full policy.
 *
 * The attempt callback owns what "success" means, so the same loop serves
 * `operate` (which settles an exchange on success), `ocr`, and `question`.
 * A caller abort ({@link LlmAbortError}) is terminal and never falls over.
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
  const failFast = chain.length > 0;
  const candidates: Array<() => { instance: TInstance; provider: string }> = [
    () => ({ instance: primary, provider: primaryProvider }),
    ...chain.map((config) => () => ({
      instance: createInstance(config),
      provider: config.provider,
    })),
  ];
  // The linger pass: the chain is spent, so the primary waits out its full
  // retry policy before giving up
  if (failFast) {
    candidates.push(() => ({ instance: primary, provider: primaryProvider }));
  }

  let attempts = 0;
  let lastError: Error | undefined;

  for (const [index, candidate] of candidates.entries()) {
    attempts++;
    const { instance, provider } = candidate();
    const lingering = failFast && index === candidates.length - 1;
    try {
      return await attempt({
        attempts,
        failFast: failFast && !lingering,
        instance,
        provider,
      });
    } catch (error) {
      if (error instanceof LlmAbortError) {
        throw error;
      }
      lastError = error as Error;
      log.warn(
        lingering
          ? `Provider ${provider} failed after lingering`
          : `Provider ${provider} failed`,
        {
          attemptsRemaining: candidates.length - attempts,
          error: lastError.message,
        },
      );
    }
  }

  await onExhausted?.({ attempts, error: lastError as Error });
  throw lastError;
}
