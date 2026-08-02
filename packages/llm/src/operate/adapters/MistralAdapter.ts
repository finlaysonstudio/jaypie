import { log } from "@jaypie/logger";
import { JsonObject, NaturalSchema } from "@jaypie/types";
import { z } from "zod/v4";

import { PROVIDER } from "../../constants.js";
import { promptCacheKey, resolveCache } from "../../util/cacheControl.js";
import { paperedEffortMessage, toMistralEffort } from "../../util/effort.js";
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
import { MistralClient } from "../../providers/mistral/client.js";
import { BaseProviderAdapter } from "./ProviderAdapter.interface.js";

//
//
// Types
//

interface MistralMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | MistralContentPart[] | null;
  toolCalls?: MistralToolCall[];
  toolCallId?: string;
}

interface MistralToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * A `thinking` chunk as returned when `reasoning_effort` is anything other
 * than `"none"`. The nested `thinking` array carries the reasoning text; the
 * `closed` flag marks a completed block (Mistral's replay marker).
 */
interface MistralThinkingChunk {
  type: "thinking";
  thinking: Array<{ type: string; text?: string }>;
  closed?: boolean;
}

type MistralResponseContentPart =
  { type: "text"; text: string } | MistralThinkingChunk;

interface MistralResponseMessage {
  role: "assistant";
  /**
   * A plain string when reasoning is off, or an array of chunks when
   * `reasoning_effort` is set — see `extractParts`.
   */
  content?: string | MistralResponseContentPart[] | null;
  toolCalls?: MistralToolCall[];
  refusal?: string | null;
}

interface MistralChoice {
  index: number;
  message: MistralResponseMessage;
  finishReason: string | null;
  finish_reason?: string | null;
}

interface MistralUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  promptTokensDetails?: {
    cachedTokens?: number;
  };
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
}

interface MistralResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: MistralChoice[];
  usage?: MistralUsage;
}

interface MistralTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonObject;
  };
}

interface MistralJsonSchemaConfig {
  name: string;
  description?: string;
  schema: JsonObject;
  strict?: boolean;
}

type MistralResponseFormat =
  | { type: "json_schema"; json_schema: MistralJsonSchemaConfig }
  | { type: "json_object" }
  | { type: "text" };

/**
 * Mistral validates the request body strictly — any field outside its schema
 * is rejected with a 422 `extra_forbidden`. Notably there is **no `user`
 * field** (and `seed` is `random_seed`), so this type deliberately omits the
 * OpenAI-isms that sibling adapters forward.
 */
interface MistralRequest {
  model: string;
  messages: MistralMessage[];
  tools?: MistralTool[];
  tool_choice?: "auto" | "none" | "required" | "any";
  response_format?: MistralResponseFormat;
  reasoning_effort?: string;
  prompt_cache_key?: string;
}

/**
 * Mistral responses we annotate at receive time so downstream stateless
 * methods (`hasStructuredOutput`, `extractStructuredOutput`) can tell whether
 * the request asked for native structured output without re-threading the
 * request.
 */
type AnnotatedMistralResponse = MistralResponse & {
  __jaypieStructuredOutput?: boolean;
};

//
//
// Constants
//

const STRUCTURED_OUTPUT_TOOL_NAME = "structured_output";

const STRUCTURED_OUTPUT_SCHEMA_NAME = "response";

// Mistral error types and codes, as observed on the wire. These do not match
// the published error glossary, which names the rate-limit type
// "rate_limit_error"; the API sends "rate_limited".
const RATE_LIMIT_STATUS_CODE = 429;
const RATE_LIMIT_TYPE = "rate_limited";
const RETRYABLE_STATUS_CODES = [408, 500, 502, 503, 524, 529];
/** Model-level argument rejection, e.g. an unsupported `reasoning_effort`. */
const INVALID_ARGS_CODE = "3051";
/** Schema validation: unknown field, bad enum. Never succeeds on retry. */
const SCHEMA_VALIDATION_STATUS_CODE = 422;

/**
 * Models known to accept `reasoning_effort`. Verified live 2026-08-01: Medium
 * 3.5 and Small 4 accept `none` and `high` only, while Large 3 rejects the
 * field outright ("reasoning_effort is not enabled for this model"). Anything
 * unmatched omits the field, honoring the contract that `effort` is safe to
 * set regardless of which model serves the call.
 */
const REASONING_EFFORT_MODELS = /^mistral-(medium|small)/i;

/**
 * Detect 4xx errors that indicate the model itself does not support
 * `response_format: json_schema`. Only trigger the fake-tool fallback when the
 * failure is plausibly a capability gap, not a generic 400.
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
    /response[_ ]format|json[_ ]schema|structured[_ ]output/i.test(m),
  );
}

/**
 * Detect a model-level rejection of `reasoning_effort`. Mistral answers 400
 * with code 3051 both when the model disables reasoning entirely and when the
 * requested level is outside the model's supported set.
 */
function isReasoningEffortUnsupportedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    status?: number;
    statusCode?: number;
    code?: string;
    message?: string;
    error?: { message?: string };
  };
  const status = err.status ?? err.statusCode;
  if (status !== 400 && status !== 422) return false;
  const messages = [err.message, err.error?.message].filter(
    (m): m is string => typeof m === "string",
  );
  return messages.some((m) => /reasoning_effort/i.test(m));
}

/**
 * Mistral content part types. Images follow the OpenAI Chat Completions
 * `image_url` schema (URL or base64 data URI). Documents use Mistral's own
 * `document_url` part, which accepts a `data:application/pdf;base64,...` URI
 * directly — so unlike the other OpenAI-compatible providers, file inputs
 * survive rather than being discarded.
 */
type MistralContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; imageUrl: { url: string } }
  | { type: "document_url"; documentUrl: string; documentName?: string };

/**
 * Convert standardized content items to Mistral format. Images become
 * `image_url` parts; files become `document_url` parts carrying the base64
 * data URI that `resolveOperateInput` already produced.
 */
function convertContentToMistral(
  content: string | LlmInputContent[],
): string | MistralContentPart[] {
  if (typeof content === "string") {
    return content;
  }

  const parts: MistralContentPart[] = [];

  for (const item of content) {
    if (item.type === LlmMessageType.InputText) {
      parts.push({ type: "text", text: item.text });
      continue;
    }

    if (item.type === LlmMessageType.InputImage) {
      const url = item.image_url ?? "";
      if (!url) {
        log.warn("Mistral image content missing image_url; image discarded");
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
          "Mistral file content missing file_data; file discarded",
        );
        continue;
      }
      parts.push({
        type: "document_url",
        documentUrl: fileData,
        ...(item.filename ? { documentName: item.filename } : {}),
      });
      continue;
    }

    // Unknown type - warn and skip
    log.warn({ item }, "Unknown content type for Mistral; discarded");
  }

  // If no parts remain, return empty string to avoid empty array
  if (parts.length === 0) {
    return "";
  }

  return parts;
}

/**
 * Convert internal content parts to the OpenAI-compatible wire shape. The
 * internal representation uses camelCase keys (`imageUrl`, `documentUrl`); the
 * REST API wants snake_case.
 */
function contentToWire(
  content: string | MistralContentPart[] | null | undefined,
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
    if (part.type === "document_url") {
      return {
        type: "document_url",
        document_url: part.documentUrl,
        ...(part.documentName ? { document_name: part.documentName } : {}),
      };
    }
    return part;
  });
}

/**
 * Serialize an internal message to the OpenAI-compatible wire shape, mapping
 * camelCase tool fields (`toolCalls`, `toolCallId`) to snake_case. Tool-call
 * objects are already wire-shaped.
 */
function messageToWire(message: MistralMessage): Record<string, unknown> {
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

/**
 * Split a response message's `content` into answer text and reasoning text.
 *
 * With `reasoning_effort` unset or `"none"`, `content` is a plain string.
 * Otherwise it is an array of chunks — a `thinking` chunk carrying the
 * reasoning, then a `text` chunk carrying the answer:
 *
 *   [ { type: "thinking", thinking: [{ type: "text", text: "..." }], closed: true },
 *     { type: "text", text: "391" } ]
 */
function extractParts(content: MistralResponseMessage["content"]): {
  reasoning?: string;
  text?: string;
} {
  if (content === null || content === undefined) return {};
  if (typeof content === "string") return { text: content };

  const textParts: string[] = [];
  const reasoningParts: string[] = [];

  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    if (part.type === "text" && typeof part.text === "string") {
      textParts.push(part.text);
      continue;
    }
    if (part.type === "thinking" && Array.isArray(part.thinking)) {
      for (const inner of part.thinking) {
        if (typeof inner?.text === "string") reasoningParts.push(inner.text);
      }
    }
  }

  return {
    ...(reasoningParts.length > 0
      ? { reasoning: reasoningParts.join("") }
      : {}),
    ...(textParts.length > 0 ? { text: textParts.join("") } : {}),
  };
}

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
 * MistralAdapter implements the ProviderAdapter interface for Mistral's
 * OpenAI-compatible Chat Completions API (`https://api.mistral.ai/v1`).
 *
 * Two behaviors set Mistral apart from its OpenAI-compatible siblings:
 *
 * 1. **Strict request validation.** Unknown top-level fields are rejected with
 *    a 422 `extra_forbidden`, so this adapter never sends `user` and callers
 *    must keep `providerOptions` within Mistral's own schema.
 * 2. **Array-shaped reasoning content.** With `reasoning_effort` engaged, the
 *    assistant message's `content` is an array of `thinking` and `text`
 *    chunks rather than a string.
 */
export class MistralAdapter extends BaseProviderAdapter {
  readonly name = PROVIDER.MISTRAL.NAME;
  readonly defaultModel = PROVIDER.MISTRAL.DEFAULT;

  // Native `response_format` + `tools` works on every current Mistral model
  // (verified live), so emulation is a runtime fallback rather than the
  // default path. Opt in to OperateLoop's corrective turn anyway, so a model
  // that answers a format request in prose is re-asked rather than leaking a
  // string to the caller.
  override readonly supportsStructuredOutputRetry = true;

  // Session-level cache of models observed to reject native
  // `response_format: json_schema`.
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

  // Session-level cache of models observed to reject `reasoning_effort`.
  // Populated by executeRequest so repeat calls skip the param rather than
  // failing again when Mistral rotates which models reason.
  private runtimeNoReasoningEffortModels = new Set<string>();

  rememberModelRejectsReasoningEffort(model: string): void {
    this.runtimeNoReasoningEffortModels.add(model);
  }

  clearRuntimeNoReasoningEffortModels(): void {
    this.runtimeNoReasoningEffortModels.clear();
  }

  protected supportsReasoningEffort(model: string): boolean {
    if (this.runtimeNoReasoningEffortModels.has(model)) return false;
    return REASONING_EFFORT_MODELS.test(model);
  }

  //
  // Request Building
  //

  buildRequest(request: OperateRequest): MistralRequest {
    // Convert messages to Mistral format (OpenAI-compatible)
    const messages: MistralMessage[] = this.convertMessagesToMistral(
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

    const mistralRequest: MistralRequest = {
      model: request.model || this.defaultModel,
      messages,
    };

    // NOTE: `request.user` is deliberately not forwarded. Mistral has no
    // `user` field and rejects it with a 422 `extra_forbidden`.

    // Mistral accepts response_format alongside tools, so the fake-tool
    // emulation engages only for models the runtime has flagged.
    const useFallbackStructuredOutput =
      Boolean(request.format) &&
      !this.supportsStructuredOutput(mistralRequest.model);

    // On a corrective retry turn (the model answered a format request with
    // prose), offer only the structured_output tool so the demanded call is
    // the sole option.
    const allTools: ProviderToolDefinition[] =
      request.tools && !request.structuredOutputRetry ? [...request.tools] : [];
    if (useFallbackStructuredOutput && request.format) {
      log.warn(
        `[MistralAdapter] Using structured_output tool fallback for model ${mistralRequest.model}; native response_format previously rejected for this model.`,
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
      mistralRequest.tools = allTools.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      mistralRequest.tool_choice = "auto";
    }

    // Native structured output: send schema as `response_format`.
    if (request.format && !useFallbackStructuredOutput) {
      mistralRequest.response_format = {
        type: "json_schema",
        json_schema: {
          name: STRUCTURED_OUTPUT_SCHEMA_NAME,
          schema: request.format,
          strict: true,
        },
      };
    }

    // Mistral prompt caching is prefix-based; a stable prompt_cache_key routes
    // repeat traffic to the same cache. Keyed on the stable prefix only
    // (model + system + instructions + tools), never the volatile user turn.
    if (resolveCache(request.cache).enabled) {
      mistralRequest.prompt_cache_key = promptCacheKey(
        JSON.stringify([
          mistralRequest.model,
          request.system ?? "",
          request.instructions ?? "",
          request.tools ?? [],
        ]),
      );
    }

    // Caller passthrough. Mistral rejects unknown fields with a 422, so this
    // is not the free-form escape hatch it is on other providers — values must
    // belong to Mistral's own request schema (e.g. `random_seed`, not `seed`).
    if (request.providerOptions) {
      Object.assign(mistralRequest, request.providerOptions);
    }

    // Normalized reasoning effort -> reasoning_effort, gated by model.
    // First-class effort wins over providerOptions.
    if (request.effort && this.supportsReasoningEffort(mistralRequest.model)) {
      const mapping = toMistralEffort(request.effort);
      if (mapping.papered) {
        log.debug(
          paperedEffortMessage({
            model: mistralRequest.model,
            provider: this.name,
            requested: request.effort,
            value: mapping.value,
          }),
        );
      }
      mistralRequest.reasoning_effort = mapping.value as string;
    }

    // First-class temperature takes precedence over providerOptions
    if (request.temperature !== undefined) {
      (mistralRequest as unknown as Record<string, unknown>).temperature =
        request.temperature;
    }

    return mistralRequest;
  }

  formatTools(
    toolkit: Toolkit,
    // outputSchema is part of the interface contract but Mistral uses native
    // `response_format` (set in buildRequest); the fake-tool injection happens
    // in buildRequest only as a runtime fallback.

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
    // `{ type: "json_schema", ... }` envelope or a bare
    // `{ type: "object", properties }` node
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
  ): Promise<MistralResponse> {
    const mistral = client as MistralClient;
    const mistralRequest = request as MistralRequest;
    const wantsStructuredOutput = Boolean(mistralRequest.response_format);

    try {
      const response = (await mistral.chatCompletion(
        this.toWireBody(mistralRequest),
        signal ? { signal } : undefined,
      )) as unknown as AnnotatedMistralResponse;
      if (wantsStructuredOutput) {
        response.__jaypieStructuredOutput = true;
      }
      return response;
    } catch (error) {
      if (signal?.aborted) return undefined as unknown as MistralResponse;

      // If the model rejected `reasoning_effort`, cache it and retry without
      // the param. Mistral rotates which models reason, so a hard failure here
      // would break callers who set a provider-neutral `effort`.
      if (
        mistralRequest.reasoning_effort !== undefined &&
        isReasoningEffortUnsupportedError(error)
      ) {
        this.rememberModelRejectsReasoningEffort(mistralRequest.model);
        log.warn(
          `[MistralAdapter] Model ${mistralRequest.model} rejected reasoning_effort; retrying without it.`,
        );
        const retryRequest = { ...mistralRequest } as MistralRequest;
        delete retryRequest.reasoning_effort;
        const response = (await mistral.chatCompletion(
          this.toWireBody(retryRequest),
          signal ? { signal } : undefined,
        )) as unknown as AnnotatedMistralResponse;
        if (wantsStructuredOutput) {
          response.__jaypieStructuredOutput = true;
        }
        return response;
      }

      // If the model rejected `response_format`, cache it and retry with the
      // fake-tool emulation path.
      if (wantsStructuredOutput && isStructuredOutputUnsupportedError(error)) {
        const model = mistralRequest.model;
        this.rememberModelRejectsStructuredOutput(model);
        log.warn(
          `[MistralAdapter] Model ${model} rejected native response_format; falling back to structured_output tool emulation.`,
        );
        const fallbackRequest =
          this.toFallbackStructuredOutputRequest(mistralRequest);
        return (await mistral.chatCompletion(
          this.toWireBody(fallbackRequest),
          signal ? { signal } : undefined,
        )) as unknown as MistralResponse;
      }

      throw error;
    }
  }

  /**
   * Serialize the internal request into the wire body. Top-level fields are
   * already wire-shaped (snake_case); only messages carry camelCase content
   * and tool fields that must become snake_case on the wire.
   */
  private toWireBody(mistralRequest: MistralRequest): Record<string, unknown> {
    return {
      ...mistralRequest,
      messages: mistralRequest.messages.map(messageToWire),
    };
  }

  /**
   * Rebuild a structured-output request without `response_format`, swapping in
   * the fake-tool emulation. Used as a runtime fallback when a model rejects
   * native json_schema.
   */
  private toFallbackStructuredOutputRequest(
    request: MistralRequest,
  ): MistralRequest {
    if (
      !request.response_format ||
      request.response_format.type !== "json_schema"
    ) {
      return request;
    }
    const { response_format, ...rest } = request;
    const fallbackRequest: MistralRequest = { ...rest };
    const schema = response_format.json_schema.schema;
    const fakeTool: MistralTool = {
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
    const mistral = client as MistralClient;
    const mistralRequest = request as MistralRequest;

    // streamChatCompletion adds `stream: true` + `stream_options.include_usage`
    // and yields decoded SSE chunks in OpenAI-compatible (snake_case) shape.
    const stream = mistral.streamChatCompletion(
      this.toWireBody(mistralRequest),
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
    const model = mistralRequest.model || this.defaultModel;

    for await (const chunk of stream) {
      interface StreamChunk {
        choices?: Array<{
          delta?: {
            // A string normally; an array of thinking/text chunks when
            // reasoning is engaged.
            content?: string | MistralResponseContentPart[];
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

        // Handle text content. Reasoning deltas are kept out of the text
        // stream so `content` remains the final answer only.
        if (delta?.content) {
          const { text } = extractParts(
            delta.content as MistralResponseMessage["content"],
          );
          if (text) {
            yield {
              type: LlmStreamChunkType.Text,
              content: text,
            };
          }
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
    const mistralResponse = response as MistralResponse;
    const choice = mistralResponse.choices[0];

    const content = this.extractContent(mistralResponse);
    const hasToolCalls = this.hasToolCalls(mistralResponse);

    const stopReason =
      choice?.finishReason ?? choice?.finish_reason ?? undefined;

    return {
      content,
      hasToolCalls,
      stopReason,
      usage: this.extractUsage(mistralResponse, mistralResponse.model),
      raw: mistralResponse,
    };
  }

  extractToolCalls(response: unknown): StandardToolCall[] {
    const mistralResponse = response as MistralResponse;
    const toolCalls: StandardToolCall[] = [];
    const choice = mistralResponse.choices[0];

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
    const mistralResponse = response as MistralResponse;

    if (!mistralResponse.usage) {
      return {
        input: 0,
        output: 0,
        reasoning: 0,
        total: 0,
        provider: this.name,
        model,
      };
    }

    const usage = mistralResponse.usage;
    const cacheRead =
      usage.promptTokensDetails?.cachedTokens ??
      usage.prompt_tokens_details?.cached_tokens ??
      0;

    return {
      input: usage.promptTokens || usage.prompt_tokens || 0,
      output: usage.completionTokens || usage.completion_tokens || 0,
      reasoning: 0,
      total: usage.totalTokens || usage.total_tokens || 0,
      provider: this.name,
      model,
      ...(cacheRead ? { cacheRead } : {}),
    };
  }

  //
  // Tool Result Handling
  //

  formatToolResult(
    toolCall: StandardToolCall,
    result: StandardToolResult,
  ): MistralMessage {
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
  ): MistralRequest {
    const mistralRequest = request as MistralRequest;
    const toolCallRaw = toolCall.raw as MistralToolCall;

    // Add assistant message with the tool call
    mistralRequest.messages.push({
      role: "assistant",
      content: null,
      toolCalls: [toolCallRaw],
    });

    // Add tool result message
    mistralRequest.messages.push(this.formatToolResult(toolCall, result));

    return mistralRequest;
  }

  //
  // History Management
  //

  responseToHistoryItems(response: unknown): LlmHistory {
    const mistralResponse = response as MistralResponse;
    const historyItems: LlmHistory = [];
    const choice = mistralResponse.choices[0];

    if (!choice?.message) {
      return historyItems;
    }

    // Check if this is a tool use response
    if (choice.message.toolCalls && choice.message.toolCalls.length > 0) {
      // Don't add to history yet - will be added after tool execution
      return historyItems;
    }

    const { reasoning, text } = extractParts(choice.message.content);

    // Extract text content for non-tool responses
    if (text) {
      const historyItem: LlmOutputMessage & { reasoning?: string } = {
        content: text,
        role: LlmMessageRole.Assistant,
        type: LlmMessageType.Message,
      };

      // Preserve reasoning when the model returned thinking chunks.
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

    const errorWithStatus = error as {
      status?: number;
      statusCode?: number;
      code?: string;
      type?: string;
    };
    const statusCode = errorWithStatus.status || errorWithStatus.statusCode;

    // Mistral's own discriminators. The wire uses "rate_limited"; the
    // published error glossary's "rate_limit_error" does not appear.
    if (
      errorWithStatus.type === RATE_LIMIT_TYPE ||
      statusCode === RATE_LIMIT_STATUS_CODE
    ) {
      return {
        error,
        category: ErrorCategory.RateLimit,
        shouldRetry: false,
        suggestedDelayMs: 60000,
      };
    }

    if (statusCode) {
      // Retryable errors (server errors, timeouts, etc.)
      if (RETRYABLE_STATUS_CODES.includes(statusCode)) {
        return {
          error,
          category: ErrorCategory.Retryable,
          shouldRetry: true,
        };
      }

      // Schema validation never succeeds on retry — the body is malformed for
      // this API, not transiently rejected.
      if (statusCode === SCHEMA_VALIDATION_STATUS_CODE) {
        return {
          error,
          category: ErrorCategory.Unrecoverable,
          shouldRetry: false,
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

    // Model-level argument rejection carries a 3051 code
    if (errorWithStatus.code === INVALID_ARGS_CODE) {
      return {
        error,
        category: ErrorCategory.Unrecoverable,
        shouldRetry: false,
      };
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
    const mistralResponse = response as MistralResponse;
    const choice = mistralResponse.choices[0];

    // Complete if no tool calls
    if (!choice?.message?.toolCalls?.length) {
      return true;
    }

    return false;
  }

  override hasStructuredOutput(response: unknown): boolean {
    const mistralResponse = response as AnnotatedMistralResponse;

    // Native path: executeRequest annotates the response when we sent
    // `response_format`, so we can detect intent statelessly.
    if (mistralResponse.__jaypieStructuredOutput) {
      return this.extractStructuredOutput(response) !== undefined;
    }

    // Fallback path: fake-tool emulation, kept for models the runtime has
    // cached as not supporting native `response_format`.
    const choice = mistralResponse.choices[0];

    if (!choice?.message?.toolCalls?.length) {
      return false;
    }

    // Check if the last tool call is structured_output
    const lastToolCall =
      choice.message.toolCalls[choice.message.toolCalls.length - 1];
    return lastToolCall?.function?.name === STRUCTURED_OUTPUT_TOOL_NAME;
  }

  override extractStructuredOutput(response: unknown): JsonObject | undefined {
    const mistralResponse = response as AnnotatedMistralResponse;

    if (mistralResponse.__jaypieStructuredOutput) {
      const choice = mistralResponse.choices[0];
      // Structured output arrives as the text chunk(s), which is a plain
      // string unless reasoning was also engaged.
      const { text } = extractParts(choice?.message?.content);
      if (!text) {
        return undefined;
      }
      try {
        return JSON.parse(text) as JsonObject;
      } catch {
        return undefined;
      }
    }

    // Fallback path: fake-tool emulation
    const choice = mistralResponse.choices[0];

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

  private hasToolCalls(response: MistralResponse): boolean {
    const choice = response.choices[0];
    return (choice?.message?.toolCalls?.length ?? 0) > 0;
  }

  private extractContent(
    response: MistralResponse,
  ): string | JsonObject | undefined {
    // Check for structured output first
    if (this.hasStructuredOutput(response)) {
      return this.extractStructuredOutput(response);
    }

    const choice = response.choices[0];
    const { text } = extractParts(choice?.message?.content);
    return text ?? undefined;
  }

  private convertMessagesToMistral(
    messages: LlmHistory,
    system?: string,
  ): MistralMessage[] {
    const mistralMessages: MistralMessage[] = [];

    // Add system message if provided
    if (system) {
      mistralMessages.push({
        role: "system",
        content: system,
      });
    }

    for (const msg of messages) {
      const message = msg as unknown as Record<string, unknown>;

      // Handle different message types
      if (message.role === "system") {
        mistralMessages.push({
          role: "system",
          content: message.content as string,
        });
      } else if (message.role === "user") {
        mistralMessages.push({
          role: "user",
          content: convertContentToMistral(
            message.content as string | LlmInputContent[],
          ),
        });
      } else if (message.role === "assistant") {
        const assistantMsg: MistralMessage = {
          role: "assistant",
          content: (message.content as string) || null,
        };

        // Include toolCalls if present (check both camelCase and snake_case)
        if (message.toolCalls) {
          assistantMsg.toolCalls = message.toolCalls as MistralToolCall[];
        } else if (message.tool_calls) {
          assistantMsg.toolCalls = message.tool_calls as MistralToolCall[];
        }

        mistralMessages.push(assistantMsg);
      } else if (message.role === "tool") {
        mistralMessages.push({
          role: "tool",
          toolCallId:
            (message.toolCallId as string) || (message.tool_call_id as string),
          content: message.content as string,
        });
      } else if (message.type === LlmMessageType.Message) {
        // Handle internal message format
        const role = (message.role as string)?.toLowerCase();
        if (role === "assistant") {
          mistralMessages.push({
            role: "assistant",
            content: message.content as string,
          });
        } else {
          mistralMessages.push({
            role: "user",
            content: convertContentToMistral(
              message.content as string | LlmInputContent[],
            ),
          });
        }
      } else if (message.type === LlmMessageType.FunctionCall) {
        mistralMessages.push({
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
        mistralMessages.push({
          role: "tool",
          toolCallId: message.call_id as string,
          content: (message.output as string) || "",
        });
      }
    }

    return mistralMessages;
  }
}

// Export singleton instance
export const mistralAdapter = new MistralAdapter();
