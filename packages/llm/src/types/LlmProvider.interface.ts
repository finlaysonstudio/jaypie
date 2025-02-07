import { JsonObject, NaturalSchema } from "./jaypie.d.js";
import { z } from "zod";

export interface LlmMessageOptions {
  data?: Record<string, string>;
  model?: string;
  response?: NaturalSchema | z.ZodType;
  system?: string;
}

export interface LlmProvider {
  send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject>;
}
