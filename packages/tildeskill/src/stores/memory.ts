import { normalizeAlias } from "../core/normalize";
import {
  filterByNickname,
  filterSkills,
  findWithFallback,
  searchSkills,
} from "../core/records";
import type { ListFilter, SkillRecord, SkillStore } from "../types";

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

  async function get(alias: string): Promise<SkillRecord | null> {
    return store.get(normalizeAlias(alias)) ?? null;
  }

  return {
    async delete(alias: string): Promise<boolean> {
      return store.delete(normalizeAlias(alias));
    },

    async find(alias: string): Promise<SkillRecord | null> {
      return findWithFallback(alias, { get });
    },

    get,

    async getByNickname(nickname: string): Promise<SkillRecord[]> {
      return filterByNickname({ nickname, records: [...store.values()] });
    },

    async list(filter?: ListFilter): Promise<SkillRecord[]> {
      return filterSkills({ filter, records: [...store.values()] });
    },

    async put(record: SkillRecord): Promise<SkillRecord> {
      const normalized = normalizeAlias(record.alias);
      const stored = { ...record, alias: normalized };
      store.set(normalized, stored);
      return stored;
    },

    async search(term: string): Promise<SkillRecord[]> {
      return searchSkills({ records: [...store.values()], term });
    },
  };
}
