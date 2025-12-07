import { JsonObject, NaturalSchema } from "@jaypie/types";
import { OpenRouter } from "@openrouter/sdk";
import { z } from "zod/v4";

import { PROVIDER } from "../../constants.js";
import { Toolkit } from "../../tools/Toolkit.class.js";
import {
  LlmHistory,
  LlmMessageRole,
  LlmMessageType,
  LlmOperateOptions,
  LlmOutputMessage,
  LlmUsageItem,
} from "../../types/LlmProvider.interface.js";
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
// Types
//

// Request types - SDK validates using camelCase internally
interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  toolCalls?: OpenRouterToolCall[];
  toolCallId?: string;
}

interface OpenRouterToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// Response types (camelCase - what SDK returns)
interface OpenRouterResponseMessage {
  role: "assistant";
  content?: string | null;
  toolCalls?: OpenRouterToolCall[];
  refusal?: string | null;
  reasoning?: string | null;
}

interface OpenRouterChoice {
  index: number;
  message: OpenRouterResponseMessage;
  finishReason: string | null;
  finish_reason?: string | null; // Some responses may use snake_case
}

interface OpenRouterUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  // Also support snake_case for backward compatibility
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenRouterChoice[];
  usage?: OpenRouterUsage;
}

interface OpenRouterTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonObject;
  };
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  tools?: OpenRouterTool[];
  tool_choice?: "auto" | "none" | "required";
  response_format?: { type: "json_object" | "text" };
  user?: string;
}

//
//
// Constants
//

const STRUCTURED_OUTPUT_TOOL_NAME = "structured_output";

// OpenRouter SDK error types based on HTTP status codes
const RETRYABLE_STATUS_CODES = [408, 500, 502, 503, 524, 529];
const RATE_LIMIT_STATUS_CODE = 429;

//
//
// Main
//

/**
 * OpenRouterAdapter implements the ProviderAdapter interface for OpenRouter's API.
 * OpenRouter provides a unified API to access hundreds of AI models through OpenAI-compatible endpoints.
 * It handles request building, response parsing, and error classification
 * specific to OpenRouter's Chat Completions API.
 */
export class OpenRouterAdapter extends BaseProviderAdapter {
  readonly name = PROVIDER.OPENROUTER.NAME;
  readonly defaultModel = PROVIDER.OPENROUTER.MODEL.DEFAULT;

  //
  // Request Building
  //

  buildRequest(request: OperateRequest): OpenRouterRequest {
    // Convert messages to OpenRouter format (OpenAI-compatible)
    const messages: OpenRouterMessage[] = this.convertMessagesToOpenRouter(
      request.messages,
      request.system,
    );

    // Append instructions to last message if provided
    if (request.instructions && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.content && typeof lastMsg.content === "string") {
        lastMsg.content = lastMsg.content + "\n\n" + request.instructions;
      }
    }

    const openRouterRequest: OpenRouterRequest = {
      model: request.model || this.defaultModel,
      messages,
    };

    if (request.user) {
      openRouterRequest.user = request.user;
    }

    if (request.tools && request.tools.length > 0) {
      openRouterRequest.tools = request.tools.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));

      // Determine tool choice based on whether structured output is requested
      const hasStructuredOutput = request.tools.some(
        (t) => t.name === STRUCTURED_OUTPUT_TOOL_NAME,
      );
      openRouterRequest.tool_choice = hasStructuredOutput ? "required" : "auto";
    }

    if (request.providerOptions) {
      Object.assign(openRouterRequest, request.providerOptions);
    }

    return openRouterRequest;
  }

  formatTools(
    toolkit: Toolkit,
    outputSchema?: JsonObject,
  ): ProviderToolDefinition[] {
    const tools: ProviderToolDefinition[] = toolkit.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as JsonObject,
    }));

    // Add structured output tool if schema is provided
    // (OpenRouter doesn't have native structured output like OpenAI, so use tool approach)
    if (outputSchema) {
      tools.push({
        name: STRUCTURED_OUTPUT_TOOL_NAME,
        description:
          "REQUIRED: You MUST call this tool to provide your final response. " +
          "After gathering all necessary information (including results from other tools), " +
          "call this tool with the structured data to complete the request.",
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
      jsonSchema.type = "object"; // Normalize type
    } else {
      // Convert NaturalSchema to JSON schema through Zod
      const zodSchema =
        schema instanceof z.ZodType
          ? schema
          : naturalZodSchema(schema as NaturalSchema);
      jsonSchema = z.toJSONSchema(zodSchema) as JsonObject;
    }

    // Remove $schema property (can cause issues with some providers)
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
  ): Promise<OpenRouterResponse> {
    const openRouter = client as OpenRouter;
    const openRouterRequest = request as OpenRouterRequest;

    const response = await openRouter.chat.send({
      model: openRouterRequest.model,
      messages: openRouterRequest.messages as Parameters<
        typeof openRouter.chat.send
      >[0]["messages"],
      tools: openRouterRequest.tools as Parameters<
        typeof openRouter.chat.send
      >[0]["tools"],
      toolChoice: openRouterRequest.tool_choice,
      user: openRouterRequest.user,
    });

    return response as unknown as OpenRouterResponse;
  }

  //
  // Response Parsing
  //

  parseResponse(
    response: unknown,
    _options?: LlmOperateOptions,
  ): ParsedResponse {
    const openRouterResponse = response as OpenRouterResponse;
    const choice = openRouterResponse.choices[0];

    const content = this.extractContent(openRouterResponse);
    const hasToolCalls = this.hasToolCalls(openRouterResponse);

    // SDK returns camelCase (finishReason), but support snake_case as fallback
    const stopReason =
      choice?.finishReason ?? choice?.finish_reason ?? undefined;

    return {
      content,
      hasToolCalls,
      stopReason,
      usage: this.extractUsage(openRouterResponse, openRouterResponse.model),
      raw: openRouterResponse,
    };
  }

  extractToolCalls(response: unknown): StandardToolCall[] {
    const openRouterResponse = response as OpenRouterResponse;
    const toolCalls: StandardToolCall[] = [];
    const choice = openRouterResponse.choices[0];

    // SDK returns camelCase (toolCalls)
    if (!choice?.message?.toolCalls) {
      return toolCalls;
    }

    for (const toolCall of choice.message.toolCalls) {
      toolCalls.push({
        callId: toolCall.id,
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
        raw: toolCall,
      });
    }

    return toolCalls;
  }

  extractUsage(response: unknown, model: string): LlmUsageItem {
    const openRouterResponse = response as OpenRouterResponse;

    if (!openRouterResponse.usage) {
      return {
        input: 0,
        output: 0,
        reasoning: 0,
        total: 0,
        provider: this.name,
        model,
      };
    }

    // SDK returns camelCase, but support snake_case as fallback
    const usage = openRouterResponse.usage;
    return {
      input: usage.promptTokens || usage.prompt_tokens || 0,
      output: usage.completionTokens || usage.completion_tokens || 0,
      reasoning: 0, // OpenRouter doesn't expose reasoning tokens in standard format
      total: usage.totalTokens || usage.total_tokens || 0,
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
  ): OpenRouterMessage {
    return {
      role: "tool",
      toolCallId: toolCall.callId,
      content: result.output,
    };
  }

  appendToolResult(
    request: unknown,
    toolCall: StandardToolCall,
    result: StandardToolResult,
  ): OpenRouterRequest {
    const openRouterRequest = request as OpenRouterRequest;
    const toolCallRaw = toolCall.raw as OpenRouterToolCall;

    // Add assistant message with the tool call (SDK uses camelCase)
    openRouterRequest.messages.push({
      role: "assistant",
      content: null,
      toolCalls: [toolCallRaw],
    });

    // Add tool result message
    openRouterRequest.messages.push(this.formatToolResult(toolCall, result));

    return openRouterRequest;
  }

  //
  // History Management
  //

  responseToHistoryItems(response: unknown): LlmHistory {
    const openRouterResponse = response as OpenRouterResponse;
    const historyItems: LlmHistory = [];
    const choice = openRouterResponse.choices[0];

    if (!choice?.message) {
      return historyItems;
    }

    // Check if this is a tool use response (SDK returns camelCase)
    if (choice.message.toolCalls && choice.message.toolCalls.length > 0) {
      // Don't add to history yet - will be added after tool execution
      return historyItems;
    }

    // Extract text content for non-tool responses
    if (choice.message.content) {
      historyItems.push({
        content: choice.message.content,
        role: LlmMessageRole.Assistant,
        type: LlmMessageType.Message,
      } as LlmOutputMessage);
    }

    return historyItems;
  }

  //
  // Error Classification
  //

  classifyError(error: unknown): ClassifiedError {
    // Check if error has a status code (HTTP error)
    const errorWithStatus = error as { status?: number; statusCode?: number };
    const statusCode = errorWithStatus.status || errorWithStatus.statusCode;

    if (statusCode) {
      // Rate limit error
      if (statusCode === RATE_LIMIT_STATUS_CODE) {
        return {
          error,
          category: ErrorCategory.RateLimit,
          shouldRetry: false,
          suggestedDelayMs: 60000,
        };
      }

      // Retryable errors (server errors, timeouts, etc.)
      if (RETRYABLE_STATUS_CODES.includes(statusCode)) {
        return {
          error,
          category: ErrorCategory.Retryable,
          shouldRetry: true,
        };
      }

      // Client errors (4xx except 429) are unrecoverable
      if (statusCode >= 400 && statusCode < 500) {
        return {
          error,
          category: ErrorCategory.Unrecoverable,
          shouldRetry: false,
        };
      }
    }

    // Check error message for rate limit indicators
    const errorMessage =
      error instanceof Error ? error.message.toLowerCase() : "";
    if (
      errorMessage.includes("rate limit") ||
      errorMessage.includes("too many requests")
    ) {
      return {
        error,
        category: ErrorCategory.RateLimit,
        shouldRetry: false,
        suggestedDelayMs: 60000,
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
    const openRouterResponse = response as OpenRouterResponse;
    const choice = openRouterResponse.choices[0];

    // Complete if no tool calls (SDK returns camelCase)
    if (!choice?.message?.toolCalls?.length) {
      return true;
    }

    return false;
  }

  override hasStructuredOutput(response: unknown): boolean {
    const openRouterResponse = response as OpenRouterResponse;
    const choice = openRouterResponse.choices[0];

    // SDK returns camelCase (toolCalls)
    if (!choice?.message?.toolCalls?.length) {
      return false;
    }

    // Check if the last tool call is structured_output
    const lastToolCall =
      choice.message.toolCalls[choice.message.toolCalls.length - 1];
    return lastToolCall?.function?.name === STRUCTURED_OUTPUT_TOOL_NAME;
  }

  override extractStructuredOutput(response: unknown): JsonObject | undefined {
    const openRouterResponse = response as OpenRouterResponse;
    const choice = openRouterResponse.choices[0];

    // SDK returns camelCase (toolCalls)
    if (!choice?.message?.toolCalls?.length) {
      return undefined;
    }

    const lastToolCall =
      choice.message.toolCalls[choice.message.toolCalls.length - 1];
    if (lastToolCall?.function?.name === STRUCTURED_OUTPUT_TOOL_NAME) {
      try {
        return JSON.parse(lastToolCall.function.arguments) as JsonObject;
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  //
  // Private Helpers
  //

  private hasToolCalls(response: OpenRouterResponse): boolean {
    const choice = response.choices[0];
    // SDK returns camelCase (toolCalls)
    return (choice?.message?.toolCalls?.length ?? 0) > 0;
  }

  private extractContent(
    response: OpenRouterResponse,
  ): string | JsonObject | undefined {
    // Check for structured output first
    if (this.hasStructuredOutput(response)) {
      return this.extractStructuredOutput(response);
    }

    const choice = response.choices[0];
    return choice?.message?.content ?? undefined;
  }

  private convertMessagesToOpenRouter(
    messages: LlmHistory,
    system?: string,
  ): OpenRouterMessage[] {
    const openRouterMessages: OpenRouterMessage[] = [];

    // Add system message if provided
    if (system) {
      openRouterMessages.push({
        role: "system",
        content: system,
      });
    }

    for (const msg of messages) {
      const message = msg as unknown as Record<string, unknown>;

      // Handle different message types
      if (message.role === "system") {
        openRouterMessages.push({
          role: "system",
          content: message.content as string,
        });
      } else if (message.role === "user") {
        openRouterMessages.push({
          role: "user",
          content: message.content as string,
        });
      } else if (message.role === "assistant") {
        const assistantMsg: OpenRouterMessage = {
          role: "assistant",
          content: (message.content as string) || null,
        };

        // Include toolCalls if present (check both camelCase and snake_case for compatibility)
        if (message.toolCalls) {
          assistantMsg.toolCalls = message.toolCalls as OpenRouterToolCall[];
        } else if (message.tool_calls) {
          assistantMsg.toolCalls = message.tool_calls as OpenRouterToolCall[];
        }

        openRouterMessages.push(assistantMsg);
      } else if (message.role === "tool") {
        openRouterMessages.push({
          role: "tool",
          toolCallId:
            (message.toolCallId as string) || (message.tool_call_id as string),
          content: message.content as string,
        });
      } else if (message.type === LlmMessageType.Message) {
        // Handle internal message format
        const role = (message.role as string)?.toLowerCase();
        if (role === "assistant") {
          openRouterMessages.push({
            role: "assistant",
            content: message.content as string,
          });
        } else {
          openRouterMessages.push({
            role: "user",
            content: message.content as string,
          });
        }
      }
    }

    return openRouterMessages;
  }
}

// Export singleton instance
export const openRouterAdapter = new OpenRouterAdapter();
