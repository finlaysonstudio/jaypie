import {
  createMockFunction,
  createMockResolvedFunction,
  createMockReturnedFunction,
} from "./utils";

import type { SkillRecord, SkillStore } from "@jaypie/tildeskill";

// Core utilities
export const isValidAlias = createMockReturnedFunction(true);
export const normalizeAlias = createMockFunction((alias: string) =>
  alias.toLowerCase().trim(),
);
export const parseList = createMockFunction(
  (input: string | string[] | undefined) => {
    if (!input) return [];
    if (Array.isArray(input)) return input.map((s) => s.toLowerCase().trim());
    return input.split(",").map((s) => s.toLowerCase().trim());
  },
);
export const validateAlias = createMockFunction((alias: string) =>
  alias.toLowerCase().trim(),
);

// Store factories
function createMockStore(initial: SkillRecord[] = []): SkillStore {
  const store = new Map<string, SkillRecord>();
  for (const record of initial) {
    store.set(record.alias.toLowerCase(), record);
  }

  return {
    get: createMockResolvedFunction(null),
    list: createMockResolvedFunction([]),
    put: createMockResolvedFunction({
      alias: "mock",
      content: "# Mock",
    } as SkillRecord),
  };
}

export const createMarkdownStore = createMockFunction(() => createMockStore());
export const createMemoryStore = createMockFunction(
  (initial?: SkillRecord[]) => {
    const store = new Map<string, SkillRecord>();
    if (initial) {
      for (const record of initial) {
        store.set(record.alias.toLowerCase(), record);
      }
    }

    return {
      get: createMockResolvedFunction(null),
      list: createMockResolvedFunction([]),
      put: createMockResolvedFunction({
        alias: "mock",
        content: "# Mock",
      } as SkillRecord),
    } as SkillStore;
  },
);
