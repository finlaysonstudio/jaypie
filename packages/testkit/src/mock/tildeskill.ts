import {
  createMockFunction,
  createMockResolvedFunction,
  createMockReturnedFunction,
} from "./utils";

import type { SkillRecord, SkillStore } from "@jaypie/tildeskill";

// Core utilities
export const expandIncludes = createMockFunction(
  async (_store: SkillStore, record: SkillRecord) => record.content,
);
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
function createMockStore(): SkillStore {
  return {
    get: createMockResolvedFunction(null),
    getByNickname: createMockResolvedFunction(null),
    list: createMockResolvedFunction([]),
    put: createMockResolvedFunction({
      alias: "mock",
      content: "# Mock",
    } as SkillRecord),
    search: createMockResolvedFunction([]),
  };
}

export const createMarkdownStore = createMockFunction(() => createMockStore());
export const createMemoryStore = createMockFunction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (_initial?: SkillRecord[]) => createMockStore(),
);
