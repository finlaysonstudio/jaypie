import type { SkillRecord, SkillStore } from "../types";

import { normalizeAlias } from "../core/normalize";

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
    async get(alias: string): Promise<SkillRecord | null> {
      const normalized = normalizeAlias(alias);
      return store.get(normalized) ?? null;
    },

    async list(): Promise<SkillRecord[]> {
      return Array.from(store.values()).sort((a, b) =>
        a.alias.localeCompare(b.alias),
      );
    },

    async put(record: SkillRecord): Promise<SkillRecord> {
      const normalized = normalizeAlias(record.alias);
      const stored = { ...record, alias: normalized };
      store.set(normalized, stored);
      return stored;
    },
  };
}
