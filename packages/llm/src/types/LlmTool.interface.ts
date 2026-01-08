import { AnyValue, JsonObject } from "@jaypie/types";
import { z } from "zod/v4";

// Main
export interface LlmTool {
  description: string;
  name: string;
  parameters: JsonObject | z.ZodType;
  type: "function" | string;
  call: (args?: JsonObject) => Promise<AnyValue> | AnyValue;
  message?:
    | string
    | ((
        args?: JsonObject,
        context?: { name: string },
      ) => Promise<string> | string);
}
