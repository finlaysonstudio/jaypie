import { JsonObject } from "./jaypie.d.js";

export interface LlmMessageOptions {
  data?: Record<string, string>;
  model?: string;
  response?: unknown;
  system?: string;
}

export interface LlmProvider {
  send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject>;
}
