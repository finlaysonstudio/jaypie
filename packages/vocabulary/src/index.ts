// @jaypie/vocabulary

// BaseEntity
export {
  BASE_ENTITY_AUTO_FIELDS,
  BASE_ENTITY_FIELDS,
  BASE_ENTITY_REQUIRED_FIELDS,
  BASE_ENTITY_TIMESTAMP_FIELDS,
  createBaseEntityInput,
  hasBaseEntityShape,
  isAutoField,
  isBaseEntity,
  isTimestampField,
  pickBaseEntityFields,
} from "./base-entity.js";
export type {
  BaseEntity,
  BaseEntityFilter,
  BaseEntityInput,
  BaseEntityUpdate,
  HistoryEntry,
  Job,
  MessageEntity,
  Progress,
} from "./base-entity.js";

// Coercion
export {
  coerce,
  coerceFromArray,
  coerceFromObject,
  coerceToArray,
  coerceToBoolean,
  coerceToNumber,
  coerceToObject,
  coerceToString,
} from "./coerce.js";

// Commander adapter (re-exported for convenience)
export * as commander from "./commander/index.js";

// Date Coercion
export {
  coerceFromDate,
  coerceToDate,
  DateType,
  isDateType,
  isValidDate,
} from "./coerce-date.js";

// Constants
export { APEX, SEPARATOR, SYSTEM_MODELS } from "./constants.js";
export type { SystemModel } from "./constants.js";

// Helpers
export { computeResolvedName, resolveWithFallback } from "./helpers/index.js";
export type { ResolvedNameEntity } from "./helpers/index.js";

// Lambda adapter (re-exported for convenience)
export * as lambda from "./lambda/index.js";

// LLM adapter (re-exported for convenience)
export * as llm from "./llm/index.js";

// MCP adapter (re-exported for convenience)
export * as mcp from "./mcp/index.js";

// Service Handler
export { serviceHandler } from "./serviceHandler.js";

// Status Type
export { isStatus, STATUS_VALUES, StatusType } from "./status.js";
export type { Status } from "./status.js";

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

// Types
export type {
  ArrayElementType,
  CoercionType,
  CompositeType,
  DateCoercionType,
  InputFieldDefinition,
  Message,
  MessageLevel,
  RegExpType,
  ScalarType,
  ServiceContext,
  ServiceFunction,
  ServiceHandlerConfig,
  ServiceHandlerFunction,
  TypedArrayType,
  ValidatedNumberType,
  ValidatedStringType,
  ValidateFunction,
} from "./types.js";

// Version
export const VOCABULARY_VERSION = "0.1.7";
