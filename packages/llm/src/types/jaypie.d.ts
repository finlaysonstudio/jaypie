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
