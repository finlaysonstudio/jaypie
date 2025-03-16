import { JsonArray, JsonObject, NaturalSchema } from "@jaypie/types";
import { z } from "zod";

export interface LlmMessageOptions {
  data?: Record<string, string>;
  model?: string;
  placeholders?: {
    message?: boolean;
    system?: boolean;
  };
  response?: NaturalSchema | z.ZodType;
  system?: string;
}

export interface LlmOperateOptions {
  instructions?: string;
  model?: string;
  turns?: boolean | number;
  user?: string;
}

export interface LlmOptions {
  apiKey?: string;
  model?: string;
}

export interface LlmProvider {
  operate?(input: string, options?: LlmOperateOptions): Promise<JsonArray>;
  send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject>;
}
