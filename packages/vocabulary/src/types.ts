// Type definitions for @jaypie/vocabulary

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
// Coerces to String and validates against the array
export type ValidatedStringType = Array<string | RegExp>;

// Validated number type: [1, 2, 3]
// An array of number literals
// Coerces to Number and validates against the array
export type ValidatedNumberType = Array<number>;

// RegExp type shorthand: /regex/
// Coerces to String and validates against the pattern
export type RegExpType = RegExp;

// All supported types (including validated shorthands)
export type CoercionType =
  | CompositeType
  | RegExpType
  | ScalarType
  | TypedArrayType
  | ValidatedNumberType
  | ValidatedStringType;

// Input field definition
export interface InputFieldDefinition {
  default?: unknown;
  description?: string;
  required?: boolean;
  type: CoercionType;
  validate?: ValidateFunction | RegExp | Array<unknown>;
}

// Validation function signature (can be sync or async)
export type ValidateFunction = (
  value: unknown,
) => boolean | void | Promise<boolean | void>;

// Service function signature (can be sync or async)
export type ServiceFunction<TInput, TOutput> = (
  input: TInput,
) => TOutput | Promise<TOutput>;

// Service handler configuration
// When service is omitted, the handler returns the processed input (TInput)
export interface ServiceHandlerConfig<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> {
  alias?: string;
  description?: string;
  input?: Record<string, InputFieldDefinition>;
  service?: ServiceFunction<TInput, TOutput>;
}

// The handler function returned by serviceHandler (always async)
export type ServiceHandlerFunction<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> = (input?: Partial<TInput> | string) => Promise<TOutput>;
