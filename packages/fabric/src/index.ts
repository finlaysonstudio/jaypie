// @jaypie/fabric

// BaseModel (formerly BaseEntity)
export {
  BASE_MODEL_AUTO_FIELDS,
  BASE_MODEL_FIELDS,
  BASE_MODEL_REQUIRED_FIELDS,
  BASE_MODEL_TIMESTAMP_FIELDS,
  createBaseModelInput,
  hasBaseModelShape,
  isAutoField,
  isBaseModel,
  isTimestampField,
  pickBaseModelFields,
} from "./models/base.js";
export type {
  BaseModel,
  BaseModelFilter,
  BaseModelInput,
  BaseModelUpdate,
  HistoryEntry,
  JobModel,
  MessageModel,
  Progress,
} from "./models/base.js";

// Commander adapter (re-exported for convenience)
export * as commander from "./commander/index.js";

// Constants
export { APEX, SEPARATOR, SYSTEM_MODELS } from "./constants.js";
export type { SystemModel } from "./constants.js";

// Conversion (formerly Coercion)
export {
  convert,
  convertFromArray,
  convertFromObject,
  convertToArray,
  convertToBoolean,
  convertToNumber,
  convertToObject,
  convertToString,
} from "./convert.js";

// Date Conversion
export {
  convertFromDate,
  convertToDate,
  DateType,
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

// LLM adapter (re-exported for convenience - no optional deps)
export * as llm from "./llm/index.js";

// Note: Other adapters have optional dependencies and must be imported directly:
//   import { registerServiceCommand } from "@jaypie/fabric/commander";
//   import { createLambdaService } from "@jaypie/fabric/lambda";
//   import { registerMcpTool } from "@jaypie/fabric/mcp";

// Meta-modeling types
export {
  BOOLEAN_TYPE,
  DATE_TYPE,
  DATETIME_TYPE,
  DOLLARS_TYPE,
  ELEMENTARY_TYPE_REGISTRY,
  ELEMENTARY_TYPES,
  FIELD_CATEGORIES,
  getAllElementaryTypes,
  getElementaryType,
  isElementaryType,
  isFieldCategory,
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
  FieldCategory,
  FieldDefinition,
  FieldRef,
  ValidationRule,
} from "./types/index.js";

// Service (formerly ServiceHandler)
export { createService } from "./service.js";

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
