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
 * Context passed to hooks and utilities during the operate loop
 */
export interface OperateContext {
  /** The hooks configuration */
  hooks: LlmOperateOptions["hooks"];
  /** The operate options */
  options: LlmOperateOptions;
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

// Import ResponseBuilder for type declaration
import type { ResponseBuilder } from "./response/ResponseBuilder.js";

/**
 * Internal state of the operate loop
 */
export interface OperateLoopState {
  /** Current conversation input/messages */
  currentInput: LlmHistory;
  /** Current turn number (0-indexed, incremented at start of each turn) */
  currentTurn: number;
  /** Formatted output schema for structured output */
  formattedFormat?: JsonObject;
  /** Formatted tools for the provider */
  formattedTools?: ProviderToolDefinition[];
  /** Maximum allowed turns */
  maxTurns: number;
  /** Response builder instance */
  responseBuilder: ResponseBuilder;
  /** The toolkit for tool calls */
  toolkit?: Toolkit;
}

//
//
// Message Type Constants
//

/**
 * Re-export message type for convenience in adapters
 */
export { LlmMessageType };
