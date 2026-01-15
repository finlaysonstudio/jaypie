import type { HttpContext, HttpTransformFunction } from "./types.js";

/**
 * Default HTTP transformation function
 * Merges query parameters with body (body takes precedence)
 */
export const defaultHttpTransform: HttpTransformFunction = ({
  body,
  query,
}) => {
  const queryObject = Object.fromEntries(query.entries());
  const bodyObject = typeof body === "object" && body !== null ? body : {};

  return {
    ...queryObject,
    ...bodyObject,
  } as Record<string, unknown>;
};

/**
 * Parse query string into URLSearchParams
 */
export function parseQueryString(queryString: string): URLSearchParams {
  // Remove leading ? if present
  const normalized = queryString.startsWith("?")
    ? queryString.slice(1)
    : queryString;
  return new URLSearchParams(normalized);
}

/**
 * Parse path parameters from a URL path using a route pattern
 * @param path - The actual URL path (e.g., "/users/123")
 * @param pattern - The route pattern (e.g., "/users/:id")
 * @returns Object with extracted parameters
 */
export function parsePathParams(
  path: string,
  pattern: string,
): Record<string, string> {
  const params: Record<string, string> = {};

  const pathParts = path.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(":")) {
      // Extract parameter name (remove : prefix and ? suffix for optional params)
      const paramName = patternPart.slice(1).replace("?", "");
      if (pathPart !== undefined) {
        params[paramName] = pathPart;
      }
    }
  }

  return params;
}

/**
 * Parse request body from string or return as-is if already parsed
 */
export function parseBody(body: unknown): unknown {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      // Return as-is if not valid JSON
      return body;
    }
  }
  return body;
}

/**
 * Create HTTP context from raw request data
 */
export function createHttpContext(options: {
  body?: unknown;
  headers?: Headers | Record<string, string>;
  method?: string;
  path?: string;
  queryString?: string;
  params?: Record<string, string>;
}): HttpContext {
  const {
    body = {},
    headers = {},
    method = "GET",
    path = "/",
    queryString = "",
    params = {},
  } = options;

  // Normalize headers to Headers object
  const normalizedHeaders =
    headers instanceof Headers
      ? headers
      : new Headers(headers as Record<string, string>);

  return {
    body: parseBody(body),
    headers: normalizedHeaders,
    method: method.toUpperCase(),
    path,
    query: parseQueryString(queryString),
    params,
  };
}

/**
 * Apply HTTP transformation to get service input
 */
export async function transformHttpToInput<TInput = Record<string, unknown>>(
  context: HttpContext,
  transform: HttpTransformFunction<TInput> = defaultHttpTransform as HttpTransformFunction<TInput>,
): Promise<TInput> {
  return transform(context);
}
