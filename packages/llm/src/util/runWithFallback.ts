import log from "@jaypie/logger";

import { LlmAbortError, LlmIncompleteError } from "../errors/LlmError.js";
import { ErrorCategory } from "../operate/types.js";
import { LlmFallbackConfig } from "../types/LlmProvider.interface.js";
import { failureKind, tallyFailure } from "./tallyFailure.js";

//
//
// Constants
//

// Tallied in place of a thrown error when a returned result fails over, so
// the report counts it under the `incomplete` kind
const SOFT_FAILURE = new LlmIncompleteError();

//
//
// Types
//

export interface FallbackAttemptContext<TInstance> {
  /** 1 for the primary, incrementing through the chain and the linger pass */
  attempts: number;
  /**
   * The fallback entry this attempt serves; undefined for the primary
   * (including its linger pass)
   */
  config?: LlmFallbackConfig;
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
 *
 * `shouldFailover` marks a returned result as a soft failure (operate's
 * incomplete response): the chain moves past it like a thrown error, but it
 * is kept. When nothing better arrives, the latest one is returned instead of
 * throwing, since a partial answer beats an error. A primary that returned
 * one never lingers: rerunning the same model would cut off the same way.
 * `isEmptyResult` marks a soft failure that brought nothing back; it never
 * displaces a kept one, so an earlier partial survives a later empty answer.
 *
 * `settle` finalizes whichever result reaches the caller, with the total
 * attempts made.
 */
export async function runWithFallback<TInstance, TResult>({
  attempt,
  chain,
  createInstance,
  isEmptyResult,
  onExhausted,
  primary,
  primaryProvider,
  settle = ({ result }) => result,
  shouldFailover,
}: {
  attempt: (context: FallbackAttemptContext<TInstance>) => Promise<TResult>;
  chain: LlmFallbackConfig[];
  createInstance: (config: LlmFallbackConfig) => TInstance;
  isEmptyResult?: (result: TResult) => boolean;
  onExhausted?: (context: {
    attempts: number;
    error: Error;
  }) => Promise<void> | void;
  primary: TInstance;
  primaryProvider: string;
  settle?: (context: {
    attempts: number;
    result: TResult;
  }) => Promise<TResult> | TResult;
  shouldFailover?: (result: TResult) => boolean;
}): Promise<TResult> {
  const failFast = chain.length > 0;
  const candidates: Array<
    () => { config?: LlmFallbackConfig; instance: TInstance; provider: string }
  > = [
    () => ({ instance: primary, provider: primaryProvider }),
    ...chain.map((config) => () => ({
      config,
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
  let softFailure: { result: TResult } | undefined;
  let skipLinger = false;
  // Candidates still to run after `made` attempts, less a skipped linger pass
  const remainingAfter = (made: number) =>
    candidates.length - made - (skipLinger ? 1 : 0);

  for (const [index, candidate] of candidates.entries()) {
    const lingering = failFast && index === candidates.length - 1;
    if (lingering && skipLinger) {
      break;
    }
    attempts++;
    const { config, instance, provider } = candidate();
    let result: TResult;
    try {
      result = await attempt({
        attempts,
        config,
        failFast: failFast && !lingering,
        instance,
        provider,
      });
    } catch (error) {
      if (error instanceof LlmAbortError) {
        throw error;
      }
      lastError = error as Error;
      const attemptsRemaining = remainingAfter(attempts);
      const failover = attemptsRemaining > 0;
      tallyFailure({ error, failover, model: config?.model, provider });
      const detail = {
        attemptsRemaining,
        error: lastError.message,
        kind: failureKind(error),
      };
      // Handing off to the next model is the chain working as designed; only
      // the failure that reaches the caller warns
      if (failover) {
        log.debug(`Provider ${provider} failed; failing over`, detail);
      } else {
        log.warn(
          lingering
            ? `Provider ${provider} failed after lingering`
            : `Provider ${provider} failed`,
          detail,
        );
      }
      continue;
    }

    // Outside the try: a throw from `settle` reaches the caller, it is not
    // another failed attempt
    if (!shouldFailover?.(result)) {
      return await settle({ attempts, result });
    }
    if (!softFailure || !isEmptyResult?.(result)) {
      softFailure = { result };
    }
    if (index === 0) {
      skipLinger = true;
    }
    const attemptsRemaining = remainingAfter(attempts);
    const failover = attemptsRemaining > 0;
    tallyFailure({
      error: SOFT_FAILURE,
      failover,
      model: config?.model,
      provider,
    });
    if (failover) {
      log.debug(`Provider ${provider} returned incomplete; failing over`, {
        attemptsRemaining,
        kind: ErrorCategory.Incomplete,
      });
    }
  }

  if (softFailure) {
    return await settle({ attempts, result: softFailure.result });
  }
  await onExhausted?.({ attempts, error: lastError as Error });
  throw lastError;
}
