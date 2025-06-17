import { AnyValue, JsonObject } from "@jaypie/types";

// Main
export interface LlmTool {
  description: string;
  name: string;
  parameters: JsonObject;
  type: "function" | string;
  call: (args?: JsonObject) => Promise<AnyValue> | AnyValue;
  message?:
    | string
    | ((
        args?: JsonObject,
        context?: { name: string },
      ) => Promise<string> | string);
}
