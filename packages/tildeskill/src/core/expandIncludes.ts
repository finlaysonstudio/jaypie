import type { SkillRecord, SkillStore } from "../types";

/**
 * Expand included skills' content before the record's content
 *
 * @param store - The skill store to fetch includes from
 * @param record - The skill record to expand
 * @returns The record content with included skills prepended
 */
export async function expandIncludes(
  store: SkillStore,
  record: SkillRecord,
): Promise<string> {
  // No includes, return content as-is
  if (!record.includes || record.includes.length === 0) {
    return record.content;
  }

  const visited = new Set<string>([record.alias]);
  const expandedParts: string[] = [];

  for (const includeAlias of record.includes) {
    const expanded = await expandSingle(store, includeAlias, visited);
    if (expanded) {
      expandedParts.push(expanded);
    }
  }

  if (expandedParts.length === 0) {
    return record.content;
  }

  return [...expandedParts, record.content].join("\n\n");
}

/**
 * Recursively expand a single include
 */
async function expandSingle(
  store: SkillStore,
  alias: string,
  visited: Set<string>,
): Promise<string | null> {
  // Prevent circular includes
  if (visited.has(alias)) {
    return null;
  }

  visited.add(alias);

  const included = await store.get(alias);
  if (!included) {
    // Missing include - skip silently
    return null;
  }

  // Recursively expand nested includes
  if (included.includes && included.includes.length > 0) {
    const nestedParts: string[] = [];
    for (const nestedAlias of included.includes) {
      const nested = await expandSingle(store, nestedAlias, visited);
      if (nested) {
        nestedParts.push(nested);
      }
    }
    if (nestedParts.length > 0) {
      return [...nestedParts, included.content].join("\n\n");
    }
  }

  return included.content;
}
