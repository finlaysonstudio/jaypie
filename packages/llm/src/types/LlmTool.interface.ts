import { JsonObject } from "@jaypie/types";

export interface LlmTool {
  description: string;
  name: string;
  parameters: JsonObject;
  type: "function";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (...args: any[]) => Promise<any> | any;
}
