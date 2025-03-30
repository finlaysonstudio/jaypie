import { JsonObject } from "@jaypie/types";

// Input and Output

// TODO: LlmToolCall
// TODO: LlmToolResult

// Main
export interface LlmTool {
  description: string;
  name: string;
  parameters: JsonObject;
  type: "function" | string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call: (...args: any[]) => Promise<any> | any;
}
