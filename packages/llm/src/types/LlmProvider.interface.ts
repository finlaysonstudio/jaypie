import { JsonObject, NaturalSchema } from "@jaypie/types";
import { z } from "zod";
import { LlmTool } from "./LlmTool.interface.js";

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
  data?: Record<string, string>;
  format?: JsonObject | NaturalSchema | z.ZodType;
  instructions?: string;
  model?: string;
  placeholders?: {
    input?: boolean;
    instructions?: boolean;
  };
  tools?: LlmTool[];
  turns?: boolean | number;
  user?: string;
}

export interface LlmOptions {
  apiKey?: string;
  model?: string;
}

export interface LlmProvider {
  operate?(input: string, options?: LlmOperateOptions): Promise<unknown>;
  send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject>;
}
