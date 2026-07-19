import { log } from "@jaypie/logger";
import { JsonObject, NaturalSchema } from "@jaypie/types";
import { z } from "zod/v4";

import { PROVIDER } from "../../constants.js";
import { paperedEffortMessage, toFireworksEffort } from "../../util/effort.js";
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
import { isJsonSchema, naturalZodSchema } from "../../util/index.js";
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
import { classifyProviderError } from "../../util/classifyProviderError.js";
import { FireworksClient } from "../../providers/fireworks/client.js";
import { BaseProviderAdapter } from "./ProviderAdapter.interface.js";

//
//
// Types
//

interface FireworksMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | FireworksContentPart[] | null;
  toolCalls?: FireworksToolCall[];
  toolCallId?: string;
}

interface FireworksToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface FireworksResponseMessage {
  role: "assistant";
  content?: string | null;
  toolCalls?: FireworksToolCall[];
  refusal?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
}

interface FireworksChoice {
  index: number;
  message: FireworksResponseMessage;
  finishReason: string | null;
  finish_reason?: string | null;
}

interface FireworksUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  completionTokensDetails?: {
    reasoningTokens?: number;
  };
}

interface FireworksResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: FireworksChoice[];
  usage?: FireworksUsage;
}

interface FireworksTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonObject;
  };
}

interface FireworksJsonSchemaConfig {
  name: string;
  description?: string;
  schema: JsonObject;
  strict?: boolean;
}

type FireworksResponseFormat =
  | { type: "json_schema"; json_schema: FireworksJsonSchemaConfig }
  | { type: "json_object" }
  | { type: "text" };

interface FireworksRequest {
  model: string;
  messages: FireworksMessage[];
  tools?: FireworksTool[];
  tool_choice?: "auto" | "none" | "required";
  response_format?: FireworksResponseFormat;
  reasoning_effort?: string;
  user?: string;
}

/**
 * Fireworks responses we annotate at receive time so downstream stateless
 * methods (`hasStructuredOutput`, `extractStructuredOutput`) can tell whether
 * the request asked for native structured output without re-threading the
 * request.
 */
type AnnotatedFireworksResponse = FireworksResponse & {
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
 * `response_format: json_schema`. We only trigger the fake-tool fallback when
 * the failure is plausibly a capability gap, not a generic 400.
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
    /response_format|json[_ ]schema|structured[_ ]output/i.test(m),
  );
}

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
 * Fireworks content part types. Fireworks follows the OpenAI Chat Completions
 * multimodal schema for `image_url` parts (URL or base64 data URI). There is
 * no OpenAI-style `file` part, and the API rejects `data:` URIs for documents
 * ("Unsupported URL scheme 'data'"), so file inputs cannot be delivered.
 */
type FireworksContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; imageUrl: { url: string } };

/**
 * Convert standardized content items to Fireworks format. Images become
 * `image_url` parts (vision models only; non-vision models 4xx — a
 * model-capability mismatch surfaced by the call). File inputs are warned
 * and discarded: Fireworks has no `file` part and rejects document `data:`
 * URIs outright, so there is no wire shape that can carry them.
 */
function convertContentToFireworks(
  content: string | LlmInputContent[],
): string | FireworksContentPart[] {
  if (typeof content === "string") {
    return content;
  }

  const parts: FireworksContentPart[] = [];

  for (const item of content) {
    if (item.type === LlmMessageType.InputText) {
      parts.push({ type: "text", text: item.text });
      continue;
    }

    if (item.type === LlmMessageType.InputImage) {
      const url = item.image_url ?? "";
      if (!url) {
        log.warn("Fireworks image content missing image_url; image discarded");
        continue;
      }
      parts.push({ type: "image_url", imageUrl: { url } });
      continue;
    }

    if (item.type === LlmMessageType.InputFile) {
      log.warn(
        { filename: item.filename },
        "Fireworks does not support file inputs (no file part; document data: URIs rejected); file discarded",
      );
      continue;
    }

    // Unknown type - warn and skip
    log.warn({ item }, "Unknown content type for Fireworks; discarded");
  }

  // If no parts remain, return empty string to avoid empty array
  if (parts.length === 0) {
    return "";
  }

  return parts;
}

/**
 * Convert internal content parts to the OpenAI-compatible wire shape. The
 * internal representation uses camelCase keys (`imageUrl`); the REST API wants
 * snake_case (`image_url`).
 */
function contentToWire(
  content: string | FireworksContentPart[] | null | undefined,
): unknown {
  if (
    content === null ||
    content === undefined ||
    typeof content === "string"
  ) {
    return content;
  }
  return content.map((part) => {
    if (part.type === "image_url") {
      return { type: "image_url", image_url: part.imageUrl };
    }
    return part;
  });
}

/**
 * Serialize an internal message to the OpenAI-compatible wire shape, mapping
 * camelCase tool fields (`toolCalls`, `toolCallId`) to snake_case. Tool-call
 * objects are already wire-shaped (`{ id, type, function: { name, arguments } }`).
 */
function messageToWire(message: FireworksMessage): Record<string, unknown> {
  const wire: Record<string, unknown> = { role: message.role };
  if (message.content !== undefined) {
    wire.content = contentToWire(message.content);
  }
  if (message.toolCalls) {
    wire.tool_calls = message.toolCalls;
  }
  if (message.toolCallId) {
    wire.tool_call_id = message.toolCallId;
  }
  return wire;
}

// Fireworks error types based on HTTP status codes
const RETRYABLE_STATUS_CODES = [408, 500, 502, 503, 524, 529];
const RATE_LIMIT_STATUS_CODE = 429;

/**
 * Walk the JSON schema and force `additionalProperties: false` on every
 * object node. Required by the OpenAI-style json_schema response_format when
 * `strict: true`.
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
 * FireworksAdapter implements the ProviderAdapter interface for Fireworks AI's
 * OpenAI-compatible Chat Completions API. It handles request building,
 * response parsing, and error classification specific to Fireworks.
 */
export class FireworksAdapter extends BaseProviderAdapter {
  readonly name = PROVIDER.FIREWORKS.NAME;
  readonly defaultModel = PROVIDER.FIREWORKS.DEFAULT;

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

  // Session-level cache of models observed to reject `temperature`. Populated
  // by executeRequest on 400 errors so repeat calls skip the param.
  private runtimeNoTemperatureModels = new Set<string>();

  rememberModelRejectsTemperature(model: string): void {
    this.runtimeNoTemperatureModels.add(model);
  }

  clearRuntimeNoTemperatureModels(): void {
    this.runtimeNoTemperatureModels.clear();
  }

  private supportsTemperature(model: string): boolean {
    return !this.runtimeNoTemperatureModels.has(model);
  }

  //
  // Request Building
  //

  buildRequest(request: OperateRequest): FireworksRequest {
    // Convert messages to Fireworks format (OpenAI-compatible)
    const messages: FireworksMessage[] = this.convertMessagesToFireworks(
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

    const fireworksRequest: FireworksRequest = {
      model: request.model || this.defaultModel,
      messages,
    };

    if (request.user) {
      fireworksRequest.user = request.user;
    }

    const useFallbackStructuredOutput =
      Boolean(request.format) &&
      !this.supportsStructuredOutput(fireworksRequest.model);

    const allTools: ProviderToolDefinition[] = request.tools
      ? [...request.tools]
      : [];
    if (useFallbackStructuredOutput && request.format) {
      log.warn(
        `[FireworksAdapter] Using legacy structured_output tool fallback for model ${fireworksRequest.model}; native response_format previously rejected for this model.`,
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
      fireworksRequest.tools = allTools.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));

      // Use "auto" for tool_choice - not all Fireworks models support "required"
      // The structured_output tool prompt already emphasizes it must be called
      fireworksRequest.tool_choice = "auto";
    }

    // Native structured output: send schema as `response_format`. The legacy
    // tool-emulation path is engaged only as a runtime fallback for models the
    // API has flagged as not supporting native json_schema.
    if (request.format && !useFallbackStructuredOutput) {
      fireworksRequest.response_format = {
        type: "json_schema",
        json_schema: {
          name: STRUCTURED_OUTPUT_SCHEMA_NAME,
          schema: request.format,
          strict: true,
        },
      };
    }

    if (request.providerOptions) {
      Object.assign(fireworksRequest, request.providerOptions);
    }

    // Normalized reasoning effort -> reasoning_effort. Fireworks accepts the
    // param on every model and no-ops where unsupported, so no per-model
    // gating. First-class effort wins over providerOptions.
    if (request.effort) {
      const mapping = toFireworksEffort(request.effort);
      if (mapping.papered) {
        log.debug(
          paperedEffortMessage({
            model: fireworksRequest.model,
            provider: this.name,
            requested: request.effort,
            value: mapping.value,
          }),
        );
      }
      fireworksRequest.reasoning_effort = mapping.value as string;
    }

    // First-class temperature takes precedence over providerOptions
    if (request.temperature !== undefined) {
      (fireworksRequest as unknown as Record<string, unknown>).temperature =
        request.temperature;
    }

    // Strip temperature for models the runtime has cached as rejecting it
    const requestRecord = fireworksRequest as unknown as Record<
      string,
      unknown
    >;
    if (
      requestRecord.temperature !== undefined &&
      !this.supportsTemperature(fireworksRequest.model)
    ) {
      delete requestRecord.temperature;
    }

    return fireworksRequest;
  }

  formatTools(
    toolkit: Toolkit,
    // outputSchema is part of the interface contract but Fireworks uses native
    // `response_format` (set in buildRequest); the legacy fake-tool injection
    // happens in buildRequest only as a runtime fallback.

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

    // Check if schema is already a JsonObject — either the OpenAI-style
    // `{ type: "json_schema", ... }` envelope or a bare `{ type: "object", properties }` node
    if (
      (typeof schema === "object" &&
        schema !== null &&
        !Array.isArray(schema) &&
        (schema as JsonObject).type === "json_schema") ||
      isJsonSchema(schema)
    ) {
      jsonSchema = structuredClone(schema) as JsonObject;
      jsonSchema.type = "object"; // Normalize type
    } else {
      // Convert NaturalSchema to JSON schema through Zod. Re-spread into a
      // plain object to drop Zod v4's non-enumerable `~standard` marker.
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

    // Strict json_schema response_format requires additionalProperties: false
    // on every object.
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
  ): Promise<FireworksResponse> {
    const fireworks = client as FireworksClient;
    const fireworksRequest = request as FireworksRequest;
    const wantsStructuredOutput = Boolean(fireworksRequest.response_format);

    try {
      const response = (await fireworks.chatCompletion(
        this.toWireBody(fireworksRequest),
        signal ? { signal } : undefined,
      )) as unknown as AnnotatedFireworksResponse;
      if (wantsStructuredOutput) {
        response.__jaypieStructuredOutput = true;
      }
      return response;
    } catch (error) {
      if (signal?.aborted) return undefined as unknown as FireworksResponse;

      // If the model rejected `temperature`, cache it and retry without the param.
      const requestRecord = fireworksRequest as unknown as Record<
        string,
        unknown
      >;
      if (
        requestRecord.temperature !== undefined &&
        isTemperatureDeprecationError(error)
      ) {
        this.rememberModelRejectsTemperature(fireworksRequest.model);
        const retryRequest = { ...fireworksRequest } as FireworksRequest;
        delete (retryRequest as unknown as Record<string, unknown>).temperature;
        const response = (await fireworks.chatCompletion(
          this.toWireBody(retryRequest),
          signal ? { signal } : undefined,
        )) as unknown as AnnotatedFireworksResponse;
        if (wantsStructuredOutput) {
          response.__jaypieStructuredOutput = true;
        }
        return response;
      }

      // If the model rejected `response_format`, cache it and retry with the
      // legacy fake-tool emulation path.
      if (wantsStructuredOutput && isStructuredOutputUnsupportedError(error)) {
        const model = fireworksRequest.model;
        this.rememberModelRejectsStructuredOutput(model);
        log.warn(
          `[FireworksAdapter] Model ${model} rejected native response_format; falling back to legacy structured_output tool emulation.`,
        );
        const fallbackRequest =
          this.toFallbackStructuredOutputRequest(fireworksRequest);
        return (await fireworks.chatCompletion(
          this.toWireBody(fallbackRequest),
          signal ? { signal } : undefined,
        )) as unknown as FireworksResponse;
      }

      throw error;
    }
  }

  /**
   * Serialize the internal request into the OpenAI-compatible wire body for
   * Fireworks' Chat Completions endpoint. Top-level fields (model, tools,
   * tool_choice, response_format, reasoning_effort, user, temperature, and any
   * providerOptions) are already wire-shaped (snake_case); only messages carry
   * camelCase tool fields that must become snake_case on the wire.
   */
  private toWireBody(
    fireworksRequest: FireworksRequest,
  ): Record<string, unknown> {
    return {
      ...fireworksRequest,
      messages: fireworksRequest.messages.map(messageToWire),
    };
  }

  /**
   * Rebuild a structured-output request without `response_format`, swapping in
   * the legacy fake-tool emulation. Used as a runtime fallback when a model
   * rejects native json_schema.
   */
  private toFallbackStructuredOutputRequest(
    request: FireworksRequest,
  ): FireworksRequest {
    if (
      !request.response_format ||
      request.response_format.type !== "json_schema"
    ) {
      return request;
    }
    const { response_format, ...rest } = request;
    const fallbackRequest: FireworksRequest = { ...rest };
    const schema = response_format.json_schema.schema;
    const fakeTool: FireworksTool = {
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
    const fireworks = client as FireworksClient;
    const fireworksRequest = request as FireworksRequest;

    // streamChatCompletion adds `stream: true` + `stream_options.include_usage`
    // and yields decoded SSE chunks in OpenAI-compatible (snake_case) shape.
    const stream = fireworks.streamChatCompletion(
      this.toWireBody(fireworksRequest),
      signal ? { signal } : undefined,
    ) as AsyncIterable<unknown>;

    // Track current tool call being built
    let currentToolCall: {
      id: string;
      name: string;
      arguments: string;
    } | null = null;

    // Track usage for final chunk
    let inputTokens = 0;
    let outputTokens = 0;
    const model = fireworksRequest.model || this.defaultModel;

    for await (const chunk of stream) {
      // Handle different chunk types from Fireworks (OpenAI-compatible format)
      interface StreamChunk {
        choices?: Array<{
          delta?: {
            content?: string;
            // Reasoning deltas arrive on reasoning_content; kept out of the
            // text stream so `content` remains the final answer only.
            reasoning_content?: string;
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
    const fireworksResponse = response as FireworksResponse;
    const choice = fireworksResponse.choices[0];

    const content = this.extractContent(fireworksResponse);
    const hasToolCalls = this.hasToolCalls(fireworksResponse);

    const stopReason =
      choice?.finishReason ?? choice?.finish_reason ?? undefined;

    return {
      content,
      hasToolCalls,
      stopReason,
      usage: this.extractUsage(fireworksResponse, fireworksResponse.model),
      raw: fireworksResponse,
    };
  }

  extractToolCalls(response: unknown): StandardToolCall[] {
    const fireworksResponse = response as FireworksResponse;
    const toolCalls: StandardToolCall[] = [];
    const choice = fireworksResponse.choices[0];

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
    const fireworksResponse = response as FireworksResponse;

    if (!fireworksResponse.usage) {
      return {
        input: 0,
        output: 0,
        reasoning: 0,
        total: 0,
        provider: this.name,
        model,
      };
    }

    const usage = fireworksResponse.usage;
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
  ): FireworksMessage {
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
  ): FireworksRequest {
    const fireworksRequest = request as FireworksRequest;
    const toolCallRaw = toolCall.raw as FireworksToolCall;

    // Add assistant message with the tool call
    fireworksRequest.messages.push({
      role: "assistant",
      content: null,
      toolCalls: [toolCallRaw],
    });

    // Add tool result message
    fireworksRequest.messages.push(this.formatToolResult(toolCall, result));

    return fireworksRequest;
  }

  //
  // History Management
  //

  responseToHistoryItems(response: unknown): LlmHistory {
    const fireworksResponse = response as FireworksResponse;
    const historyItems: LlmHistory = [];
    const choice = fireworksResponse.choices[0];

    if (!choice?.message) {
      return historyItems;
    }

    // Check if this is a tool use response
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

      // Preserve reasoning if present. Fireworks reasoning models return it in
      // reasoning_content; some routes use reasoning.
      const reasoning =
        choice.message.reasoning_content ?? choice.message.reasoning;
      if (reasoning) {
        historyItem.reasoning = reasoning;
      }

      historyItems.push(historyItem as LlmOutputMessage);
    }

    return historyItems;
  }

  //
  // Error Classification
  //

  classifyError(error: unknown): ClassifiedError {
    // Shared first pass: retryable structured-output timeouts (#422),
    // quota exhaustion, and billing failures classify the same across providers.
    const shared = classifyProviderError(error);
    if (shared) return shared;

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
    const fireworksResponse = response as FireworksResponse;
    const choice = fireworksResponse.choices[0];

    // Complete if no tool calls
    if (!choice?.message?.toolCalls?.length) {
      return true;
    }

    return false;
  }

  override hasStructuredOutput(response: unknown): boolean {
    const fireworksResponse = response as AnnotatedFireworksResponse;

    // Native path: executeRequest annotates the response when we sent
    // `response_format`, so we can detect intent statelessly.
    if (fireworksResponse.__jaypieStructuredOutput) {
      return this.extractStructuredOutput(response) !== undefined;
    }

    // Fallback path: legacy fake-tool emulation, kept for models that the
    // runtime has cached as not supporting native `response_format`.
    const choice = fireworksResponse.choices[0];

    if (!choice?.message?.toolCalls?.length) {
      return false;
    }

    // Check if the last tool call is structured_output
    const lastToolCall =
      choice.message.toolCalls[choice.message.toolCalls.length - 1];
    return lastToolCall?.function?.name === STRUCTURED_OUTPUT_TOOL_NAME;
  }

  override extractStructuredOutput(response: unknown): JsonObject | undefined {
    const fireworksResponse = response as AnnotatedFireworksResponse;

    if (fireworksResponse.__jaypieStructuredOutput) {
      const choice = fireworksResponse.choices[0];
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
    const choice = fireworksResponse.choices[0];

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

  private hasToolCalls(response: FireworksResponse): boolean {
    const choice = response.choices[0];
    return (choice?.message?.toolCalls?.length ?? 0) > 0;
  }

  private extractContent(
    response: FireworksResponse,
  ): string | JsonObject | undefined {
    // Check for structured output first
    if (this.hasStructuredOutput(response)) {
      return this.extractStructuredOutput(response);
    }

    const choice = response.choices[0];
    return choice?.message?.content ?? undefined;
  }

  private convertMessagesToFireworks(
    messages: LlmHistory,
    system?: string,
  ): FireworksMessage[] {
    const fireworksMessages: FireworksMessage[] = [];

    // Add system message if provided
    if (system) {
      fireworksMessages.push({
        role: "system",
        content: system,
      });
    }

    for (const msg of messages) {
      const message = msg as unknown as Record<string, unknown>;

      // Handle different message types
      if (message.role === "system") {
        fireworksMessages.push({
          role: "system",
          content: message.content as string,
        });
      } else if (message.role === "user") {
        fireworksMessages.push({
          role: "user",
          content: convertContentToFireworks(
            message.content as string | LlmInputContent[],
          ),
        });
      } else if (message.role === "assistant") {
        const assistantMsg: FireworksMessage = {
          role: "assistant",
          content: (message.content as string) || null,
        };

        // Include toolCalls if present (check both camelCase and snake_case for compatibility)
        if (message.toolCalls) {
          assistantMsg.toolCalls = message.toolCalls as FireworksToolCall[];
        } else if (message.tool_calls) {
          assistantMsg.toolCalls = message.tool_calls as FireworksToolCall[];
        }

        fireworksMessages.push(assistantMsg);
      } else if (message.role === "tool") {
        fireworksMessages.push({
          role: "tool",
          toolCallId:
            (message.toolCallId as string) || (message.tool_call_id as string),
          content: message.content as string,
        });
      } else if (message.type === LlmMessageType.Message) {
        // Handle internal message format
        const role = (message.role as string)?.toLowerCase();
        if (role === "assistant") {
          fireworksMessages.push({
            role: "assistant",
            content: message.content as string,
          });
        } else {
          fireworksMessages.push({
            role: "user",
            content: convertContentToFireworks(
              message.content as string | LlmInputContent[],
            ),
          });
        }
      } else if (message.type === LlmMessageType.FunctionCall) {
        fireworksMessages.push({
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
        fireworksMessages.push({
          role: "tool",
          toolCallId: message.call_id as string,
          content: (message.output as string) || "",
        });
      }
    }

    return fireworksMessages;
  }
}

// Export singleton instance
export const fireworksAdapter = new FireworksAdapter();
