import { getLogger } from "../../util/index.js";
import { isTransientNetworkError } from "./isTransientNetworkError.js";

//
//
// Types
//

export interface StaleRejectionGuard {
  /** Activate the guard on the shared unhandledRejection listener (idempotent) */
  install(): void;
  /** Deactivate the guard and forget recorded errors */
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
// Registry
//

interface ActiveGuard {
  caughtErrors: ReadonlySet<unknown>;
}

// One process listener serves every active guard so the listener count stays
// constant under concurrent retries (issue #597)
const activeGuards = new Set<ActiveGuard>();
let sharedListener:
  ((reason: unknown, promise: Promise<unknown>) => void) | undefined;

function handleUnhandledRejection(
  reason: unknown,
  promise: Promise<unknown>,
): void {
  const log = getLogger();
  if (isTransientNetworkError(reason)) {
    promise?.catch?.(() => {});
    log.trace("Suppressed stale socket error during retry");
    return;
  }
  for (const guard of activeGuards) {
    if (matchesCaughtError(reason, guard.caughtErrors)) {
      promise?.catch?.(() => {});
      log.trace("Suppressed sibling rejection of already-handled error");
      return;
    }
  }
}

function activate(guard: ActiveGuard): void {
  activeGuards.add(guard);
  if (!sharedListener) {
    sharedListener = handleUnhandledRejection;
    process.on("unhandledRejection", sharedListener);
  }
}

function deactivate(guard: ActiveGuard): void {
  activeGuards.delete(guard);
  if (activeGuards.size === 0 && sharedListener) {
    process.removeListener("unhandledRejection", sharedListener);
    sharedListener = undefined;
  }
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
 *
 * All active guards share a single process `unhandledRejection` listener,
 * installed with the first guard and removed with the last.
 */
export function createStaleRejectionGuard(): StaleRejectionGuard {
  const caughtErrors = new Set<unknown>();
  const guard: ActiveGuard = { caughtErrors };
  let installed = false;

  return {
    install() {
      if (installed) return;
      installed = true;
      activate(guard);
    },
    remove() {
      if (installed) {
        deactivate(guard);
        installed = false;
      }
      caughtErrors.clear();
    },
    recordCaught(error) {
      caughtErrors.add(error);
    },
  };
}
