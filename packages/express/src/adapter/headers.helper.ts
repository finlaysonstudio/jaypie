//
//
// Constants
//

// Set-Cookie is the one header that must never be comma-folded: cookie
// expiry dates contain commas, so a folded value is unparseable. Lambda
// carries these out-of-band in the `cookies` field of the v2 response
// payload and of the response-streaming metadata prelude.
export const SET_COOKIE = "set-cookie";

//
//
// Functions
//

/**
 * Normalize a header value for storage, preserving arrays.
 * Node's ServerResponse keeps multi-value headers as arrays; stringifying
 * here would fold them into a single comma-separated value.
 */
export function normalizeHeaderValue(
  value: number | string | string[],
): string | string[] {
  return Array.isArray(value) ? value.map(String) : String(value);
}

/**
 * Split stored headers into a single-value header record and a cookies
 * array, matching the Lambda Function URL (v2) response shape.
 */
export function splitCookieHeaders(source: Map<string, string | string[]>): {
  cookies: string[];
  headers: Record<string, string>;
} {
  const cookies: string[] = [];
  const headers: Record<string, string> = {};

  for (const [key, value] of source) {
    if (key === SET_COOKIE) {
      if (Array.isArray(value)) {
        cookies.push(...value);
      } else {
        cookies.push(value);
      }
    } else {
      headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
    }
  }

  return { cookies, headers };
}
