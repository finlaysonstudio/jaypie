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
export const getAlternativeSpellings = createMockFunction((alias: string) => {
  const normalized = alias.toLowerCase().trim();
  if (normalized.endsWith("es")) {
    return [normalized.slice(0, -1), normalized.slice(0, -2)];
  }
  if (normalized.endsWith("s")) {
    return [normalized.slice(0, -1)];
  }
  return [normalized + "s", normalized + "es"];
});
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
    find: createMockResolvedFunction(null),
    get: createMockResolvedFunction(null),
    getByNickname: createMockResolvedFunction([] as SkillRecord[]),
    list: createMockResolvedFunction([]),
    put: createMockResolvedFunction({
      alias: "mock",
      content: "# Mock",
    } as SkillRecord),
    search: createMockResolvedFunction([]),
  };
}

export const createLayeredStore = createMockFunction(() => createMockStore());
export const createSkillService = createMockFunction(() => {
  const service = createMockResolvedFunction("# Mock Skill Content");
  (service as unknown as Record<string, unknown>).$fabric = "mock";
  (service as unknown as Record<string, unknown>).alias = "skill";
  (service as unknown as Record<string, unknown>).description =
    "Mock skill service";
  (service as unknown as Record<string, unknown>).input = {
    alias: { description: "Skill alias", required: false, type: String },
  };
  return service;
});
export const createMarkdownStore = createMockFunction(() => createMockStore());
export const createMemoryStore = createMockFunction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (_initial?: SkillRecord[]) => createMockStore(),
);
