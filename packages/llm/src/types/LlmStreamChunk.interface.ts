import { LlmUsage } from "./LlmProvider.interface.js";

//
//
// Types
//

export enum LlmStreamChunkType {
  Done = "done",
  Error = "error",
  Text = "text",
  ToolCall = "tool_call",
  ToolResult = "tool_result",
}

export interface LlmStreamChunkText {
  type: LlmStreamChunkType.Text;
  content: string;
}

export interface LlmStreamChunkToolCall {
  type: LlmStreamChunkType.ToolCall;
  toolCall: {
    id: string;
    name: string;
    arguments: string;
  };
}

export interface LlmStreamChunkToolResult {
  type: LlmStreamChunkType.ToolResult;
  toolResult: {
    id: string;
    name: string;
    result: unknown;
  };
}

export interface LlmStreamChunkDone {
  type: LlmStreamChunkType.Done;
  usage: LlmUsage;
}

export interface LlmStreamChunkError {
  type: LlmStreamChunkType.Error;
  error: {
    detail?: string;
    status: number | string;
    title: string;
  };
}

export type LlmStreamChunk =
  | LlmStreamChunkDone
  | LlmStreamChunkError
  | LlmStreamChunkText
  | LlmStreamChunkToolCall
  | LlmStreamChunkToolResult;
