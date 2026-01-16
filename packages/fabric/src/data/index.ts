// Main function
export { FabricData, isFabricDataResult } from "./FabricData.js";

// Transform utilities
export {
  APEX,
  calculateScopeFromConfig,
  capitalize,
  decodeCursor,
  encodeCursor,
  extractId,
  extractScopeContext,
  pluralize,
  transformArchive,
  transformCreate,
  transformDelete,
  transformExecute,
  transformList,
  transformRead,
  transformUpdate,
} from "./transforms.js";

// Service factories (for advanced customization)
export {
  createArchiveService,
  createCreateService,
  createDeleteService,
  createExecuteService,
  createListService,
  createReadService,
  createUpdateService,
} from "./services/index.js";

// Types
export type {
  FabricDataConfig,
  FabricDataContext,
  FabricDataExecuteConfig,
  FabricDataListOptions,
  FabricDataListResponse,
  FabricDataOperationConfig,
  FabricDataOperationOption,
  FabricDataOperations,
  FabricDataResult,
  FabricModelConfig,
  ResolvedModelConfig,
  ResolvedOperationConfig,
  ScopeContext,
  ScopeFunction,
} from "./types.js";

// Constants
export { DEFAULT_LIMIT, MAX_LIMIT } from "./types.js";
