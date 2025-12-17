import type { Anthropic } from "@anthropic-ai/sdk";
import { JsonObject, NaturalSchema } from "@jaypie/types";
import { z } from "zod/v4";

import { PROVIDER } from "../../constants.js";
import { Toolkit } from "../../tools/Toolkit.class.js";
import {
  LlmHistory,
  LlmMessageType,
  LlmOperateOptions,
  LlmOutputMessage,
  LlmUsageItem,
} from "../../types/LlmProvider.interface.js";
import {
  LlmStreamChunk,
  LlmStreamChunkType,
} from "../../types/LlmStreamChunk.interface.js";
import { naturalZodSchema } from "../../util/index.js";
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

const STRUCTURED_OUTPUT_TOOL_NAME = "structured_output";

// Error names for classification (using string names since SDK is optional)
const RETRYABLE_ERROR_NAMES = [
  "APIConnectionError",
  "APIConnectionTimeoutError",
  "InternalServerError",
];

const NOT_RETRYABLE_ERROR_NAMES = [
  "AuthenticationError",
  "BadRequestError",
  "NotFoundError",
  "PermissionDeniedError",
];

//
//
// Main
//

/**
 * AnthropicAdapter implements the ProviderAdapter interface for Anthropic's API.
 * It handles request building, response parsing, and error classification
 * specific to Anthropic's Messages API.
 */
export class AnthropicAdapter extends BaseProviderAdapter {
  readonly name = PROVIDER.ANTHROPIC.NAME;
  readonly defaultModel = PROVIDER.ANTHROPIC.MODEL.DEFAULT;

  //
  // Request Building
  //

  buildRequest(request: OperateRequest): Anthropic.MessageCreateParams {
    // Convert messages to Anthropic format (remove 'type' property)
    const messages: Anthropic.MessageParam[] = request.messages.map((msg) => {
      const anthropicMsg = structuredClone(msg) as unknown as Record<
        string,
        unknown
      >;
      delete anthropicMsg.type;
      return anthropicMsg as unknown as Anthropic.MessageParam;
    });

    // Append instructions to last message if provided
    if (request.instructions && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (typeof lastMsg.content === "string") {
        lastMsg.content = lastMsg.content + "\n\n" + request.instructions;
      }
    }

    const anthropicRequest: Anthropic.MessageCreateParams = {
      model: (request.model ||
        this.defaultModel) as Anthropic.MessageCreateParams["model"],
      messages,
      max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
      stream: false,
    };

    if (request.system) {
      anthropicRequest.system = request.system;
    }

    if (request.tools && request.tools.length > 0) {
      anthropicRequest.tools = request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: {
          ...tool.parameters,
          type: "object",
        } as Anthropic.Messages.Tool.InputSchema,
        type: "custom" as const,
      }));

      // Determine tool choice based on whether structured output is requested
      const hasStructuredOutput = request.tools.some(
        (t) => t.name === STRUCTURED_OUTPUT_TOOL_NAME,
      );
      anthropicRequest.tool_choice = {
        type: hasStructuredOutput ? "any" : "auto",
      };
    }

    if (request.providerOptions) {
      Object.assign(anthropicRequest, request.providerOptions);
    }

    return anthropicRequest;
  }

  formatTools(
    toolkit: Toolkit,
    outputSchema?: JsonObject,
  ): ProviderToolDefinition[] {
    const tools: ProviderToolDefinition[] = toolkit.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        ...tool.parameters,
        type: "object",
      } as JsonObject,
    }));

    // Add structured output tool if schema is provided
    if (outputSchema) {
      tools.push({
        name: STRUCTURED_OUTPUT_TOOL_NAME,
        description:
          "Output a structured JSON object, " +
          "use this before your final response to give structured outputs to the user",
        parameters: outputSchema,
      });
    }

    return tools;
  }

  formatOutputSchema(
    schema: JsonObject | NaturalSchema | z.ZodType,
  ): JsonObject {
    let jsonSchema: JsonObject;

    // Check if schema is already a JsonObject with type "json_schema"
    if (
      typeof schema === "object" &&
      schema !== null &&
      !Array.isArray(schema) &&
      (schema as JsonObject).type === "json_schema"
    ) {
      jsonSchema = structuredClone(schema) as JsonObject;
      jsonSchema.type = "object"; // Validator does not recognize "json_schema"
    } else {
      // Convert NaturalSchema to JSON schema through Zod
      const zodSchema =
        schema instanceof z.ZodType
          ? schema
          : naturalZodSchema(schema as NaturalSchema);
      jsonSchema = z.toJSONSchema(zodSchema) as JsonObject;
    }

    // Remove $schema property (causes issues with validator)
    if (jsonSchema.$schema) {
      delete jsonSchema.$schema;
    }

    return jsonSchema;
  }

  //
  // API Execution
  //

  async executeRequest(
    client: unknown,
    request: unknown,
  ): Promise<Anthropic.Message> {
    const anthropic = client as Anthropic;
    return (await anthropic.messages.create(
      request as Anthropic.MessageCreateParams,
    )) as Anthropic.Message;
  }

  async *executeStreamRequest(
    client: unknown,
    request: unknown,
  ): AsyncIterable<LlmStreamChunk> {
    const anthropic = client as Anthropic;
    const streamRequest = {
      ...(request as Anthropic.MessageCreateParams),
      stream: true,
    } as Anthropic.MessageCreateParamsStreaming;

    const stream = await anthropic.messages.create(streamRequest);

    // Track current tool call being built
    let currentToolCall: {
      id: string;
      name: string;
      arguments: string;
    } | null = null;

    // Track usage for final chunk
    let inputTokens = 0;
    let outputTokens = 0;
    let model = streamRequest.model;

    for await (const event of stream) {
      if (event.type === "message_start") {
        // Extract initial usage and model info
        const message = event.message;
        if (message.usage) {
          inputTokens = message.usage.input_tokens;
        }
        model = message.model;
      } else if (event.type === "content_block_start") {
        const contentBlock = event.content_block;
        if (contentBlock.type === "tool_use") {
          // Start building a tool call
          currentToolCall = {
            id: contentBlock.id,
            name: contentBlock.name,
            arguments: "",
          };
        }
      } else if (event.type === "content_block_delta") {
        const delta = event.delta;
        if (delta.type === "text_delta") {
          yield {
            type: LlmStreamChunkType.Text,
            content: delta.text,
          };
        } else if (delta.type === "input_json_delta" && currentToolCall) {
          // Accumulate tool call arguments
          currentToolCall.arguments += delta.partial_json;
        }
      } else if (event.type === "content_block_stop") {
        // If we were building a tool call, emit it now
        if (currentToolCall) {
          yield {
            type: LlmStreamChunkType.ToolCall,
            toolCall: {
              id: currentToolCall.id,
              name: currentToolCall.name,
              arguments: currentToolCall.arguments,
            },
          };
          currentToolCall = null;
        }
      } else if (event.type === "message_delta") {
        // Extract final usage
        if (event.usage) {
          outputTokens = event.usage.output_tokens;
        }
      } else if (event.type === "message_stop") {
        // Emit done chunk with usage
        yield {
          type: LlmStreamChunkType.Done,
          usage: [
            {
              input: inputTokens,
              output: outputTokens,
              reasoning: 0,
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
    _options?: LlmOperateOptions,
  ): ParsedResponse {
    const anthropicResponse = response as Anthropic.Message;

    const content = this.extractContent(anthropicResponse);
    const hasToolCalls = anthropicResponse.stop_reason === "tool_use";

    return {
      content,
      hasToolCalls,
      stopReason: anthropicResponse.stop_reason ?? undefined,
      usage: this.extractUsage(anthropicResponse, anthropicResponse.model),
      raw: anthropicResponse,
    };
  }

  extractToolCalls(response: unknown): StandardToolCall[] {
    const anthropicResponse = response as Anthropic.Message;
    const toolCalls: StandardToolCall[] = [];

    for (const block of anthropicResponse.content) {
      if (block.type === "tool_use") {
        toolCalls.push({
          callId: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input),
          raw: block,
        });
      }
    }

    return toolCalls;
  }

  extractUsage(response: unknown, model: string): LlmUsageItem {
    const anthropicResponse = response as Anthropic.Message;

    return {
      input: anthropicResponse.usage.input_tokens,
      output: anthropicResponse.usage.output_tokens,
      reasoning: 0, // Anthropic doesn't expose reasoning tokens
      total:
        anthropicResponse.usage.input_tokens +
        anthropicResponse.usage.output_tokens,
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
  ): Anthropic.ToolResultBlockParam {
    return {
      type: "tool_result",
      tool_use_id: toolCall.callId,
      content: result.output,
    };
  }

  appendToolResult(
    request: unknown,
    toolCall: StandardToolCall,
    result: StandardToolResult,
  ): Anthropic.MessageCreateParams {
    const anthropicRequest = request as Anthropic.MessageCreateParams;
    const toolCallRaw = toolCall.raw as Anthropic.ToolUseBlock;

    // Add assistant message with the tool use
    anthropicRequest.messages.push({
      role: "assistant",
      content: [toolCallRaw],
    });

    // Add user message with the tool result
    anthropicRequest.messages.push({
      role: "user",
      content: [this.formatToolResult(toolCall, result)],
    });

    return anthropicRequest;
  }

  //
  // History Management
  //

  responseToHistoryItems(response: unknown): LlmHistory {
    const anthropicResponse = response as Anthropic.Message;
    const historyItems: LlmHistory = [];

    // Check if this is a tool use response
    if (anthropicResponse.stop_reason === "tool_use") {
      // Don't add to history yet - will be added after tool execution
      return historyItems;
    }

    // Extract text content for non-tool responses
    const textBlock = anthropicResponse.content.find(
      (block) => block.type === "text",
    ) as Anthropic.TextBlock | undefined;

    if (textBlock) {
      historyItems.push({
        content: textBlock.text,
        role: PROVIDER.ANTHROPIC.ROLE.ASSISTANT,
        type: LlmMessageType.Message,
      } as LlmOutputMessage);
    }

    return historyItems;
  }

  //
  // Error Classification
  //

  classifyError(error: unknown): ClassifiedError {
    const errorName = (error as Error)?.constructor?.name;

    // Check for rate limit error
    if (errorName === "RateLimitError") {
      return {
        error,
        category: ErrorCategory.RateLimit,
        shouldRetry: false,
        suggestedDelayMs: 60000,
      };
    }

    // Check for retryable errors
    if (RETRYABLE_ERROR_NAMES.includes(errorName)) {
      return {
        error,
        category: ErrorCategory.Retryable,
        shouldRetry: true,
      };
    }

    // Check for non-retryable errors
    if (NOT_RETRYABLE_ERROR_NAMES.includes(errorName)) {
      return {
        error,
        category: ErrorCategory.Unrecoverable,
        shouldRetry: false,
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
    const anthropicResponse = response as Anthropic.Message;
    return anthropicResponse.stop_reason !== "tool_use";
  }

  override hasStructuredOutput(response: unknown): boolean {
    const anthropicResponse = response as Anthropic.Message;

    // Check if the last content block is a tool_use with structured_output
    const lastBlock =
      anthropicResponse.content[anthropicResponse.content.length - 1];
    return (
      lastBlock?.type === "tool_use" &&
      (lastBlock as Anthropic.ToolUseBlock).name === STRUCTURED_OUTPUT_TOOL_NAME
    );
  }

  override extractStructuredOutput(response: unknown): JsonObject | undefined {
    const anthropicResponse = response as Anthropic.Message;

    const lastBlock =
      anthropicResponse.content[anthropicResponse.content.length - 1];
    if (
      lastBlock?.type === "tool_use" &&
      (lastBlock as Anthropic.ToolUseBlock).name === STRUCTURED_OUTPUT_TOOL_NAME
    ) {
      return (lastBlock as Anthropic.ToolUseBlock).input as JsonObject;
    }

    return undefined;
  }

  //
  // Private Helpers
  //

  private extractContent(
    response: Anthropic.Message,
  ): string | JsonObject | undefined {
    // Check for structured output first
    if (this.hasStructuredOutput(response)) {
      return this.extractStructuredOutput(response);
    }

    // Extract text content
    const textBlock = response.content.find(
      (block) => block.type === "text",
    ) as Anthropic.TextBlock | undefined;

    return textBlock?.text;
  }
}

// Export singleton instance
export const anthropicAdapter = new AnthropicAdapter();
