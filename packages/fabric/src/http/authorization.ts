import { UnauthorizedError } from "@jaypie/errors";

import type { AuthorizationConfig, AuthorizationFunction } from "./types.js";

/**
 * Extract token from Authorization header
 * Removes "Bearer " prefix (case insensitive) and strips whitespace
 *
 * Examples:
 * - "Bearer eyJhbGc..." → "eyJhbGc..."
 * - "bearer eyJhbGc..." → "eyJhbGc..."
 * - "BEARER eyJhbGc..." → "eyJhbGc..."
 * - "eyJhbGc..." → "eyJhbGc..."
 * - "  eyJhbGc...  " → "eyJhbGc..."
 */
export function extractToken(authHeader: string | null | undefined): string {
  if (!authHeader) {
    return "";
  }

  let token = authHeader.trim();

  // Remove "Bearer " prefix (case insensitive)
  const bearerRegex = /^bearer\s+/i;
  if (bearerRegex.test(token)) {
    token = token.replace(bearerRegex, "");
  }

  return token.trim();
}

/**
 * Get authorization header from Headers object
 */
export function getAuthHeader(headers: Headers): string | null {
  return headers.get("authorization");
}

/**
 * Validate authorization and return auth context
 *
 * @param headers - Request headers
 * @param config - Authorization configuration (function or false)
 * @returns Auth context from the authorization function, or undefined if public
 * @throws UnauthorizedError if authorization fails
 */
export async function validateAuthorization<TAuth = unknown>(
  headers: Headers,
  config: AuthorizationConfig<TAuth>,
): Promise<TAuth | undefined> {
  // Public endpoint - no authorization required
  if (config === false) {
    return undefined;
  }

  const authHeader = getAuthHeader(headers);
  const token = extractToken(authHeader);

  // If authorization is required but no token provided
  if (!token) {
    throw new UnauthorizedError("Authorization header required");
  }

  // Call the authorization function
  const authFunction = config as AuthorizationFunction<TAuth>;
  return authFunction(token);
}

/**
 * Check if authorization is required
 */
export function isAuthorizationRequired(
  config: AuthorizationConfig<unknown>,
): boolean {
  return config !== false;
}
