// Client initialization
export {
  getClient,
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
  DEFAULT_TTL_ATTRIBUTE,
  DELETED_SUFFIX,
  SEPARATOR,
} from "./constants.js";

// TTL resolution
export { resolveTtl } from "./ttl.js";
export type { TtlInput } from "./ttl.js";

// Entity operations
export {
  archiveEntity,
  createEntity,
  deleteEntity,
  destroyEntity,
  getEntity,
  transactWriteEntities,
  transitionEntity,
  updateEntity,
} from "./entities.js";

// Key builders and entity utilities
export {
  buildCompositeKey,
  calculateScope,
  indexEntity,
} from "./keyBuilders.js";

// Query utilities (legacy named functions)
export {
  queryByAlias,
  queryByCategory,
  queryByScope,
  queryByType,
  queryByXid,
} from "./queries.js";

// Unified query function with auto-detect
export { query } from "./query.js";
export type { QueryParams } from "./query.js";

// Table scan utilities (schema-agnostic; migration source reader)
export { countTable, scanTable } from "./scan.js";
export type { ScanTableOptions } from "./scan.js";

// Table administration (create/destroy; honors initClient config)
export { createTable, destroyTable } from "./tables.js";
export type { CreateTableOptions, CreateTableResult } from "./tables.js";

// Exchange persistence (default persister for @jaypie/llm onExchange)
export { storeExchange } from "./storeExchange.js";
export type {
  StoreExchangeEnvelope,
  StoreExchangeOptions,
} from "./storeExchange.js";

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
  ParentReference,
  QueryResult,
  StorableEntity,
} from "./types.js";

export type { ExportResult, SeedOptions, SeedResult } from "./seedExport.js";
