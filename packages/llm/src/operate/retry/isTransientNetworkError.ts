/**
 * Transient network error detection utility.
 *
 * Detects low-level Node.js/undici network errors that indicate
 * a temporary network issue (not a provider API error).
 * These errors should always be retried.
 */

//
//
// Constants
//

/** Error codes from Node.js net/dns subsystems that indicate transient failures */
const TRANSIENT_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "ENETRESET",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
]);

/** Substrings in error messages that indicate transient network issues */
const TRANSIENT_MESSAGE_PATTERNS = [
  "network",
  "socket hang up",
  "terminated",
] as const;

//
//
// Helpers
//

/**
 * Check a single error (without walking the cause chain)
 */
function matchesSingleError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Check error code (e.g., ECONNRESET)
  const code = (error as { code?: string }).code;
  if (code && TRANSIENT_ERROR_CODES.has(code)) {
    return true;
  }

  // Check error message for transient patterns
  const message = error.message.toLowerCase();
  for (const pattern of TRANSIENT_MESSAGE_PATTERNS) {
    if (message.includes(pattern)) {
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
 * Detect transient network errors by inspecting the error and its cause chain.
 *
 * Undici (Node.js fetch) wraps low-level errors like ECONNRESET inside
 * `TypeError: terminated`. This function recursively walks `error.cause`
 * to detect these wrapped errors.
 *
 * @param error - The error to inspect
 * @returns true if the error (or any cause in its chain) is a transient network error
 */
export function isTransientNetworkError(error: unknown): boolean {
  let current: unknown = error;

  while (current) {
    if (matchesSingleError(current)) {
      return true;
    }

    // Walk the cause chain (cause is ES2022, cast for compatibility)
    const cause = (current as { cause?: unknown }).cause;
    if (current instanceof Error && cause) {
      current = cause;
    } else {
      break;
    }
  }

  return false;
}
