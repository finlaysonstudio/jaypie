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

// Date Coercion
export {
  coerceFromDate,
  coerceToDate,
  DateType,
  isDateType,
  isValidDate,
} from "./coerce-date.js";

// Status Type
export { isStatus, STATUS_VALUES, StatusType } from "./status.js";
export type { Status } from "./status.js";

// LLM adapter (re-exported for convenience - no optional deps)
export * as llm from "./llm/index.js";

// Note: Other adapters have optional dependencies and must be imported directly:
//   import { registerServiceCommand } from "@jaypie/vocabulary/commander";
//   import { lambdaServiceHandler } from "@jaypie/vocabulary/lambda";
//   import { registerMcpTool } from "@jaypie/vocabulary/mcp";

// Service Handler
export { serviceHandler } from "./serviceHandler.js";

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
export const VOCABULARY_VERSION = "0.1.8";
