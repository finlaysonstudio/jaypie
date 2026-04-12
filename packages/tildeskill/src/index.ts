// Types
export type {
  LayeredStoreLayer,
  LayeredStoreOptions,
  ListFilter,
  MarkdownStoreOptions,
  SkillFrontMatter,
  SkillRecord,
  SkillStore,
} from "./types";

// Service factory
export { createSkillService } from "./service";

// Core utilities
export { expandIncludes } from "./core/expandIncludes";
export { normalizeAlias, parseList } from "./core/normalize";
export { getAlternativeSpellings } from "./core/spellings";
export { isValidAlias, validateAlias } from "./core/validate";

// Store factories
export { createLayeredStore } from "./stores/layered";
export { createMarkdownStore } from "./stores/markdown";
export { createMemoryStore } from "./stores/memory";
