import { createHash } from "node:crypto";

import type { ListFilter, SkillRecord } from "../types";
import { normalizeAlias } from "./normalize";
import { getAlternativeSpellings } from "./spellings";

const HASH_ALGORITHM = "sha256";

/** Every SkillRecord field, in canonical (alphabetical) order */
const SKILL_FIELDS = [
  "alias",
  "content",
  "description",
  "includes",
  "name",
  "nicknames",
  "related",
  "tags",
] as const;

function sortByAlias(records: SkillRecord[]): SkillRecord[] {
  return records.sort((a, b) => a.alias.localeCompare(b.alias));
}

/**
 * Return a copy of a record with only SkillRecord fields, in canonical order,
 * dropping undefined values and empty lists.
 */
export function compactSkill(record: SkillRecord): SkillRecord {
  const compact: Record<string, unknown> = {};
  for (const field of SKILL_FIELDS) {
    const value = record[field];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    compact[field] = value;
  }
  return compact as unknown as SkillRecord;
}

/**
 * Hash a skill record for change detection (sha256 hex).
 *
 * Covers every SkillRecord field, so frontmatter changes register as well as
 * content changes. Key order, undefined fields, and empty lists do not affect
 * the hash; list order does.
 */
export function hashSkill(record: SkillRecord): string {
  return createHash(HASH_ALGORITHM)
    .update(JSON.stringify(compactSkill(record)))
    .digest("hex");
}

/**
 * Apply a ListFilter (namespace prefix, tag) and sort by alias
 */
export function filterSkills({
  filter,
  records,
}: {
  filter?: ListFilter;
  records: SkillRecord[];
}): SkillRecord[] {
  let filtered = records;

  if (filter?.namespace) {
    // Remove trailing "*" if present for prefix matching
    const prefix = filter.namespace.endsWith("*")
      ? filter.namespace.slice(0, -1)
      : filter.namespace;
    filtered = filtered.filter((r) => r.alias.startsWith(prefix));
  }

  if (filter?.tag) {
    const normalizedTag = normalizeAlias(filter.tag);
    filtered = filtered.filter((r) =>
      r.tags?.map(normalizeAlias).includes(normalizedTag),
    );
  }

  return sortByAlias([...filtered]);
}

/**
 * Records whose nicknames include the given value, sorted by alias
 */
export function filterByNickname({
  nickname,
  records,
}: {
  nickname: string;
  records: SkillRecord[];
}): SkillRecord[] {
  const normalized = normalizeAlias(nickname);
  return sortByAlias(
    records.filter((record) =>
      record.nicknames?.map(normalizeAlias).includes(normalized),
    ),
  );
}

/**
 * Resolve an alias through `get`, trying plural/singular alternatives when an
 * exact match is not found
 */
export async function findWithFallback(
  alias: string,
  { get }: { get: (alias: string) => Promise<SkillRecord | null> },
): Promise<SkillRecord | null> {
  const normalized = normalizeAlias(alias);
  const exact = await get(normalized);
  if (exact) return exact;
  for (const alternative of getAlternativeSpellings(normalized)) {
    const candidate = await get(alternative);
    if (candidate) return candidate;
  }
  return null;
}

/**
 * Records matching a term in alias, name, description, content, or tags,
 * sorted by alias
 */
export function searchSkills({
  records,
  term,
}: {
  records: SkillRecord[];
  term: string;
}): SkillRecord[] {
  const normalizedTerm = term.toLowerCase();
  return sortByAlias(
    records.filter(
      (record) =>
        record.alias.toLowerCase().includes(normalizedTerm) ||
        record.name?.toLowerCase().includes(normalizedTerm) ||
        record.description?.toLowerCase().includes(normalizedTerm) ||
        record.content.toLowerCase().includes(normalizedTerm) ||
        record.tags?.some((tag) => tag.toLowerCase().includes(normalizedTerm)),
    ),
  );
}
