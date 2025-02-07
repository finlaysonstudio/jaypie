// JSON Types, building blocks for JSON:API

export type JsonValue =
  | { [key: string]: JsonValue }
  | boolean
  | JsonValue[]
  | null
  | number
  | string;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = Array<JsonObject>;
export type JsonReturn = JsonObject | JsonArray;

// "Natural Schema" - a schema syntax that is self-describing

type EmptyArray = never[];
type EmptyObject = Record<string, never>;

export type NaturalSchema =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | ObjectConstructor
  | ArrayConstructor
  | string[]
  | EmptyArray
  | EmptyObject
  | { [key: string]: NaturalSchema }
  | NaturalSchema[];
