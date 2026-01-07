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

// Commander adapter (re-exported for convenience)
export * as commander from "./commander/index.js";

// Lambda adapter (re-exported for convenience)
export * as lambda from "./lambda/index.js";

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
export const VOCABULARY_VERSION = "0.1.6";
