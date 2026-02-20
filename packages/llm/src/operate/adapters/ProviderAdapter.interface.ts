import { JsonObject, NaturalSchema } from "@jaypie/types";
import { z } from "zod/v4";

import {
  LlmHistory,
  LlmOperateOptions,
  LlmUsageItem,
} from "../../types/LlmProvider.interface.js";
import { LlmStreamChunk } from "../../types/LlmStreamChunk.interface.js";
import { Toolkit } from "../../tools/Toolkit.class.js";
import {
  ClassifiedError,
  OperateRequest,
  ParsedResponse,
  ProviderToolDefinition,
  StandardToolCall,
  StandardToolResult,
} from "../types.js";

//
//
// Provider Adapter Interface
//

/**
 * ProviderAdapter defines the contract that each LLM provider must implement
 * to work with the shared operate loop.
 *
 * The adapter pattern allows the core operate loop to be provider-agnostic
 * while each provider handles its specific API format and quirks.
 */
export interface ProviderAdapter {
  //
  // Provider Identification
  //

  /**
   * Unique identifier for this provider (e.g., "openai", "anthropic")
   */
  readonly name: string;

  /**
   * Default model for this provider
   */
  readonly defaultModel: string;

  //
  // Request Building
  //

  /**
   * Build a provider-specific request from the standardized format
   *
   * @param request - Standardized request options
   * @returns Provider-specific request object ready for the API
   */
  buildRequest(request: OperateRequest): unknown;

  /**
   * Convert a Toolkit to provider-specific tool definitions
   *
   * @param toolkit - The toolkit containing tool definitions
   * @param outputSchema - Optional JSON schema for structured output
   * @returns Array of provider-specific tool definitions
   */
  formatTools(
    toolkit: Toolkit,
    outputSchema?: JsonObject,
  ): ProviderToolDefinition[];

  /**
   * Format a structured output schema for the provider
   *
   * @param schema - JSON schema, NaturalSchema, or Zod schema for the expected output
   * @returns Provider-specific format configuration
   */
  formatOutputSchema(
    schema: JsonObject | NaturalSchema | z.ZodType,
  ): JsonObject;

  //
  // API Execution
  //

  /**
   * Execute an API request to the provider
   *
   * @param client - The provider's SDK client instance
   * @param request - Provider-specific request object (from buildRequest)
   * @param signal - Optional AbortSignal to cancel the request on retry
   * @returns Raw provider response
   */
  executeRequest(
    client: unknown,
    request: unknown,
    signal?: AbortSignal,
  ): Promise<unknown>;

  /**
   * Execute a streaming API request to the provider
   *
   * @param client - The provider's SDK client instance
   * @param request - Provider-specific request object (from buildRequest)
   * @param signal - Optional AbortSignal to cancel the request on retry
   * @returns AsyncIterable of stream chunks
   */
  executeStreamRequest?(
    client: unknown,
    request: unknown,
    signal?: AbortSignal,
  ): AsyncIterable<LlmStreamChunk>;

  //
  // Response Parsing
  //

  /**
   * Parse a provider response into standardized format
   *
   * @param response - Raw provider response
   * @param options - Original operate options (for context)
   * @returns Parsed response with content, tool calls, usage, etc.
   */
  parseResponse(response: unknown, options?: LlmOperateOptions): ParsedResponse;

  /**
   * Extract tool calls from a provider response
   *
   * @param response - Raw provider response
   * @returns Array of standardized tool calls
   */
  extractToolCalls(response: unknown): StandardToolCall[];

  /**
   * Extract usage information from a provider response
   *
   * @param response - Raw provider response
   * @param model - The model used (for tracking)
   * @returns Usage item with token counts
   */
  extractUsage(response: unknown, model: string): LlmUsageItem;

  //
  // Tool Result Handling
  //

  /**
   * Format a tool result to append to the conversation
   *
   * @param toolCall - The original tool call
   * @param result - The standardized tool result
   * @returns Provider-specific message/item to add to history
   */
  formatToolResult(
    toolCall: StandardToolCall,
    result: StandardToolResult,
  ): unknown;

  /**
   * Append tool call and result to the request for the next turn
   *
   * @param request - Current provider request
   * @param toolCall - The tool call that was made
   * @param result - The result of the tool call
   * @returns Updated request with tool result appended
   */
  appendToolResult(
    request: unknown,
    toolCall: StandardToolCall,
    result: StandardToolResult,
  ): unknown;

  //
  // History Management
  //

  /**
   * Convert provider response items to LlmHistory format for storage
   *
   * @param response - Raw provider response
   * @returns History items to append
   */
  responseToHistoryItems(response: unknown): LlmHistory;

  //
  // Error Classification
  //

  /**
   * Classify an error for retry logic
   *
   * @param error - The error that occurred
   * @returns Classified error with retry recommendation
   */
  classifyError(error: unknown): ClassifiedError;

  /**
   * Check if an error is retryable
   *
   * @param error - The error to check
   * @returns True if the error can be retried
   */
  isRetryableError(error: unknown): boolean;

  /**
   * Check if an error is due to rate limiting
   *
   * @param error - The error to check
   * @returns True if this is a rate limit error
   */
  isRateLimitError(error: unknown): boolean;

  //
  // Provider-Specific Features
  //

  /**
   * Check if a response indicates the model wants to stop (vs tool use)
   *
   * @param response - Raw provider response
   * @returns True if the model has finished responding
   */
  isComplete(response: unknown): boolean;

  /**
   * Check if a response contains a structured output result
   *
   * @param response - Raw provider response
   * @returns True if structured output was returned
   */
  hasStructuredOutput(response: unknown): boolean;

  /**
   * Extract structured output from a response
   *
   * @param response - Raw provider response
   * @returns Parsed JSON object
   */
  extractStructuredOutput(response: unknown): JsonObject | undefined;
}

//
//
// Abstract Base Adapter
//

/**
 * BaseProviderAdapter provides default implementations for common adapter methods.
 * Providers can extend this class to reduce boilerplate.
 */
export abstract class BaseProviderAdapter implements ProviderAdapter {
  abstract readonly name: string;
  abstract readonly defaultModel: string;

  abstract buildRequest(request: OperateRequest): unknown;
  abstract formatTools(
    toolkit: Toolkit,
    outputSchema?: JsonObject,
  ): ProviderToolDefinition[];
  abstract formatOutputSchema(
    schema: JsonObject | NaturalSchema | z.ZodType,
  ): JsonObject;
  abstract executeRequest(
    client: unknown,
    request: unknown,
    signal?: AbortSignal,
  ): Promise<unknown>;
  abstract parseResponse(
    response: unknown,
    options?: LlmOperateOptions,
  ): ParsedResponse;
  abstract extractToolCalls(response: unknown): StandardToolCall[];
  abstract extractUsage(response: unknown, model: string): LlmUsageItem;
  abstract formatToolResult(
    toolCall: StandardToolCall,
    result: StandardToolResult,
  ): unknown;
  abstract appendToolResult(
    request: unknown,
    toolCall: StandardToolCall,
    result: StandardToolResult,
  ): unknown;
  abstract responseToHistoryItems(response: unknown): LlmHistory;
  abstract classifyError(error: unknown): ClassifiedError;
  abstract isComplete(response: unknown): boolean;

  /**
   * Default implementation checks if error is retryable via classifyError
   */
  isRetryableError(error: unknown): boolean {
    const classified = this.classifyError(error);
    return classified.shouldRetry;
  }

  /**
   * Default implementation checks error category via classifyError
   */
  isRateLimitError(error: unknown): boolean {
    const classified = this.classifyError(error);
    return classified.category === "rate_limit";
  }

  /**
   * Default implementation returns false - override for providers with native structured output
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hasStructuredOutput(_response: unknown): boolean {
    return false;
  }

  /**
   * Default implementation returns undefined - override for providers with native structured output
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extractStructuredOutput(_response: unknown): JsonObject | undefined {
    return undefined;
  }
}
