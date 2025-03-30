import { JsonObject, NaturalSchema } from "@jaypie/types";
import { z } from "zod";
import { LlmTool } from "./LlmTool.interface.js";

// Input

// TODO: LlmInputContentFile
// TODO: LlmInputContentImage
// TODO: LlmInputContentText
// TODO: LlmInputMessage: content: string | Array, role, type

// Output

// TODO: LlmOutputContentText
// TODO: LlmOutputMessage
// TODO: LlmOutputRefusal

// Options

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
  explain?: boolean;
  format?: JsonObject | NaturalSchema | z.ZodType;
  history?: JsonObject[];
  instructions?: string;
  model?: string;
  placeholders?: {
    input?: boolean;
    instructions?: boolean;
  };
  providerOptions?: Record<string, unknown>;
  tools?: LlmTool[];
  turns?: boolean | number;
  user?: string;
}

export interface LlmOptions {
  apiKey?: string;
  model?: string;
}

// Main
export interface LlmProvider {
  operate?(
    input: string | JsonObject | JsonObject[],
    options?: LlmOperateOptions,
  ): Promise<JsonObject[]>;
  send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject>;
}
