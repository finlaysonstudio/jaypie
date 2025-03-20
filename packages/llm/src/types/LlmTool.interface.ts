import { JsonObject } from "@jaypie/types";

export interface LlmTool {
  description: string;
  name: string;
  parameters: JsonObject;
  type: "function";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call: (...args: any[]) => Promise<any> | any;
}
