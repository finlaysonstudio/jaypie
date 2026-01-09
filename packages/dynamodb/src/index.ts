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
  buildIndexAlias,
  buildIndexClass,
  buildIndexOu,
  buildIndexType,
  buildIndexXid,
  calculateOu,
  indexEntity,
} from "./keyBuilders.js";

// Query utilities
export {
  queryByAlias,
  queryByClass,
  queryByOu,
  queryByType,
  queryByXid,
} from "./queries.js";

// Types
export type {
  BaseQueryOptions,
  DynamoClientConfig,
  FabricEntity,
  ParentReference,
  QueryResult,
} from "./types.js";
