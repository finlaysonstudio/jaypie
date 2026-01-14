// Type definitions for @jaypie/fabric

// Message Types - Standard vocabulary for messaging

/**
 * Log levels for messages
 * @default "info"
 */
export type MessageLevel = "debug" | "error" | "info" | "trace" | "warn";

/**
 * Standard message structure for callbacks and notifications
 */
export interface Message {
  content: string;
  level?: MessageLevel;
}

// Supported scalar types
export type ScalarType =
  | typeof Boolean
  | typeof Number
  | typeof String
  | "boolean"
  | "number"
  | "string";

// Supported composite types
export type CompositeType = typeof Array | typeof Object | "array" | "object";

// Element types that can be used inside typed arrays
export type ArrayElementType =
  | typeof Boolean
  | typeof Number
  | typeof Object
  | typeof String
  | "boolean"
  | "number"
  | "object"
  | "string"
  | "" // shorthand for String
  | Record<string, never>; // {} shorthand for Object

// Typed array types: [String], [Number], [Boolean], [Object], [""], [{}], []
export type TypedArrayType =
  | [] // untyped array
  | [typeof Boolean]
  | [typeof Number]
  | [typeof Object]
  | [typeof String]
  | ["boolean"]
  | ["number"]
  | ["object"]
  | ["string"]
  | [""] // shorthand for [String]
  | [Record<string, never>]; // [{}] shorthand for [Object]

// Validated string type: ["value1", "value2"] or [/regex/, "value"]
// An array of string literals and/or RegExp patterns
// Converts to String and validates against the array
export type ValidatedStringType = Array<string | RegExp>;

// Validated number type: [1, 2, 3]
// An array of number literals
// Converts to Number and validates against the array
export type ValidatedNumberType = Array<number>;

// RegExp type shorthand: /regex/
// Converts to String and validates against the pattern
export type RegExpType = RegExp;

// Date type
export type DateConversionType = typeof Date;

// All supported types (including validated shorthands)
export type ConversionType =
  | CompositeType
  | DateConversionType
  | RegExpType
  | ScalarType
  | TypedArrayType
  | ValidatedNumberType
  | ValidatedStringType;

// Input field definition
export interface InputFieldDefinition {
  default?: unknown;
  description?: string;
  /** Override the long flag name for Commander.js (e.g., "user" for --user) */
  flag?: string;
  /** Short switch letter for Commander.js (e.g., "u" for -u) */
  letter?: string;
  required?: boolean;
  type: ConversionType;
  validate?: ValidateFunction | RegExp | Array<unknown>;
}

// Validation function signature (can be sync or async)
export type ValidateFunction = (
  value: unknown,
) => boolean | void | Promise<boolean | void>;

/**
 * Context passed to service functions for callbacks and utilities
 */
export interface ServiceContext {
  /** Report a recoverable error during service execution (does not throw) */
  onError?: (error: unknown) => void | Promise<void>;
  /** Report a fatal error during service execution (does not throw) */
  onFatal?: (error: unknown) => void | Promise<void>;
  /** Send a message during service execution (connects to onMessage callback) */
  sendMessage?: (message: Message) => void | Promise<void>;
}

// Service function signature (can be sync or async)
export type ServiceFunction<TInput, TOutput> = (
  input: TInput,
  context?: ServiceContext,
) => TOutput | Promise<TOutput>;

// Service configuration
// When service is omitted, the handler returns the processed input (TInput)
export interface ServiceConfig<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> {
  alias?: string;
  description?: string;
  input?: Record<string, InputFieldDefinition>;
  service?: ServiceFunction<TInput, TOutput>;
}

// The service function returned by createService (always async)
// Config properties are attached directly to the handler for flat access
export interface Service<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> extends ServiceConfig<TInput, TOutput> {
  (
    input?: Partial<TInput> | string,
    context?: ServiceContext,
  ): Promise<TOutput>;
}
