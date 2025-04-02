import { AnyValue, JsonObject, NaturalMap, NaturalSchema } from "@jaypie/types";
import { z } from "zod";
import { LlmTool } from "./LlmTool.interface.js";

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
  code: string;
  message: string;
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

export interface LlmInputMessage {
  content: string | Array<LlmInputContent>;
  role: LlmMessageRole;
  type: LlmMessageType.Message;
}

// Output

interface LlmOutputContentText {
  annotations?: AnyValue[];
  text: string;
  type: LlmMessageType.OutputText;
}

interface LlmOutputRefusal {
  refusal: string;
  type: LlmMessageType.Refusal;
}

type LlmOutputContent = LlmOutputContentText | LlmOutputRefusal;

interface LlmOutputMessage {
  content: Array<LlmOutputContent>;
  id: string;
  role: LlmMessageRole.Assistant;
  type: LlmMessageType.Message;
  status: LlmResponseStatus;
}

type LlmOutputItem = LlmToolCall | LlmOutputMessage;

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
  instructions?: string;
  model?: string;
  placeholders?: {
    input?: boolean;
    instructions?: boolean;
  };
  providerOptions?: Record<string, AnyValue>;
  tools?: LlmTool[];
  turns?: boolean | number;
  user?: string;
}

export interface LlmOptions {
  apiKey?: string;
  model?: string;
}

// Responses

interface LlmUsage {
  input: number;
  output: number;
  reasoning?: number;
  total: number;
}

export interface LlmOperateResponse {
  error?: LlmError;
  history: LlmHistory;
  message?: string;
  output: LlmOutput;
  response: JsonObject[] | null;
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
