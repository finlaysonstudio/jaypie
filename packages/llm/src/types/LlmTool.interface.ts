import { AnyValue, JsonObject } from "@jaypie/types";
import { z } from "zod/v4";

// Main
interface LlmToolBase {
  description: string;
  name: string;
  parameters: JsonObject | z.ZodType;
  type: "function" | string;
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

/**
 * A tool the toolkit executes in-process. `call` runs where the loop runs.
 */
export interface LlmCallableTool extends LlmToolBase {
  call: (args?: JsonObject) => Promise<AnyValue> | AnyValue;
  external?: false;
}

/**
 * A tool whose execution is owned by the caller (a browser, a device, a
 * queue worker, a human). The definition travels to the provider; when the
 * model calls it, the loop parks: the call returns with
 * `status: "in_progress"` and a resumable exchange envelope instead of
 * executing anything. Resume with the `resume` option on `operate()`.
 */
export interface LlmExternalTool extends LlmToolBase {
  call?: never;
  external: true;
}

export type LlmTool = LlmCallableTool | LlmExternalTool;
