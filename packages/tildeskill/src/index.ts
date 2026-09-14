// Types
export type {
  DynamoDbStoreOptions,
  LayeredStoreLayer,
  LayeredStoreOptions,
  ListFilter,
  MarkdownStoreOptions,
  SkillFrontMatter,
  SkillRecord,
  SkillStore,
  SyncSkillsOptions,
  SyncSkillsResult,
} from "./types";

// Service factory
export { createSkillService } from "./service";

// Sync
export { syncSkills } from "./sync";

// Core utilities
export { expandIncludes } from "./core/expandIncludes";
export { normalizeAlias, parseList } from "./core/normalize";
export { hashSkill } from "./core/records";
export { getAlternativeSpellings } from "./core/spellings";
export { isValidAlias, validateAlias } from "./core/validate";

// Models
export {
  registerSkillModel,
  SKILL_MODEL,
  SKILL_MODEL_NAME,
} from "./models/skill";

// Store factories
export { createLayeredStore } from "./stores/layered";
export { createMarkdownStore } from "./stores/markdown";
export { createMemoryStore } from "./stores/memory";
