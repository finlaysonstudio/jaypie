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

// All supported types
export type CoercionType = CompositeType | ScalarType | TypedArrayType;

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
export interface ServiceHandlerConfig<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> {
  alias?: string;
  description?: string;
  input?: Record<string, InputFieldDefinition>;
  service: ServiceFunction<TInput, TOutput>;
}

// The handler function returned by serviceHandler (always async)
export type ServiceHandlerFunction<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> = (input?: Partial<TInput> | string) => Promise<TOutput>;
