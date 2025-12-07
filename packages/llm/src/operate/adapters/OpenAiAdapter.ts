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
import { Toolkit } from "../../tools/Toolkit.class.js";
import {
  LlmHistory,
  LlmMessageType,
  LlmOperateOptions,
  LlmToolResult,
  LlmUsageItem,
} from "../../types/LlmProvider.interface.js";
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
    const openaiRequest: Record<string, unknown> = {
      model: request.model || this.defaultModel,
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

    if (request.providerOptions) {
      Object.assign(openaiRequest, request.providerOptions);
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

  async executeRequest(client: unknown, request: unknown): Promise<unknown> {
    const openai = client as OpenAI;
    // @ts-expect-error OpenAI SDK types don't match our request format exactly
    return await openai.responses.create(request);
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
