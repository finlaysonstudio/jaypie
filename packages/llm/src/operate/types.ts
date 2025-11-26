import { JsonObject } from "@jaypie/types";

import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageType,
  LlmOperateOptions,
  LlmResponseStatus,
  LlmUsageItem,
} from "../types/LlmProvider.interface.js";
import { Toolkit } from "../tools/Toolkit.class.js";

//
//
// Provider-Agnostic Types
//

/**
 * Standardized tool call representation across providers
 */
export interface StandardToolCall {
  /** Unique identifier for this tool call */
  callId: string;
  /** Name of the tool being called */
  name: string;
  /** JSON string of arguments */
  arguments: string;
  /** Original provider-specific tool call object */
  raw: unknown;
}

/**
 * Standardized tool result to send back to the provider
 */
export interface StandardToolResult {
  /** The call ID this result corresponds to */
  callId: string;
  /** JSON string of the result */
  output: string;
  /** Whether the tool call was successful */
  success: boolean;
  /** Error message if the tool call failed */
  error?: string;
}

/**
 * Parsed response from a provider API call
 */
export interface ParsedResponse {
  /** The text content of the response, if any */
  content?: string | JsonObject;
  /** Whether the response contains tool calls */
  hasToolCalls: boolean;
  /** The stop reason from the provider */
  stopReason?: string;
  /** Usage information for this response */
  usage?: LlmUsageItem;
  /** Raw provider response for storage */
  raw: unknown;
}

/**
 * Context passed to the operate loop for each turn
 */
export interface OperateContext {
  /** The original input */
  input: string | LlmHistory | LlmInputMessage;
  /** The operate options */
  options: LlmOperateOptions;
  /** Current conversation history */
  history: LlmHistory;
  /** The toolkit for tool calls */
  toolkit?: Toolkit;
  /** Current turn number (1-indexed) */
  currentTurn: number;
  /** Maximum allowed turns */
  maxTurns: number;
}

//
//
// Provider Request/Response Types
//

/**
 * Provider-agnostic request options
 * Each adapter will convert this to provider-specific format
 */
export interface OperateRequest {
  /** The model to use */
  model: string;
  /** The conversation history/messages */
  messages: LlmHistory;
  /** System instructions (if separate from messages) */
  system?: string;
  /** Additional instructions to append */
  instructions?: string;
  /** Tools available for the model */
  tools?: ProviderToolDefinition[];
  /** Structured output format */
  format?: JsonObject;
  /** Provider-specific options */
  providerOptions?: JsonObject;
  /** User identifier for tracking */
  user?: string;
}

/**
 * Tool definition in provider-agnostic format
 */
export interface ProviderToolDefinition {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** JSON Schema for parameters */
  parameters: JsonObject;
}

//
//
// Error Classification Types
//

/**
 * Categories of errors for retry logic
 */
export enum ErrorCategory {
  /** Error is transient and can be retried */
  Retryable = "retryable",
  /** Error is due to rate limiting */
  RateLimit = "rate_limit",
  /** Error cannot be recovered from */
  Unrecoverable = "unrecoverable",
  /** Error type is unknown */
  Unknown = "unknown",
}

/**
 * Classified error with metadata
 */
export interface ClassifiedError {
  /** The original error */
  error: unknown;
  /** Category of the error */
  category: ErrorCategory;
  /** Whether a retry should be attempted */
  shouldRetry: boolean;
  /** Suggested delay before retry (if applicable) */
  suggestedDelayMs?: number;
}

//
//
// Operate Loop State
//

/**
 * Internal state of the operate loop
 */
export interface OperateLoopState {
  /** Current status of the operation */
  status: LlmResponseStatus;
  /** Accumulated history */
  history: LlmHistory;
  /** All raw provider responses */
  responses: unknown[];
  /** Output items (tool calls, messages, etc.) */
  output: unknown[];
  /** Usage tracking for each API call */
  usage: LlmUsageItem[];
  /** Final content (set when complete) */
  content?: string | JsonObject;
  /** Error information (if any) */
  error?: {
    detail?: string;
    status: number | string;
    title: string;
  };
}

//
//
// Message Type Constants
//

/**
 * Re-export message type for convenience in adapters
 */
export { LlmMessageType };
