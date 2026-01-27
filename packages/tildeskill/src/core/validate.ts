import { BadRequestError } from "@jaypie/errors";

import { normalizeAlias } from "./normalize";

/** Pattern for valid skill aliases: lowercase alphanumeric, hyphens, underscores */
const VALID_ALIAS_PATTERN = /^[a-z0-9_-]+$/;

/**
 * Check if an alias is valid (no path traversal, valid characters)
 */
export function isValidAlias(alias: string): boolean {
  const normalized = normalizeAlias(alias);

  // Reject path traversal attempts
  if (
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.includes("..")
  ) {
    return false;
  }

  // Must match valid pattern
  return VALID_ALIAS_PATTERN.test(normalized);
}

/**
 * Validate and normalize an alias, throwing BadRequestError if invalid
 */
export function validateAlias(alias: string): string {
  const normalized = normalizeAlias(alias);

  if (!isValidAlias(normalized)) {
    throw new BadRequestError(
      `Invalid skill alias "${alias}". Use alphanumeric characters, hyphens, and underscores only.`,
    );
  }

  return normalized;
}
