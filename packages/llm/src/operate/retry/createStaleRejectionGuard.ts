import { getLogger } from "../../util/index.js";
import { isTransientNetworkError } from "./isTransientNetworkError.js";

//
//
// Types
//

export interface StaleRejectionGuard {
  /** Install the unhandledRejection listener (idempotent) */
  install(): void;
  /** Remove the listener and forget recorded errors */
  remove(): void;
  /** Record an error the retry loop has caught and is handling */
  recordCaught(error: unknown): void;
}

//
//
// Helpers
//

/**
 * Compare an unhandled rejection reason against errors the retry loop has
 * already caught. Reference equality first, then fall back to message + name
 * — providers sometimes surface twin rejections as fresh Error instances
 * rebuilt from the same upstream failure.
 */
function matchesCaughtError(
  reason: unknown,
  caught: ReadonlySet<unknown>,
): boolean {
  if (caught.has(reason)) return true;
  if (!(reason instanceof Error)) return false;
  for (const handled of caught) {
    if (
      handled instanceof Error &&
      handled.name === reason.name &&
      handled.message === reason.message
    ) {
      return true;
    }
  }
  return false;
}

//
//
// Main
//

/**
 * Create a guard that suppresses unhandled rejections firing as siblings of
 * an error the retry loop has already caught. Provider SDKs occasionally
 * surface a single upstream failure as twin rejections — the retry layer
 * accepts responsibility for the first; this guard prevents the second from
 * crashing the host while the retry is in flight.
 *
 * The guard also continues to suppress transient socket teardown errors
 * (e.g. undici `TypeError: terminated`) emitted between attempts.
 */
export function createStaleRejectionGuard(): StaleRejectionGuard {
  const log = getLogger();
  const caughtErrors = new Set<unknown>();
  let listener:
    ((reason: unknown, promise: Promise<unknown>) => void) | undefined;

  return {
    install() {
      if (listener) return;
      listener = (reason, promise) => {
        if (isTransientNetworkError(reason)) {
          promise?.catch?.(() => {});
          log.trace("Suppressed stale socket error during retry");
          return;
        }
        if (matchesCaughtError(reason, caughtErrors)) {
          promise?.catch?.(() => {});
          log.trace("Suppressed sibling rejection of already-handled error");
        }
      };
      process.on("unhandledRejection", listener);
    },
    remove() {
      if (listener) {
        process.removeListener("unhandledRejection", listener);
        listener = undefined;
      }
      caughtErrors.clear();
    },
    recordCaught(error) {
      caughtErrors.add(error);
    },
  };
}
