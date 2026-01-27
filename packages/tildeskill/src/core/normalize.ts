/**
 * Normalize an alias to lowercase trimmed format
 */
export function normalizeAlias(alias: string): string {
  return alias.toLowerCase().trim();
}

/**
 * Parse a comma-separated string or array into a normalized array of aliases
 */
export function parseList(input: string | string[] | undefined): string[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.map(normalizeAlias).filter(Boolean);
  }

  return input
    .split(",")
    .map((item) => normalizeAlias(item))
    .filter(Boolean);
}
