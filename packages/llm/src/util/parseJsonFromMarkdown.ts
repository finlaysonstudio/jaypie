import { log } from "@jaypie/logger";

//
//
// Types
//

export type FormatSchema = Record<string, unknown>;

//
//
// Helper Functions
//

/**
 * Normalize a string for case-insensitive, punctuation-insensitive comparison
 * Removes dashes, quotes, spaces, and underscores; converts to lowercase
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-'"_\s]/g, "");
}

/**
 * Find heading matches between markdown headings and format keys
 * Returns a map of normalized heading -> original format key
 */
function findHeadingMatches(
  headings: string[],
  formatKeys: string[],
): Map<string, string> {
  const matches = new Map<string, string>();
  const normalizedFormatKeys = new Map<string, string>();

  // Build normalized format key lookup
  for (const key of formatKeys) {
    normalizedFormatKeys.set(normalizeKey(key), key);
  }

  // Check each heading for a match
  for (const heading of headings) {
    const normalizedHeading = normalizeKey(heading);
    const matchedKey = normalizedFormatKeys.get(normalizedHeading);
    if (matchedKey) {
      matches.set(heading, matchedKey);
    }
  }

  return matches;
}

/**
 * Parse bullet list content into array of strings
 * Handles lines starting with "- " or "* "
 */
function parseBulletList(content: string): string[] {
  const lines = content.split("\n");
  const items: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      items.push(trimmed.slice(2).trim());
    } else if (trimmed.startsWith("* ")) {
      items.push(trimmed.slice(2).trim());
    }
  }

  return items;
}

/**
 * Check if a format value indicates an array of strings
 */
function isStringArrayFormat(formatValue: unknown): boolean {
  return (
    Array.isArray(formatValue) &&
    formatValue.length === 1 &&
    formatValue[0] === String
  );
}

/**
 * Extract sections from markdown content at a specific heading level
 * Returns map of heading text -> content between headings
 */
function extractSectionsAtLevel(
  content: string,
  level: number,
): Map<string, string> {
  const sections = new Map<string, string>();
  const prefix = "#".repeat(level) + " ";
  const lines = content.split("\n");

  let currentHeading: string | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith(prefix) && !line.startsWith(prefix + "#")) {
      // Save previous section
      if (currentHeading !== null) {
        sections.set(currentHeading, currentContent.join("\n").trim());
      }
      // Start new section
      currentHeading = line.slice(prefix.length).trim();
      currentContent = [];
    } else if (currentHeading !== null) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentHeading !== null) {
    sections.set(currentHeading, currentContent.join("\n").trim());
  }

  return sections;
}

/**
 * Find the minimum heading level present in the content
 */
function findMinHeadingLevel(content: string): number {
  const lines = content.split("\n");
  let minLevel = Infinity;

  for (const line of lines) {
    const match = line.match(/^(#+)\s/);
    if (match) {
      const level = match[1].length;
      if (level < minLevel) {
        minLevel = level;
      }
    }
  }

  return minLevel === Infinity ? 0 : minLevel;
}

//
//
// Main
//

/**
 * Parse JSON from markdown content using heading structure
 *
 * Finds the largest heading level available (usually # or ##).
 * If headings case-insensitively match format keys (ignoring dashes, quotes,
 * spaces, underscores), treats headings as keys and content between them as values.
 *
 * If top-level headings don't match, tries the next level down.
 *
 * For [String] format fields, parses bullet lists (- or *) into arrays.
 *
 * @param content - Markdown string to parse
 * @param format - Format schema defining expected keys and types
 * @returns Parsed object or null if parsing failed
 */
export function parseJsonFromMarkdown(
  content: string,
  format: FormatSchema,
): Record<string, unknown> | null {
  if (!content || typeof content !== "string") {
    return null;
  }

  // Check if content has markdown headings
  if (!content.includes("#")) {
    return null;
  }

  const formatKeys = Object.keys(format);
  const minLevel = findMinHeadingLevel(content);

  if (minLevel === 0) {
    return null;
  }

  // Try parsing at the minimum heading level first
  let sections = extractSectionsAtLevel(content, minLevel);
  let headings = Array.from(sections.keys());
  let matches = findHeadingMatches(headings, formatKeys);

  // If we have only one heading at this level and it doesn't match,
  // or if we have no matches but multiple headings exist at next level,
  // try the next level down
  if (matches.size === 0 || (headings.length === 1 && matches.size === 0)) {
    const nextLevel = minLevel + 1;
    const nextSections = extractSectionsAtLevel(content, nextLevel);
    const nextHeadings = Array.from(nextSections.keys());

    if (nextHeadings.length > 0) {
      const nextMatches = findHeadingMatches(nextHeadings, formatKeys);

      if (nextMatches.size > 0) {
        sections = nextSections;
        headings = nextHeadings;
        matches = nextMatches;
      }
    }
  }

  // If still no matches, log warning and return null
  if (matches.size === 0) {
    log.warn("parseJsonFromMarkdown: No matching headings found", {
      formatKeys,
      headings,
    });
    return null;
  }

  // Build result object
  const result: Record<string, unknown> = {};

  for (const [heading, formatKey] of matches) {
    const sectionContent = sections.get(heading) ?? "";
    const formatValue = format[formatKey];

    // Handle [String] format - parse bullet lists
    if (isStringArrayFormat(formatValue)) {
      const items = parseBulletList(sectionContent);
      result[formatKey] = items.length > 0 ? items : [];
    } else {
      // For other types, use trimmed content as-is
      result[formatKey] = sectionContent;
    }
  }

  return result;
}
