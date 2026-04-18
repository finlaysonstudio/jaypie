//
//
// Helpers
//

function isWrappedData(value: unknown): value is { data: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    "data" in value
  );
}

function isWrappedErrors(value: unknown): value is { errors: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    "errors" in value
  );
}

//
//
// Main
//

/**
 * Wrap a service return value in the canonical Jaypie API envelope.
 *
 * Rules:
 * - `null` / `undefined` → `{ data: null }`
 * - `{ data }` with exactly one key → passthrough
 * - `{ errors }` with exactly one key → passthrough
 * - everything else (including `{ data, other }`) → `{ data: value }`
 *
 * The "only one key, and that key is `data` or `errors`" check prevents
 * false positives where a domain object happens to contain a `data` field.
 */
export function fabricApiResponse(result: unknown): unknown {
  if (result === null || result === undefined) return { data: null };
  if (isWrappedData(result) || isWrappedErrors(result)) return result;
  return { data: result };
}

export default fabricApiResponse;
