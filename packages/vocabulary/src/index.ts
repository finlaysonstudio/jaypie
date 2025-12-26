// @jaypie/vocabulary

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

// Service Handler
export { serviceHandler } from "./serviceHandler.js";

// Types
export type {
  CoercionType,
  CompositeType,
  InputFieldDefinition,
  ScalarType,
  ServiceFunction,
  ServiceHandlerConfig,
  ServiceHandlerFunction,
  ValidateFunction,
} from "./types.js";

// Version
export const VOCABULARY_VERSION = "0.0.1";
