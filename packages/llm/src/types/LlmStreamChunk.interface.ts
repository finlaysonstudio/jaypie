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
  ToolPending = "tool_pending",
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
    /** Provider-specific metadata preserved through tool-call roundtrip */
    metadata?: Record<string, unknown>;
  };
}

/**
 * The model called an external tool; the stream parks after yielding this
 * chunk (and its final `done` chunk). Correlate the result on `xid` and
 * resume via the `resume` option.
 */
export interface LlmStreamChunkToolPending {
  type: LlmStreamChunkType.ToolPending;
  toolPending: {
    arguments: string;
    /** Resolved `LlmTool.message`, when the tool defines one */
    message?: string;
    name: string;
    /** Provider tool-call id — the external identifier results are correlated on */
    xid: string;
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
  | LlmStreamChunkToolPending
  | LlmStreamChunkToolResult;
