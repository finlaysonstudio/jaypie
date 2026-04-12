import { normalizeAlias } from "./normalize";

/**
 * Generate alternative plural/singular spellings for an alias.
 * Returns candidates to try when an exact lookup misses, preserving the
 * order originally used by @jaypie/mcp's skill router.
 */
export function getAlternativeSpellings(alias: string): string[] {
  const normalized = normalizeAlias(alias);
  const alternatives: string[] = [];

  if (normalized.endsWith("es")) {
    alternatives.push(normalized.slice(0, -1));
    alternatives.push(normalized.slice(0, -2));
  } else if (normalized.endsWith("s")) {
    alternatives.push(normalized.slice(0, -1));
  } else {
    alternatives.push(normalized + "s");
    alternatives.push(normalized + "es");
  }

  return alternatives;
}
