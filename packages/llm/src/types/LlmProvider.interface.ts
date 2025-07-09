import {
  AnyValue,
  JsonObject,
  JsonReturn,
  NaturalMap,
  NaturalSchema,
} from "@jaypie/types";
import { z } from "zod/v4";
import { LlmTool } from "./LlmTool.interface.js";
import { Toolkit } from "../tools/Toolkit.class.js";

// Enums

export enum LlmMessageRole {
  Assistant = "assistant",
  Developer = "developer",
  System = "system",
  User = "user",
}

export enum LlmMessageType {
  FunctionCall = "function_call",
  FunctionCallOutput = "function_call_output",
  InputFile = "input_file",
  InputImage = "input_image",
  InputText = "input_text",
  ItemReference = "item_reference",
  Message = "message",
  OutputText = "output_text",
  Refusal = "refusal",
}

export enum LlmResponseStatus {
  Completed = "completed",
  Incomplete = "incomplete",
  InProgress = "in_progress",
}

// Errors

interface LlmError {
  detail?: string;
  status: number | string;
  title: string;
}

// Input

interface LlmInputContentFile {
  type: LlmMessageType.InputFile;
  file_data: File;
  file_id?: string;
  filename?: string;
}

interface LlmInputContentImage {
  type: LlmMessageType.InputImage;
  detail: File;
  file_id?: string;
  image_url?: string;
}

interface LlmInputContentText {
  type: LlmMessageType.InputText;
  text: string;
}

type LlmInputContent =
  | LlmInputContentFile
  | LlmInputContentImage
  | LlmInputContentText;

/**
 * Represents the "Input message object" in the "input item list"
 * from [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses/create)
 */
export interface LlmInputMessage {
  content: string | Array<LlmInputContent>;
  role: LlmMessageRole;
  type: LlmMessageType.Message;
}

// Output
export interface LlmOutputContentText {
  annotations?: AnyValue[];
  text: string;
  type: LlmMessageType.OutputText;
}

interface LlmOutputRefusal {
  refusal: string;
  type: LlmMessageType.Refusal;
}

type LlmOutputContent = LlmOutputContentText | LlmOutputRefusal;

/**
 * Represents the "Output message object" in the "input item list"
 * from [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses/create)
 */
export interface LlmOutputMessage {
  content: string | Array<LlmOutputContent>;
  id?: string;
  role: LlmMessageRole.Assistant;
  status?: LlmResponseStatus;
  type?: LlmMessageType.Message;
}

type LlmOutputItem = LlmToolCall | LlmToolResult | LlmOutputMessage;

type LlmOutput = LlmOutputItem[];

// Tools

export interface LlmToolCall {
  arguments: string;
  call_id: string;
  id: string;
  name: string;
  type: LlmMessageType.FunctionCall;
  status: LlmResponseStatus;
}
export interface LlmToolResult {
  call_id: string;
  output: string;
  status?: LlmResponseStatus;
  type: LlmMessageType.FunctionCallOutput;
}

interface LlmItemReference {
  type: LlmMessageType.ItemReference;
  id: string;
}

// Options

export type LlmHistoryItem =
  | LlmInputMessage
  | LlmItemReference
  | LlmOutputItem
  | LlmToolResult;

export type LlmHistory = LlmHistoryItem[];

export interface LlmMessageOptions {
  data?: NaturalMap;
  model?: string;
  placeholders?: {
    message?: boolean;
    system?: boolean;
  };
  response?: NaturalSchema | z.ZodType;
  system?: string;
}

export interface LlmOperateOptions {
  data?: NaturalMap;
  explain?: boolean;
  format?: JsonObject | NaturalSchema | z.ZodType;
  history?: LlmHistory;
  hooks?: {
    afterEachModelResponse?: ({
      input,
      options,
      providerRequest,
      providerResponse,
      content,
      usage,
    }: {
      input: string | LlmHistory | LlmInputMessage;
      options?: LlmOperateOptions;
      providerRequest: any;
      providerResponse: any;
      content: string | JsonObject;
      usage: LlmUsage;
    }) => unknown | Promise<unknown>;
    afterEachTool?: ({
      result,
      toolName,
      args,
    }: {
      result: unknown;
      toolName: string;
      args: string;
    }) => unknown | Promise<unknown>;
    beforeEachModelRequest?: ({
      input,
      options,
      providerRequest,
    }: {
      input: string | LlmHistory | LlmInputMessage;
      options?: LlmOperateOptions;
      providerRequest: any;
    }) => unknown | Promise<unknown>;
    beforeEachTool?: ({
      toolName,
      args,
    }: {
      toolName: string;
      args: string;
    }) => unknown | Promise<unknown>;
    onRetryableModelError?: ({
      input,
      options,
      providerRequest,
      error,
    }: {
      input: string | LlmHistory | LlmInputMessage;
      options?: LlmOperateOptions;
      providerRequest: any;
      error: any;
    }) => unknown | Promise<unknown>;
    onToolError?: ({
      error,
      toolName,
      args,
    }: {
      error: Error;
      toolName: string;
      args: string;
    }) => unknown | Promise<unknown>;
    onUnrecoverableModelError?: ({
      input,
      options,
      providerRequest,
      error,
    }: {
      input: string | LlmHistory | LlmInputMessage;
      options?: LlmOperateOptions;
      providerRequest: any;
      error: any;
    }) => unknown | Promise<unknown>;
  };
  instructions?: string;
  model?: string;
  placeholders?: {
    input?: boolean;
    instructions?: boolean;
    system?: boolean;
  };
  providerOptions?: JsonObject;
  system?: string;
  tools?: LlmTool[] | Toolkit;
  turns?: boolean | number;
  user?: string;
}

export interface LlmOptions {
  apiKey?: string;
  model?: string;
}

// Responses

export interface LlmUsageItem {
  input: number;
  output: number;
  reasoning: number;
  total: number;
  provider?: string;
  model?: string;
}

export type LlmUsage = LlmUsageItem[];

export interface LlmOperateResponse {
  content?: string | JsonObject;
  error?: LlmError;
  history: LlmHistory;
  model?: string;
  output: LlmOutput;
  provider?: string;
  responses: JsonReturn[];
  status: LlmResponseStatus;
  usage: LlmUsage;
}

// Main

export interface LlmProvider {
  operate?(
    input: string | LlmHistory | LlmInputMessage,
    options?: LlmOperateOptions,
  ): Promise<LlmOperateResponse>;
  send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject>;
}
