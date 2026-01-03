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

// Commander adapter (re-exported for convenience)
export * as commander from "./commander/index.js";

// Lambda adapter (re-exported for convenience)
export * as lambda from "./lambda/index.js";

// LLM adapter (re-exported for convenience)
export * as llm from "./llm/index.js";

// MCP adapter (re-exported for convenience)
export * as mcp from "./mcp/index.js";

// Service Handler
export { serviceHandler } from "./serviceHandler.js";

// Types
export type {
  ArrayElementType,
  CoercionType,
  CompositeType,
  InputFieldDefinition,
  RegExpType,
  ScalarType,
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
