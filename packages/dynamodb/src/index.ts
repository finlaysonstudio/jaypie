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
  INDEX_ALIAS,
  INDEX_CLASS,
  INDEX_OU,
  INDEX_TYPE,
  INDEX_XID,
  SEPARATOR,
} from "./constants.js";

// Key builders and entity utilities
export {
  buildIndexAlias,
  buildIndexClass,
  buildIndexOu,
  buildIndexType,
  buildIndexXid,
  calculateOu,
  populateIndexKeys,
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
  DynamoClientConfig,
  FabricEntity,
  ParentReference,
  QueryOptions,
  QueryResult,
} from "./types.js";
