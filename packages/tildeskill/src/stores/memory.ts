import type { ListFilter, SkillRecord, SkillStore } from "../types";

import { normalizeAlias } from "../core/normalize";
import { getAlternativeSpellings } from "../core/spellings";

/**
 * Create an in-memory skill store, useful for testing
 */
export function createMemoryStore(initial?: SkillRecord[]): SkillStore {
  const store = new Map<string, SkillRecord>();

  // Initialize with provided records
  if (initial) {
    for (const record of initial) {
      const normalized = normalizeAlias(record.alias);
      store.set(normalized, { ...record, alias: normalized });
    }
  }

  return {
    async find(alias: string): Promise<SkillRecord | null> {
      const normalized = normalizeAlias(alias);
      const exact = store.get(normalized);
      if (exact) return exact;
      for (const alt of getAlternativeSpellings(normalized)) {
        const candidate = store.get(alt);
        if (candidate) return candidate;
      }
      return null;
    },

    async get(alias: string): Promise<SkillRecord | null> {
      const normalized = normalizeAlias(alias);
      return store.get(normalized) ?? null;
    },

    async getByNickname(nickname: string): Promise<SkillRecord[]> {
      const normalized = normalizeAlias(nickname);
      const matches: SkillRecord[] = [];
      for (const record of store.values()) {
        if (record.nicknames?.map(normalizeAlias).includes(normalized)) {
          matches.push(record);
        }
      }
      return matches.sort((a, b) => a.alias.localeCompare(b.alias));
    },

    async list(filter?: ListFilter): Promise<SkillRecord[]> {
      let records = Array.from(store.values());

      if (filter?.namespace) {
        // Remove trailing "*" if present for prefix matching
        const prefix = filter.namespace.endsWith("*")
          ? filter.namespace.slice(0, -1)
          : filter.namespace;
        records = records.filter((r) => r.alias.startsWith(prefix));
      }

      if (filter?.tag) {
        const normalizedTag = normalizeAlias(filter.tag);
        records = records.filter((r) =>
          r.tags?.map(normalizeAlias).includes(normalizedTag),
        );
      }

      return records.sort((a, b) => a.alias.localeCompare(b.alias));
    },

    async put(record: SkillRecord): Promise<SkillRecord> {
      const normalized = normalizeAlias(record.alias);
      const stored = { ...record, alias: normalized };
      store.set(normalized, stored);
      return stored;
    },

    async search(term: string): Promise<SkillRecord[]> {
      const normalizedTerm = term.toLowerCase();
      const results: SkillRecord[] = [];

      for (const record of store.values()) {
        // Search in alias
        if (record.alias.toLowerCase().includes(normalizedTerm)) {
          results.push(record);
          continue;
        }
        // Search in name
        if (record.name?.toLowerCase().includes(normalizedTerm)) {
          results.push(record);
          continue;
        }
        // Search in description
        if (record.description?.toLowerCase().includes(normalizedTerm)) {
          results.push(record);
          continue;
        }
        // Search in content
        if (record.content.toLowerCase().includes(normalizedTerm)) {
          results.push(record);
          continue;
        }
        // Search in tags
        if (
          record.tags?.some((tag) => tag.toLowerCase().includes(normalizedTerm))
        ) {
          results.push(record);
          continue;
        }
      }

      return results.sort((a, b) => a.alias.localeCompare(b.alias));
    },
  };
}
