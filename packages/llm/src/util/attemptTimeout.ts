import { LlmTimeoutError } from "../errors/LlmError.js";

//
//
// Constants
//

export const ATTEMPT_TIMEOUT_REASON = "timeout";

//
//
// Main
//

/**
 * Normalize a `timeout` option to a positive millisecond deadline, or
 * undefined when no deadline applies (unset, `false`, zero, or invalid).
 */
export function resolveAttemptTimeout(
  timeout?: number | false,
): number | undefined {
  if (typeof timeout !== "number" || !Number.isFinite(timeout)) {
    return undefined;
  }
  return timeout > 0 ? timeout : undefined;
}

/**
 * Arm a per-attempt deadline. When it fires, the attempt's controller aborts
 * (cancelling the in-flight request) and `expired` rejects with
 * {@link LlmTimeoutError}. Adapters swallow errors once their signal aborts,
 * so the attempt must lose a race against `expired` rather than rely on the
 * request rejecting. `reset` restarts the clock (a stream's idle timeout);
 * `clear` disarms it. With no deadline, `expired` never settles.
 */
export function armAttemptTimeout({
  controller,
  model,
  provider,
  timeout,
}: {
  controller: AbortController;
  model?: string;
  provider?: string;
  timeout?: number;
}): {
  clear: () => void;
  expired: Promise<never>;
  reset: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reject: ((error: LlmTimeoutError) => void) | undefined;
  const expired = new Promise<never>((_, rejectExpired) => {
    reject = rejectExpired;
  });
  // A deadline nobody awaits (the attempt settled first) must not surface as
  // an unhandled rejection
  expired.catch(() => {});

  const clear = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const reset = () => {
    clear();
    if (!timeout || controller.signal.aborted) {
      return;
    }
    timer = setTimeout(() => {
      timer = undefined;
      // Reject before aborting: an adapter that settles on abort must not
      // win the race with an empty response
      reject?.(
        new LlmTimeoutError(`Request attempt timed out after ${timeout}ms`, {
          model,
          provider,
          timeoutMs: timeout,
        }),
      );
      controller.abort(ATTEMPT_TIMEOUT_REASON);
    }, timeout);
  };

  reset();
  return { clear, expired, reset };
}
