import { JsonObject, NaturalSchema } from "@jaypie/types";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  OpenAI,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod/v4";

import { PROVIDER } from "../../constants.js";

// Patterns for OpenAI reasoning models that support extended thinking
const REASONING_MODEL_PATTERNS = [
  /^gpt-[5-9]/, // GPT-5 and above (gpt-5, gpt-5.1, gpt-5.2, gpt-6, etc.)
  /^o\d/, // O-series (o1, o3, o4, o5, etc.)
] as const;

/**
 * Check if a model is a reasoning model that supports extended thinking
 */
function isReasoningModel(model: string): boolean {
  return REASONING_MODEL_PATTERNS.some((pattern) => pattern.test(model));
}
import { Toolkit } from "../../tools/Toolkit.class.js";
import {
  LlmHistory,
  LlmMessageType,
  LlmOperateOptions,
  LlmToolResult,
  LlmUsageItem,
} from "../../types/LlmProvider.interface.js";
import {
  LlmStreamChunk,
  LlmStreamChunkType,
} from "../../types/LlmStreamChunk.interface.js";
import { naturalZodSchema } from "../../util/index.js";
import { OpenAIRawResponse } from "../../providers/openai/types.js";
import {
  ClassifiedError,
  ErrorCategory,
  OperateRequest,
  ParsedResponse,
  ProviderToolDefinition,
  StandardToolCall,
  StandardToolResult,
} from "../types.js";
import { isTransientNetworkError } from "../retry/isTransientNetworkError.js";
import { BaseProviderAdapter } from "./ProviderAdapter.interface.js";

//
//
// Constants
//

const RETRYABLE_ERROR_TYPES = [
  APIConnectionError,
  APIConnectionTimeoutError,
  InternalServerError,
];

const NOT_RETRYABLE_ERROR_TYPES = [
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
];

//
//
// Main
//

/**
 * OpenAiAdapter implements the ProviderAdapter interface for OpenAI's API.
 * It handles request building, response parsing, and error classification
 * specific to OpenAI's Responses API.
 */
export class OpenAiAdapter extends BaseProviderAdapter {
  readonly name = PROVIDER.OPENAI.NAME;
  readonly defaultModel = PROVIDER.OPENAI.MODEL.DEFAULT;

  //
  // Request Building
  //

  buildRequest(request: OperateRequest): unknown {
    const model = request.model || this.defaultModel;
    const openaiRequest: Record<string, unknown> = {
      model,
      input: request.messages,
    };

    if (request.user) {
      openaiRequest.user = request.user;
    }

    if (request.instructions) {
      openaiRequest.instructions = request.instructions;
    }

    if (request.tools && request.tools.length > 0) {
      openaiRequest.tools = request.tools.map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));
    }

    if (request.format) {
      openaiRequest.text = {
        format: request.format,
      };
    }

    // Enable reasoning summary for reasoning models (o1, o3, etc.)
    // This allows us to extract reasoning text from the response
    if (isReasoningModel(model)) {
      openaiRequest.reasoning = {
        summary: "auto",
      };
    }

    if (request.providerOptions) {
      Object.assign(openaiRequest, request.providerOptions);
    }

    // First-class temperature takes precedence over providerOptions
    if (request.temperature !== undefined) {
      openaiRequest.temperature = request.temperature;
    }

    return openaiRequest;
  }

  formatTools(
    toolkit: Toolkit,
    _outputSchema?: JsonObject,
  ): ProviderToolDefinition[] {
    return toolkit.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as JsonObject,
    }));
  }

  formatOutputSchema(
    schema: JsonObject | NaturalSchema | z.ZodType,
  ): JsonObject {
    // Check if schema is already a JsonObject with type "json_schema"
    if (
      typeof schema === "object" &&
      schema !== null &&
      !Array.isArray(schema) &&
      (schema as JsonObject).type === "json_schema"
    ) {
      return schema as JsonObject;
    }

    // Convert NaturalSchema to Zod schema if needed
    const zodSchema =
      schema instanceof z.ZodType
        ? schema
        : naturalZodSchema(schema as NaturalSchema);

    const responseFormat = zodResponseFormat(zodSchema as any, "response");
    const jsonSchema = z.toJSONSchema(zodSchema) as Record<string, unknown>;

    // OpenAI requires additionalProperties to be false on all objects
    const checks = [jsonSchema];
    while (checks.length > 0) {
      const current = checks[0] as Record<string, unknown>;
      if (current.type === "object") {
        current.additionalProperties = false;
      }
      Object.keys(current).forEach((key) => {
        if (typeof current[key] === "object" && current[key] !== null) {
          checks.push(current[key] as Record<string, unknown>);
        }
      });
      checks.shift();
    }

    return {
      name: responseFormat.json_schema.name,
      schema: jsonSchema as JsonObject,
      strict: responseFormat.json_schema.strict,
      type: responseFormat.type,
    };
  }

  //
  // API Execution
  //

  async executeRequest(
    client: unknown,
    request: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const openai = client as OpenAI;
    try {
      // @ts-expect-error OpenAI SDK types don't match our request format exactly
      return await openai.responses.create(request, signal ? { signal } : undefined);
    } catch (error) {
      if (signal?.aborted) return undefined;
      throw error;
    }
  }

  async *executeStreamRequest(
    client: unknown,
    request: unknown,
    signal?: AbortSignal,
  ): AsyncIterable<LlmStreamChunk> {
    const openai = client as OpenAI;
    const baseRequest = request as Record<string, unknown>;
    const streamRequest = {
      ...baseRequest,
      stream: true,
    };

    const stream = await openai.responses.create(
      streamRequest as Parameters<typeof openai.responses.create>[0],
      signal ? { signal } : undefined,
    );

    // Track current function call being built
    let currentFunctionCall: {
      id: string;
      callId: string;
      name: string;
      arguments: string;
    } | null = null;

    // Track usage for final chunk
    let inputTokens = 0;
    let outputTokens = 0;
    let reasoningTokens = 0;
    const model = (baseRequest.model as string) || this.defaultModel;

    // Cast to async iterable - when stream: true, this is always a Stream<ResponseStreamEvent>
    const asyncStream = stream as AsyncIterable<Record<string, unknown>>;
    for await (const event of asyncStream) {
      const eventType = event.type as string;

      if (eventType === "response.output_text.delta") {
        // Text content delta
        const delta = (event as { delta?: string }).delta;
        if (delta) {
          yield {
            type: LlmStreamChunkType.Text,
            content: delta,
          };
        }
      } else if (eventType === "response.function_call_arguments.delta") {
        // Function call arguments delta - accumulate
        const delta = (event as { delta?: string }).delta;
        if (delta && currentFunctionCall) {
          currentFunctionCall.arguments += delta;
        }
      } else if (eventType === "response.output_item.added") {
        // New output item - check if it's a function call
        const item = (
          event as {
            item?: {
              type?: string;
              id?: string;
              call_id?: string;
              name?: string;
            };
          }
        ).item;
        if (item?.type === "function_call") {
          currentFunctionCall = {
            id: item.id || "",
            callId: item.call_id || "",
            name: item.name || "",
            arguments: "",
          };
        }
      } else if (eventType === "response.output_item.done") {
        // Output item completed - emit function call if that's what we were building
        if (currentFunctionCall) {
          yield {
            type: LlmStreamChunkType.ToolCall,
            toolCall: {
              id: currentFunctionCall.callId,
              name: currentFunctionCall.name,
              arguments: currentFunctionCall.arguments,
            },
          };
          currentFunctionCall = null;
        }
      } else if (eventType === "response.completed") {
        // Response completed - extract final usage
        const response = (event as { response?: OpenAIRawResponse }).response;
        if (response?.usage) {
          inputTokens = response.usage.input_tokens || 0;
          outputTokens = response.usage.output_tokens || 0;
          reasoningTokens =
            response.usage.output_tokens_details?.reasoning_tokens || 0;
        }
      } else if (eventType === "response.done") {
        // Stream done - emit final chunk with usage
        yield {
          type: LlmStreamChunkType.Done,
          usage: [
            {
              input: inputTokens,
              output: outputTokens,
              reasoning: reasoningTokens,
              total: inputTokens + outputTokens,
              provider: this.name,
              model,
            },
          ],
        };
      }
    }
  }

  //
  // Response Parsing
  //

  parseResponse(
    response: unknown,
    options?: LlmOperateOptions,
  ): ParsedResponse {
    const openaiResponse = response as OpenAIRawResponse;

    const content = this.extractContent(openaiResponse, options);
    const hasToolCalls = this.hasToolCalls(openaiResponse);

    return {
      content,
      hasToolCalls,
      stopReason: openaiResponse.status as string | undefined,
      usage: this.extractUsage(
        openaiResponse,
        options?.model || this.defaultModel,
      ),
      raw: openaiResponse,
    };
  }

  extractToolCalls(response: unknown): StandardToolCall[] {
    const openaiResponse = response as OpenAIRawResponse;
    const toolCalls: StandardToolCall[] = [];

    if (!openaiResponse.output || !Array.isArray(openaiResponse.output)) {
      return toolCalls;
    }

    for (const output of openaiResponse.output) {
      if (output.type === LlmMessageType.FunctionCall) {
        toolCalls.push({
          callId: output.call_id,
          name: output.name,
          arguments: output.arguments,
          raw: output,
        });
      }
    }

    return toolCalls;
  }

  extractUsage(response: unknown, model: string): LlmUsageItem {
    const openaiResponse = response as OpenAIRawResponse;

    if (!openaiResponse.usage) {
      return {
        input: 0,
        output: 0,
        reasoning: 0,
        total: 0,
        provider: this.name,
        model,
      };
    }

    return {
      input: openaiResponse.usage.input_tokens || 0,
      output: openaiResponse.usage.output_tokens || 0,
      reasoning:
        openaiResponse.usage.output_tokens_details?.reasoning_tokens || 0,
      total: openaiResponse.usage.total_tokens || 0,
      provider: this.name,
      model,
    };
  }

  //
  // Tool Result Handling
  //

  formatToolResult(
    toolCall: StandardToolCall,
    result: StandardToolResult,
  ): LlmToolResult {
    return {
      call_id: toolCall.callId,
      output: result.output,
      type: LlmMessageType.FunctionCallOutput,
    };
  }

  appendToolResult(
    request: unknown,
    toolCall: StandardToolCall,
    result: StandardToolResult,
  ): unknown {
    const openaiRequest = request as Record<string, unknown>;
    const input = openaiRequest.input as unknown[];

    // Note: The function_call item has already been added via responseToHistoryItems
    // which is called before processing tool calls. This includes any required
    // reasoning items that precede the function_call.

    // Add only the function call result
    input.push({
      call_id: toolCall.callId,
      output: result.output,
      type: LlmMessageType.FunctionCallOutput,
    });

    return openaiRequest;
  }

  //
  // History Management
  //

  responseToHistoryItems(response: unknown): LlmHistory {
    const openaiResponse = response as OpenAIRawResponse;
    const historyItems: LlmHistory = [];

    if (!openaiResponse.output || !Array.isArray(openaiResponse.output)) {
      return historyItems;
    }

    // Include all output items, including reasoning items
    // OpenAI requires reasoning items to be present when a function_call references them
    for (const output of openaiResponse.output) {
      historyItems.push(output);
    }

    return historyItems;
  }

  //
  // Error Classification
  //

  classifyError(error: unknown): ClassifiedError {
    // Check for rate limit error
    if (error instanceof RateLimitError) {
      return {
        error,
        category: ErrorCategory.RateLimit,
        shouldRetry: false, // Rate limit requires waiting, not immediate retry
        suggestedDelayMs: 60000, // 1 minute default
      };
    }

    // Check for retryable errors
    for (const ErrorType of RETRYABLE_ERROR_TYPES) {
      if (error instanceof ErrorType) {
        return {
          error,
          category: ErrorCategory.Retryable,
          shouldRetry: true,
        };
      }
    }

    // Check for non-retryable errors
    for (const ErrorType of NOT_RETRYABLE_ERROR_TYPES) {
      if (error instanceof ErrorType) {
        return {
          error,
          category: ErrorCategory.Unrecoverable,
          shouldRetry: false,
        };
      }
    }

    // Check for transient network errors (ECONNRESET, etc.)
    if (isTransientNetworkError(error)) {
      return {
        error,
        category: ErrorCategory.Retryable,
        shouldRetry: true,
      };
    }

    // Unknown error - treat as potentially retryable
    return {
      error,
      category: ErrorCategory.Unknown,
      shouldRetry: true,
    };
  }

  //
  // Provider-Specific Features
  //

  isComplete(response: unknown): boolean {
    const openaiResponse = response as OpenAIRawResponse;

    // Check if there are any function calls in the output
    if (!openaiResponse.output || !Array.isArray(openaiResponse.output)) {
      return true;
    }

    for (const output of openaiResponse.output) {
      if (output.type === LlmMessageType.FunctionCall) {
        return false;
      }
    }

    return true;
  }

  //
  // Private Helpers
  //

  private hasToolCalls(response: OpenAIRawResponse): boolean {
    if (!response.output || !Array.isArray(response.output)) {
      return false;
    }

    return response.output.some(
      (output) => output.type === LlmMessageType.FunctionCall,
    );
  }

  private extractContent(
    response: OpenAIRawResponse,
    options?: LlmOperateOptions,
  ): string | JsonObject | undefined {
    if (!response.output || !Array.isArray(response.output)) {
      return undefined;
    }

    for (const output of response.output) {
      if (output.type === LlmMessageType.Message) {
        if (
          output.content?.[0] &&
          output.content[0].type === LlmMessageType.OutputText
        ) {
          const rawContent = output.content[0].text;

          // If format is provided, try to parse the content as JSON
          if (options?.format && typeof rawContent === "string") {
            try {
              return JSON.parse(rawContent);
            } catch {
              // If parsing fails, return the original string
              return rawContent;
            }
          }

          return rawContent;
        }
      }

      // Skip reasoning and function call items when extracting content
      if (
        output.type === "reasoning" ||
        output.type === LlmMessageType.FunctionCall
      ) {
        continue;
      }
    }

    return undefined;
  }
}

// Export singleton instance
export const openAiAdapter = new OpenAiAdapter();
