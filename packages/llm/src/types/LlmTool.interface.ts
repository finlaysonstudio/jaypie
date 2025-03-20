import { JsonObject, JsonValue } from "@jaypie/types";

export interface LlmTool {
  description: string;
  name: string;
  parameters: JsonObject;
  type: "function";
  execute: (...args: JsonValue[]) => Promise<JsonValue> | JsonValue;
}
