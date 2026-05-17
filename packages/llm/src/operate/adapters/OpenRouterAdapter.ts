import { log } from "@jaypie/logger";
import { JsonObject, NaturalSchema } from "@jaypie/types";
import type { OpenRouter } from "@openrouter/sdk";
import { z } from "zod/v4";

import { PROVIDER } from "../../constants.js";
import { Toolkit } from "../../tools/Toolkit.class.js";
import {
  LlmHistory,
  LlmInputContent,
  LlmMessageRole,
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
import { isTransientNetworkError } from "../retry/isTransientNetworkError.js";
import { BaseProviderAdapter } from "./ProviderAdapter.interface.js";

//
//
// Types
//

// Request types - SDK validates using camelCase internally
interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | OpenRouterContentPart[] | null;
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
  // Reasoning tokens (some models like z-ai/glm include this)
  completionTokensDetails?: {
    reasoningTokens?: number;
  };
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

interface OpenRouterJsonSchemaConfig {
  name: string;
  description?: string;
  schema: JsonObject;
  strict?: boolean;
}

type OpenRouterResponseFormat =
  | { type: "json_schema"; json_schema: OpenRouterJsonSchemaConfig }
  | { type: "json_object" }
  | { type: "text" };

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  tools?: OpenRouterTool[];
  tool_choice?: "auto" | "none" | "required";
  response_format?: OpenRouterResponseFormat;
  user?: string;
}

/**
 * OpenRouter responses we annotate at receive time so downstream stateless
 * methods (`hasStructuredOutput`, `extractStructuredOutput`) can tell whether
 * the request asked for native structured output without re-threading the
 * request.
 */
type AnnotatedOpenRouterResponse = OpenRouterResponse & {
  __jaypieStructuredOutput?: boolean;
};

//
//
// Constants
//

const STRUCTURED_OUTPUT_TOOL_NAME = "structured_output";

const STRUCTURED_OUTPUT_SCHEMA_NAME = "response";

/**
 * Detect 4xx errors that indicate the model itself does not support
 * `response_format: json_schema`. Mirrors the Anthropic pattern: we only
 * trigger the fake-tool fallback when the failure is plausibly a capability
 * gap, not a generic 400.
 */
function isStructuredOutputUnsupportedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    status?: number;
    statusCode?: number;
    message?: string;
    error?: { message?: string };
  };
  const status = err.status ?? err.statusCode;
  if (status !== 400 && status !== 422) return false;
  const messages = [err.message, err.error?.message].filter(
    (m): m is string => typeof m === "string",
  );
  return messages.some((m) =>
    /response_format|json[_ ]schema|structured[_ ]output|require[_ ]parameters/i.test(
      m,
    ),
  );
}

// OpenRouter routes that don't accept `temperature`. Patterns match the
// vendor-prefixed route id (e.g. `openai/gpt-5.5`) so dated variants are
// covered without code changes.
const MODELS_WITHOUT_TEMPERATURE: RegExp[] = [
  /^openai\/gpt-5\.5/,
  /^openai\/o\d/,
  /^anthropic\/claude-opus-4-[789]/,
  /^anthropic\/claude-opus-[5-9]/,
];

function isTemperatureDeprecationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    status?: number;
    statusCode?: number;
    message?: string;
    error?: { message?: string };
  };
  const status = err.status ?? err.statusCode;
  if (status !== 400) return false;
  const messages = [err.message, err.error?.message].filter(
    (m): m is string => typeof m === "string",
  );
  return messages.some((m) => m.toLowerCase().includes("temperature"));
}

/**
 * OpenRouter content part types. OpenRouter follows the OpenAI Chat
 * Completions multimodal schema and forwards `image_url` and `file` parts
 * to vision/PDF-capable backends. The SDK accepts camelCase fields at the
 * input boundary (`imageUrl`, `fileData`) and transforms to snake_case on
 * the wire.
 */
type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; imageUrl: { url: string } }
  | { type: "file"; file: { filename?: string; fileData: string } };

/**
 * Convert standardized content items to OpenRouter format. Images become
 * `image_url` parts and files become `file` parts; both pass through to
 * OpenRouter which routes to the selected backend. Backends that don't
 * support the modality 4xx — that's a model-capability mismatch, surfaced
 * by the call rather than silently dropped here.
 */
function convertContentToOpenRouter(
  content: string | LlmInputContent[],
): string | OpenRouterContentPart[] {
  if (typeof content === "string") {
    return content;
  }

  const parts: OpenRouterContentPart[] = [];

  for (const item of content) {
    if (item.type === LlmMessageType.InputText) {
      parts.push({ type: "text", text: item.text });
      continue;
    }

    if (item.type === LlmMessageType.InputImage) {
      const url = item.image_url ?? "";
      if (!url) {
        log.warn("OpenRouter image content missing image_url; image discarded");
        continue;
      }
      parts.push({ type: "image_url", imageUrl: { url } });
      continue;
    }

    if (item.type === LlmMessageType.InputFile) {
      const fileData = typeof item.file_data === "string" ? item.file_data : "";
      if (!fileData) {
        log.warn(
          { filename: item.filename },
          "OpenRouter file content missing file_data; file discarded",
        );
        continue;
      }
      parts.push({
        type: "file",
        file: {
          filename: item.filename,
          fileData,
        },
      });
      continue;
    }

    // Unknown type - warn and skip
    log.warn({ item }, "Unknown content type for OpenRouter; discarded");
  }

  // If no parts remain, return empty string to avoid empty array
  if (parts.length === 0) {
    return "";
  }

  return parts;
}

// OpenRouter SDK error types based on HTTP status codes
const RETRYABLE_STATUS_CODES = [408, 500, 502, 503, 524, 529];
const RATE_LIMIT_STATUS_CODE = 429;

/**
 * Walk the JSON schema and force `additionalProperties: false` on every
 * object node. Required by the OpenAI-style json_schema response_format
 * (which OpenRouter accepts) when `strict: true`.
 */
function enforceAdditionalPropertiesFalse(schema: JsonObject): void {
  const stack: JsonObject[] = [schema];
  while (stack.length > 0) {
    const node = stack.pop() as JsonObject;
    if (node.type === "object") {
      node.additionalProperties = false;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (entry && typeof entry === "object" && !Array.isArray(entry)) {
            stack.push(entry as JsonObject);
          }
        }
      } else if (value && typeof value === "object") {
        stack.push(value as JsonObject);
      }
    }
  }
}

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

  // Session-level cache of models observed to reject native
  // `response_format: json_schema`. When a model is in this set, buildRequest
  // engages the legacy fake-tool path instead of native structured output.
  private runtimeNoStructuredOutputModels = new Set<string>();

  rememberModelRejectsStructuredOutput(model: string): void {
    this.runtimeNoStructuredOutputModels.add(model);
  }

  clearRuntimeNoStructuredOutputModels(): void {
    this.runtimeNoStructuredOutputModels.clear();
  }

  private supportsStructuredOutput(model: string): boolean {
    return !this.runtimeNoStructuredOutputModels.has(model);
  }

  // Session-level cache of routes observed to reject `temperature`. Populated
  // by executeRequest on 400 errors so repeat calls skip the param.
  private runtimeNoTemperatureModels = new Set<string>();

  rememberModelRejectsTemperature(model: string): void {
    this.runtimeNoTemperatureModels.add(model);
  }

  clearRuntimeNoTemperatureModels(): void {
    this.runtimeNoTemperatureModels.clear();
  }

  private supportsTemperature(model: string): boolean {
    if (this.runtimeNoTemperatureModels.has(model)) return false;
    return !MODELS_WITHOUT_TEMPERATURE.some((pattern) => pattern.test(model));
  }

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

    const useFallbackStructuredOutput =
      Boolean(request.format) &&
      !this.supportsStructuredOutput(openRouterRequest.model);

    const allTools: ProviderToolDefinition[] = request.tools
      ? [...request.tools]
      : [];
    if (useFallbackStructuredOutput && request.format) {
      log.warn(
        `[OpenRouterAdapter] Using legacy structured_output tool fallback for model ${openRouterRequest.model}; native response_format previously rejected for this model.`,
      );
      allTools.push({
        name: STRUCTURED_OUTPUT_TOOL_NAME,
        description:
          "REQUIRED: You MUST call this tool to provide your final response. " +
          "After gathering all necessary information (including results from other tools), " +
          "call this tool with the structured data to complete the request.",
        parameters: request.format,
      });
    }

    if (allTools.length > 0) {
      openRouterRequest.tools = allTools.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));

      // Use "auto" for tool_choice - many OpenRouter models don't support "required"
      // The structured_output tool prompt already emphasizes it must be called
      openRouterRequest.tool_choice = "auto";
    }

    // Native structured output: send schema as `response_format`. The legacy
    // tool-emulation path is engaged only as a runtime fallback for models the
    // API has flagged as not supporting native json_schema.
    if (request.format && !useFallbackStructuredOutput) {
      openRouterRequest.response_format = {
        type: "json_schema",
        json_schema: {
          name: STRUCTURED_OUTPUT_SCHEMA_NAME,
          schema: request.format,
          strict: true,
        },
      };
    }

    if (request.providerOptions) {
      Object.assign(openRouterRequest, request.providerOptions);
    }

    // First-class temperature takes precedence over providerOptions
    if (request.temperature !== undefined) {
      (openRouterRequest as unknown as Record<string, unknown>).temperature =
        request.temperature;
    }

    // Strip temperature for routes that don't support it (denylist + runtime cache)
    const requestRecord = openRouterRequest as unknown as Record<
      string,
      unknown
    >;
    if (
      requestRecord.temperature !== undefined &&
      !this.supportsTemperature(openRouterRequest.model)
    ) {
      delete requestRecord.temperature;
    }

    return openRouterRequest;
  }

  formatTools(
    toolkit: Toolkit,
    // outputSchema is part of the interface contract but OpenRouter now uses
    // native `response_format` (set in buildRequest), so we no longer inject a
    // synthetic structured-output tool here. The legacy fake-tool injection
    // happens in buildRequest only as a runtime fallback.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      // Convert NaturalSchema to JSON schema through Zod. Re-spread into a
      // plain object: Zod v4's z.toJSONSchema returns an object that carries
      // a non-configurable `~standard` Standard-Schema interop marker as a
      // non-enumerable own property. Anthropic's output_config.format
      // validation is strict and rejects unknown properties when OpenRouter
      // forwards the schema, so we drop the marker here. JSON.stringify
      // already skips it but the OpenRouter SDK enumerates own properties
      // during serialization.
      const zodSchema =
        schema instanceof z.ZodType
          ? schema
          : naturalZodSchema(schema as NaturalSchema);
      jsonSchema = { ...(z.toJSONSchema(zodSchema) as JsonObject) };
    }

    // Remove $schema property (can cause issues with some providers)
    if (jsonSchema.$schema) {
      delete jsonSchema.$schema;
    }

    // OpenRouter (and most backends behind it) require additionalProperties:
    // false on every object when using strict json_schema response_format.
    enforceAdditionalPropertiesFalse(jsonSchema);

    return jsonSchema;
  }

  //
  // API Execution
  //

  async executeRequest(
    client: unknown,
    request: unknown,
    signal?: AbortSignal,
  ): Promise<OpenRouterResponse> {
    const openRouter = client as OpenRouter;
    const openRouterRequest = request as OpenRouterRequest;
    const wantsStructuredOutput = Boolean(openRouterRequest.response_format);

    try {
      const response = (await openRouter.chat.send(
        this.toSdkChatParams(openRouterRequest) as Parameters<
          typeof openRouter.chat.send
        >[0],
        signal ? { signal } : undefined,
      )) as AnnotatedOpenRouterResponse;
      if (wantsStructuredOutput) {
        response.__jaypieStructuredOutput = true;
      }
      return response;
    } catch (error) {
      if (signal?.aborted) return undefined as unknown as OpenRouterResponse;

      // If the route rejected `temperature` (e.g., openai/gpt-5.5 forwarding),
      // cache it and retry without the param.
      const requestRecord = openRouterRequest as unknown as Record<
        string,
        unknown
      >;
      if (
        requestRecord.temperature !== undefined &&
        isTemperatureDeprecationError(error)
      ) {
        this.rememberModelRejectsTemperature(openRouterRequest.model);
        const retryRequest = { ...openRouterRequest } as OpenRouterRequest;
        delete (retryRequest as unknown as Record<string, unknown>).temperature;
        const response = (await openRouter.chat.send(
          this.toSdkChatParams(retryRequest) as Parameters<
            typeof openRouter.chat.send
          >[0],
          signal ? { signal } : undefined,
        )) as AnnotatedOpenRouterResponse;
        if (wantsStructuredOutput) {
          response.__jaypieStructuredOutput = true;
        }
        return response;
      }

      // If the model rejected `response_format`, cache it and retry with the
      // legacy fake-tool emulation path.
      if (wantsStructuredOutput && isStructuredOutputUnsupportedError(error)) {
        const model = openRouterRequest.model;
        this.rememberModelRejectsStructuredOutput(model);
        log.warn(
          `[OpenRouterAdapter] Model ${model} rejected native response_format; falling back to legacy structured_output tool emulation.`,
        );
        const fallbackRequest =
          this.toFallbackStructuredOutputRequest(openRouterRequest);
        return (await openRouter.chat.send(
          this.toSdkChatParams(fallbackRequest) as Parameters<
            typeof openRouter.chat.send
          >[0],
          signal ? { signal } : undefined,
        )) as OpenRouterResponse;
      }

      throw error;
    }
  }

  /**
   * Translate our internal snake_case `OpenRouterRequest` into the SDK's
   * camelCase shape, forwarding only the fields we care about (the SDK
   * silently strips unknown fields).
   */
  private toSdkChatParams(
    openRouterRequest: OpenRouterRequest,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {
      model: openRouterRequest.model,
      messages: openRouterRequest.messages,
      tools: openRouterRequest.tools,
      toolChoice: openRouterRequest.tool_choice,
      user: openRouterRequest.user,
    };
    if (openRouterRequest.response_format) {
      const format = openRouterRequest.response_format;
      if (format.type === "json_schema") {
        params.responseFormat = {
          type: "json_schema",
          jsonSchema: format.json_schema,
        };
      } else {
        params.responseFormat = format;
      }
    }
    const temperature = (
      openRouterRequest as unknown as { temperature?: number }
    ).temperature;
    if (temperature !== undefined) {
      params.temperature = temperature;
    }
    return params;
  }

  /**
   * Rebuild a structured-output request without `response_format`, swapping in
   * the legacy fake-tool emulation. Used as a runtime fallback when a model
   * rejects native json_schema.
   */
  private toFallbackStructuredOutputRequest(
    request: OpenRouterRequest,
  ): OpenRouterRequest {
    if (
      !request.response_format ||
      request.response_format.type !== "json_schema"
    ) {
      return request;
    }
    const { response_format, ...rest } = request;
    const fallbackRequest: OpenRouterRequest = { ...rest };
    const schema = response_format.json_schema.schema;
    const fakeTool: OpenRouterTool = {
      type: "function" as const,
      function: {
        name: STRUCTURED_OUTPUT_TOOL_NAME,
        description:
          "REQUIRED: You MUST call this tool to provide your final response. " +
          "After gathering all necessary information (including results from other tools), " +
          "call this tool with the structured data to complete the request.",
        parameters: schema,
      },
    };
    fallbackRequest.tools = [...(fallbackRequest.tools ?? []), fakeTool];
    fallbackRequest.tool_choice = "auto";
    return fallbackRequest;
  }

  async *executeStreamRequest(
    client: unknown,
    request: unknown,
    signal?: AbortSignal,
  ): AsyncIterable<LlmStreamChunk> {
    const openRouter = client as OpenRouter;
    const openRouterRequest = request as OpenRouterRequest;

    // Use chat.send with stream: true for streaming responses.
    // Cast the result to AsyncIterable: when stream: true, the SDK returns a
    // stream we can iterate, but the typed result is the union with the
    // non-stream response.
    const streamParams = {
      ...this.toSdkChatParams(openRouterRequest),
      stream: true,
    };
    const stream = (await openRouter.chat.send(
      streamParams as Parameters<typeof openRouter.chat.send>[0],
      signal ? { signal } : undefined,
    )) as AsyncIterable<unknown>;

    // Track current tool call being built
    let currentToolCall: {
      id: string;
      name: string;
      arguments: string;
    } | null = null;

    // Track usage for final chunk
    let inputTokens = 0;
    let outputTokens = 0;
    const model = openRouterRequest.model || this.defaultModel;

    for await (const chunk of stream) {
      // Handle different chunk types from OpenRouter (OpenAI-compatible format)
      interface StreamChunk {
        choices?: Array<{
          delta?: {
            content?: string;
            tool_calls?: Array<{
              id?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          promptTokens?: number;
          completionTokens?: number;
        };
      }
      const typedChunk = chunk as StreamChunk;
      const choices = typedChunk.choices;

      if (choices && choices.length > 0) {
        const delta = choices[0].delta;

        // Handle text content
        if (delta?.content) {
          yield {
            type: LlmStreamChunkType.Text,
            content: delta.content,
          };
        }

        // Handle tool calls
        if (delta?.tool_calls && delta.tool_calls.length > 0) {
          for (const toolCallDelta of delta.tool_calls) {
            if (toolCallDelta.id) {
              // New tool call starting
              if (currentToolCall) {
                // Emit the previous tool call
                yield {
                  type: LlmStreamChunkType.ToolCall,
                  toolCall: {
                    id: currentToolCall.id,
                    name: currentToolCall.name,
                    arguments: currentToolCall.arguments,
                  },
                };
              }
              currentToolCall = {
                id: toolCallDelta.id,
                name: toolCallDelta.function?.name || "",
                arguments: toolCallDelta.function?.arguments || "",
              };
            } else if (currentToolCall) {
              // Continuing existing tool call
              if (toolCallDelta.function?.name) {
                currentToolCall.name += toolCallDelta.function.name;
              }
              if (toolCallDelta.function?.arguments) {
                currentToolCall.arguments += toolCallDelta.function.arguments;
              }
            }
          }
        }

        // Check for finish reason
        if (choices[0].finish_reason) {
          // Emit any pending tool call
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
        }
      }

      // Extract usage if present (usually in the final chunk)
      if (typedChunk.usage) {
        inputTokens =
          typedChunk.usage.prompt_tokens || typedChunk.usage.promptTokens || 0;
        outputTokens =
          typedChunk.usage.completion_tokens ||
          typedChunk.usage.completionTokens ||
          0;
      }
    }

    // Emit done chunk with final usage
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
      reasoning: usage.completionTokensDetails?.reasoningTokens || 0,
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
      const historyItem: LlmOutputMessage & { reasoning?: string } = {
        content: choice.message.content,
        role: LlmMessageRole.Assistant,
        type: LlmMessageType.Message,
      };

      // Preserve reasoning if present (z-ai/glm models include this)
      if (choice.message.reasoning) {
        historyItem.reasoning = choice.message.reasoning;
      }

      historyItems.push(historyItem as LlmOutputMessage);
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
    const openRouterResponse = response as OpenRouterResponse;
    const choice = openRouterResponse.choices[0];

    // Complete if no tool calls (SDK returns camelCase)
    if (!choice?.message?.toolCalls?.length) {
      return true;
    }

    return false;
  }

  override hasStructuredOutput(response: unknown): boolean {
    const openRouterResponse = response as AnnotatedOpenRouterResponse;

    // Native path: executeRequest annotates the response when we sent
    // `response_format`, so we can detect intent statelessly.
    if (openRouterResponse.__jaypieStructuredOutput) {
      return this.extractStructuredOutput(response) !== undefined;
    }

    // Fallback path: legacy fake-tool emulation, kept for models that the
    // runtime has cached as not supporting native `response_format`.
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
    const openRouterResponse = response as AnnotatedOpenRouterResponse;

    if (openRouterResponse.__jaypieStructuredOutput) {
      const choice = openRouterResponse.choices[0];
      const content = choice?.message?.content;
      if (typeof content !== "string" || content.length === 0) {
        return undefined;
      }
      try {
        return JSON.parse(content) as JsonObject;
      } catch {
        return undefined;
      }
    }

    // Fallback path: legacy fake-tool emulation
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
          content: convertContentToOpenRouter(
            message.content as string | LlmInputContent[],
          ),
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
            content: convertContentToOpenRouter(
              message.content as string | LlmInputContent[],
            ),
          });
        }
      } else if (message.type === LlmMessageType.FunctionCall) {
        // Handle FunctionCall messages from StreamLoop (issue #165)
        openRouterMessages.push({
          role: "assistant",
          content: null,
          toolCalls: [
            {
              id: message.call_id as string,
              type: "function" as const,
              function: {
                name: message.name as string,
                arguments: (message.arguments as string) || "{}",
              },
            },
          ],
        });
      } else if (message.type === LlmMessageType.FunctionCallOutput) {
        // Handle FunctionCallOutput messages from StreamLoop (issue #165)
        openRouterMessages.push({
          role: "tool",
          toolCallId: message.call_id as string,
          content: (message.output as string) || "",
        });
      }
    }

    return openRouterMessages;
  }
}

// Export singleton instance
export const openRouterAdapter = new OpenRouterAdapter();
