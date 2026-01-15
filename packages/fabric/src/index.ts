// @jaypie/fabric

// FabricModel (core model types)
export {
  createFabricModelInput,
  FABRIC_MODEL_AUTO_FIELDS,
  FABRIC_MODEL_FIELDS,
  FABRIC_MODEL_REQUIRED_FIELDS,
  FABRIC_MODEL_TIMESTAMP_FIELDS,
  hasFabricModelShape,
  isAutoField,
  isFabricModel,
  isTimestampField,
  pickFabricModelFields,
} from "./models/base.js";
export type {
  FabricHistoryEntry,
  FabricJob,
  FabricMessage,
  FabricModel,
  FabricModelFilter,
  FabricModelInput,
  FabricModelUpdate,
  FabricProgress,
} from "./models/base.js";

// Constants
export { APEX, SEPARATOR, SYSTEM_MODELS } from "./constants.js";
export type { SystemModel } from "./constants.js";

// Fabric functions (type conversion)
export {
  convertFromArray,
  convertFromObject,
  fabric,
  fabricArray,
  fabricBoolean,
  fabricNumber,
  fabricObject,
  fabricString,
} from "./convert.js";

// Date fabrication
export {
  convertFromDate,
  DateType,
  fabricDate,
  isDateType,
  isValidDate,
} from "./convert-date.js";

// Helpers
export { computeResolvedName, resolveWithFallback } from "./helpers/index.js";
export type { ResolvedNameModel } from "./helpers/index.js";

// Index (DynamoDB index definitions and key builders)
export {
  ARCHIVED_SUFFIX,
  buildCompositeKey,
  calculateIndexSuffix,
  calculateOu,
  clearRegistry,
  DEFAULT_INDEXES,
  DEFAULT_SORT_KEY,
  DELETED_SUFFIX,
  generateIndexName,
  getAllRegisteredIndexes,
  getModelIndexes,
  getModelSchema,
  getRegisteredModels,
  isModelRegistered,
  populateIndexKeys,
  registerModel,
  tryBuildCompositeKey,
} from "./index/index.js";
export type {
  IndexableModel,
  IndexDefinition,
  IndexField,
  ModelSchema,
} from "./index/index.js";

// Note: Adapters must be imported from their sub-paths:
//   import { fabricCommand } from "@jaypie/fabric/commander";
//   import { fabricLambda } from "@jaypie/fabric/lambda";
//   import { fabricTool } from "@jaypie/fabric/llm";
//   import { fabricMcp } from "@jaypie/fabric/mcp";

// Meta-modeling types
export {
  BOOLEAN_TYPE,
  DATE_TYPE,
  DATETIME_TYPE,
  DOLLARS_TYPE,
  ELEMENTARY_TYPE_REGISTRY,
  ELEMENTARY_TYPES,
  getAllElementaryTypes,
  getElementaryType,
  isElementaryType,
  isFieldDefinition,
  MULTISELECT_TYPE,
  NUMBER_TYPE,
  REFERENCE_TYPE,
  SELECT_TYPE,
  TEXT_TYPE,
  TEXTAREA_TYPE,
} from "./types/index.js";
export type {
  ElementaryType,
  ElementaryTypeDefinition,
  FieldDefinition,
  FieldRef,
  ValidationRule,
} from "./types/index.js";

// Service
export { fabricService } from "./service.js";
export { resolveService } from "./resolveService.js";
export type { ResolveServiceConfig } from "./resolveService.js";

// Status Type
export { isStatus, STATUS_VALUES, StatusType } from "./status.js";
export type { Status } from "./status.js";

// Types
export type {
  ArrayElementType,
  CompositeType,
  ConversionType,
  DateConversionType,
  InputFieldDefinition,
  Message,
  MessageLevel,
  RegExpType,
  ScalarType,
  Service,
  ServiceConfig,
  ServiceContext,
  ServiceFunction,
  TypedArrayType,
  ValidatedNumberType,
  ValidatedStringType,
  ValidateFunction,
} from "./types.js";

// Version
export const FABRIC_VERSION = "0.0.1";
