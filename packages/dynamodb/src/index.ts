// Client initialization
export {
  getDocClient,
  getTableName,
  initClient,
  isInitialized,
  resetClient,
} from "./client.js";

// Constants
export {
  APEX,
  ARCHIVED_SUFFIX,
  DELETED_SUFFIX,
  INDEX_ALIAS,
  INDEX_CLASS,
  INDEX_OU,
  INDEX_TYPE,
  INDEX_XID,
  SEPARATOR,
} from "./constants.js";

// Entity operations
export {
  archiveEntity,
  deleteEntity,
  destroyEntity,
  getEntity,
  putEntity,
  updateEntity,
} from "./entities.js";

// Key builders and entity utilities
export {
  buildCompositeKey,
  buildIndexAlias,
  buildIndexClass,
  buildIndexOu,
  buildIndexType,
  buildIndexXid,
  calculateOu,
  DEFAULT_INDEXES,
  indexEntity,
} from "./keyBuilders.js";

// Query utilities (legacy named functions)
export {
  queryByAlias,
  queryByClass,
  queryByOu,
  queryByType,
  queryByXid,
} from "./queries.js";

// Unified query function with auto-detect
export { query } from "./query.js";
export type { QueryParams } from "./query.js";

// Seed and export utilities
export {
  exportEntities,
  exportEntitiesToJson,
  seedEntities,
  seedEntityIfNotExists,
} from "./seedExport.js";

// Types
export type {
  BaseQueryOptions,
  DynamoClientConfig,
  /** @deprecated Use StorableEntity instead */
  FabricEntity,
  ParentReference,
  QueryResult,
  StorableEntity,
} from "./types.js";

export type { ExportResult, SeedOptions, SeedResult } from "./seedExport.js";
