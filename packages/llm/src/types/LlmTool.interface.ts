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
  /**
   * Declares the tool free of side effects, mirroring MCP's `readOnlyHint`.
   * Consumed by `Toolkit.filter({ readOnly: true })` to derive a toolkit safe
   * for verification and critique passes. Tools are side-effecting unless
   * annotated, so new tools stay excluded by default.
   */
  readOnly?: boolean;
}
