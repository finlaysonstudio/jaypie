import { log } from "@jaypie/logger";
import { JsonObject, NaturalSchema } from "@jaypie/types";
import { z } from "zod/v4";

import { PROVIDER } from "../../constants.js";
import { paperedEffortMessage, toAnthropicEffort } from "../../util/effort.js";
import { Toolkit } from "../../tools/Toolkit.class.js";
import {
  LlmHistory,
  LlmInputContent,
  LlmMessageType,
  LlmOperateOptions,
  LlmOutputMessage,
  LlmUsageItem,
} from "../../types/LlmProvider.interface.js";
import {
  LlmStreamChunk,
  LlmStreamChunkType,
} from "../../types/LlmStreamChunk.interface.js";
import {
  CACHE_TTL_ANTHROPIC_DEFAULT,
  isJsonSchema as isBareJsonSchema,
  naturalZodSchema,
  resolveCache,
  resolveMaxOutputTokens,
} from "../../util/index.js";
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
import { AnthropicClient } from "../../providers/anthropic/client.js";
import { Anthropic } from "../../providers/anthropic/types.js";
import { BaseProviderAdapter } from "./ProviderAdapter.interface.js";

//
//
// Constants
//

const STRUCTURED_OUTPUT_TOOL_NAME = "structured_output";

/**
 * Local extension of the SDK's `MessageCreateParams` to carry
 * `output_config.format` (Anthropic native structured outputs). The SDK 0.71
 * shipped with the older `output_format` field which the API has since
 * deprecated in favor of `output_config.format`. We send the new shape via
 * an untyped passthrough so callers don't need a newer SDK; remove this
 * extension once the SDK types `output_config` directly.
 */
type AnthropicRequestParams = Anthropic.MessageCreateParams & {
  output_config?: {
    effort?: string;
    format?: {
      type: "json_schema";
      schema: JsonObject;
    };
  };
};

/**
 * Whether `output_config.effort` may be sent for this model. Anthropic added
 * the effort control on the Claude 4.5 line and up (the 5 family); older models
 * reject it. Parsing major/minor avoids matching a minor "5" in legacy ids
 * like `claude-3-5-sonnet`.
 */
function supportsAnthropicEffort(model: string): boolean {
  const match = model.match(/claude-[a-z]+-(\d+)(?:-(\d+))?/);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = match[2] !== undefined ? Number(match[2]) : 0;
  if (major >= 5) return true;
  return major === 4 && minor >= 5;
}

/**
 * Anthropic responses we annotate at receive time so downstream stateless
 * methods (`hasStructuredOutput`, `extractStructuredOutput`) can tell whether
 * the request asked for structured output without re-threading the request.
 */
type AnnotatedAnthropicMessage = Anthropic.Message & {
  __jaypieStructuredOutput?: boolean;
};

const STRUCTURED_OUTPUT_NON_PARSE_STOP_REASONS = new Set([
  "refusal",
  "max_tokens",
]);

// Regular expression to parse data URLs: data:mime/type;base64,data
const DATA_URL_REGEX = /^data:([^;]+);base64,(.+)$/;

// String formats accepted by Anthropic's structured-output grammar compiler.
// Other formats are stripped (move to description) so the API does not 400.
const SUPPORTED_STRING_FORMATS = new Set([
  "date",
  "date-time",
  "duration",
  "email",
  "hostname",
  "ipv4",
  "ipv6",
  "time",
  "uri",
  "uuid",
]);

// Top-level keywords stripped wholesale before sending: not part of the spec
// the API enforces and the validator can reject them.
const STRIPPED_TOP_LEVEL_KEYWORDS = new Set(["$schema", "$id"]);

// Keywords Anthropic's structured-output grammar does not support. They are
// removed from the schema and appended to `description` so the model still
// sees the intent.
const UNSUPPORTED_CONSTRAINT_KEYWORDS = new Set([
  "exclusiveMaximum",
  "exclusiveMinimum",
  "maxItems",
  "maxLength",
  "maxProperties",
  "maximum",
  "minLength",
  "minProperties",
  "minimum",
  "multipleOf",
  "pattern",
  "patternProperties",
  "uniqueItems",
]);

/**
 * Recursively transform a JSON Schema into the strict shape Anthropic's
 * structured-output grammar accepts: object types must have
 * `additionalProperties: false`, unsupported numeric/string/array
 * constraints are appended to `description`, and unsupported string
 * formats are stripped. Mirrors @anthropic-ai/sdk's `transformJSONSchema`
 * but inline so we do not take a runtime dependency on the optional
 * peer SDK.
 */
function sanitizeJsonSchemaForAnthropic(
  schema: JsonObject,
  isRoot = true,
): JsonObject {
  const result: JsonObject = {};
  const carriedConstraints: string[] = [];

  for (const [key, value] of Object.entries(schema)) {
    if (isRoot && STRIPPED_TOP_LEVEL_KEYWORDS.has(key)) {
      continue;
    }

    if (UNSUPPORTED_CONSTRAINT_KEYWORDS.has(key)) {
      carriedConstraints.push(`${key}: ${JSON.stringify(value)}`);
      continue;
    }

    if (key === "format" && typeof value === "string") {
      if (SUPPORTED_STRING_FORMATS.has(value)) {
        result[key] = value;
      } else {
        carriedConstraints.push(`format: ${JSON.stringify(value)}`);
      }
      continue;
    }

    if (key === "minItems" && typeof value === "number") {
      if (value === 0 || value === 1) {
        result[key] = value;
      } else {
        carriedConstraints.push(`minItems: ${value}`);
      }
      continue;
    }

    if (
      key === "properties" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const transformedProps: JsonObject = {};
      for (const [propName, propSchema] of Object.entries(
        value as JsonObject,
      )) {
        transformedProps[propName] = isJsonSchema(propSchema)
          ? sanitizeJsonSchemaForAnthropic(propSchema, false)
          : propSchema;
      }
      result[key] = transformedProps;
      continue;
    }

    if (
      (key === "items" || key === "additionalItems" || key === "contains") &&
      isJsonSchema(value)
    ) {
      result[key] = sanitizeJsonSchemaForAnthropic(value, false);
      continue;
    }

    if (
      (key === "anyOf" || key === "oneOf" || key === "allOf") &&
      Array.isArray(value)
    ) {
      const targetKey = key === "oneOf" ? "anyOf" : key;
      result[targetKey] = value.map((entry) =>
        isJsonSchema(entry)
          ? sanitizeJsonSchemaForAnthropic(entry, false)
          : entry,
      );
      continue;
    }

    if (key === "$defs" && value && typeof value === "object") {
      const transformedDefs: JsonObject = {};
      for (const [defName, defSchema] of Object.entries(value as JsonObject)) {
        transformedDefs[defName] = isJsonSchema(defSchema)
          ? sanitizeJsonSchemaForAnthropic(defSchema, false)
          : defSchema;
      }
      result[key] = transformedDefs;
      continue;
    }

    if (key === "additionalProperties") {
      // Always force `false` on objects below; ignore caller-supplied value.
      continue;
    }

    result[key] = value;
  }

  if (result.type === "object") {
    result.additionalProperties = false;
  }

  if (carriedConstraints.length > 0) {
    const existing =
      typeof result.description === "string" ? result.description : "";
    const suffix = `{${carriedConstraints.join(", ")}}`;
    result.description = existing ? `${existing}\n\n${suffix}` : suffix;
  }

  return result;
}

function isJsonSchema(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse a data URL into its components
 */
function parseDataUrl(
  dataUrl: string,
): { data: string; mediaType: string } | null {
  const match = dataUrl.match(DATA_URL_REGEX);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

/**
 * Convert standardized content items to Anthropic format
 */
function convertContentToAnthropic(
  content: string | LlmInputContent[],
): Anthropic.ContentBlockParam[] | string {
  if (typeof content === "string") {
    return content;
  }

  return content.map((item): Anthropic.ContentBlockParam => {
    // Text content
    if (item.type === LlmMessageType.InputText) {
      return { type: "text", text: item.text };
    }

    // Image content
    if (item.type === LlmMessageType.InputImage) {
      const imageUrl = item.image_url || "";
      const parsed = parseDataUrl(imageUrl);
      if (parsed) {
        return {
          type: "image",
          source: {
            type: "base64",
            media_type:
              parsed.mediaType as Anthropic.Base64ImageSource["media_type"],
            data: parsed.data,
          },
        };
      }
      // Fallback for URL-based images (not base64)
      return {
        type: "image",
        source: {
          type: "url",
          url: imageUrl,
        },
      };
    }

    // File/Document content (PDF, etc.)
    if (item.type === LlmMessageType.InputFile) {
      const fileData = typeof item.file_data === "string" ? item.file_data : "";
      const parsed = parseDataUrl(fileData);
      if (parsed) {
        return {
          type: "document",
          source: {
            type: "base64",
            media_type:
              parsed.mediaType as Anthropic.Base64PDFSource["media_type"],
            data: parsed.data,
          },
        };
      }
      // Fallback - return as text with the filename
      return { type: "text", text: `[File: ${item.filename || "unknown"}]` };
    }

    // Unknown type - return as text
    return { type: "text", text: JSON.stringify(item) };
  });
}

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

// Models known not to accept `temperature`.
// Patterns (not exact names) so dated variants and future releases are covered
// without code changes — Anthropic is trending toward removing temperature on
// newer Claude models.
const MODELS_WITHOUT_TEMPERATURE: RegExp[] = [
  /^claude-opus-4-[789]/,
  /^claude-opus-[5-9]/,
];

function isTemperatureDeprecationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    status?: number;
    message?: string;
    error?: { message?: string };
  };
  const name = (error as Error)?.constructor?.name;
  if (name !== "BadRequestError" && err.status !== 400) return false;
  const messages = [err.message, err.error?.message].filter(
    (m): m is string => typeof m === "string",
  );
  return messages.some((m) => m.toLowerCase().includes("temperature"));
}

/**
 * Detect 400 errors that indicate the model itself does not support native
 * structured outputs (`output_config.format`). Citations + structured output
 * is also a 400 case but is a caller error rather than a model-capability
 * gap, so we explicitly skip it to avoid masking the real problem under a
 * tool-emulation retry. The deprecated-`output_format` 400 (API renamed the
 * field) is also explicitly excluded — that's a code-path bug, not a model
 * gap; it should propagate so we notice and fix it.
 */
function isStructuredOutputUnsupportedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    status?: number;
    message?: string;
    error?: { message?: string };
  };
  const name = (error as Error)?.constructor?.name;
  if (name !== "BadRequestError" && err.status !== 400) return false;
  const messages = [err.message, err.error?.message].filter(
    (m): m is string => typeof m === "string",
  );
  if (messages.some((m) => /citation/i.test(m))) return false;
  if (messages.some((m) => /deprecated/i.test(m))) return false;
  return messages.some((m) =>
    /output_config|output_format|json[_ ]schema|structured/i.test(m),
  );
}

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
  readonly defaultModel = PROVIDER.ANTHROPIC.DEFAULT;

  // Session-level cache of models observed to reject `temperature` at runtime.
  // Populated by executeRequest on 400 errors so repeat calls skip the param.
  private runtimeNoTemperatureModels = new Set<string>();

  // Session-level cache of models observed to reject `output_format`. When a
  // model is in this set, buildRequest engages the legacy fake-tool path
  // instead of native structured output.
  private runtimeNoStructuredOutputModels = new Set<string>();

  rememberModelRejectsTemperature(model: string): void {
    this.runtimeNoTemperatureModels.add(model);
  }

  clearRuntimeNoTemperatureModels(): void {
    this.runtimeNoTemperatureModels.clear();
  }

  rememberModelRejectsStructuredOutput(model: string): void {
    this.runtimeNoStructuredOutputModels.add(model);
  }

  clearRuntimeNoStructuredOutputModels(): void {
    this.runtimeNoStructuredOutputModels.clear();
  }

  private supportsTemperature(model: string): boolean {
    if (this.runtimeNoTemperatureModels.has(model)) return false;
    return !MODELS_WITHOUT_TEMPERATURE.some((pattern) => pattern.test(model));
  }

  private supportsStructuredOutput(model: string): boolean {
    return !this.runtimeNoStructuredOutputModels.has(model);
  }

  //
  // Request Building
  //

  buildRequest(request: OperateRequest): AnthropicRequestParams {
    // Convert messages to Anthropic format
    // Handle different message types: regular messages, function calls, and function outputs
    const messages: Anthropic.MessageParam[] = [];

    for (const msg of request.messages) {
      const typedMsg = msg as {
        type?: string;
        role?: string;
        content?: string | LlmInputContent[];
        name?: string;
        arguments?: string;
        call_id?: string;
        output?: string;
      };

      // Skip system messages - Anthropic only accepts system as a top-level field
      if (typedMsg.role === "system") {
        continue;
      }

      // Handle FunctionCall messages - convert to assistant message with tool_use
      if (typedMsg.type === LlmMessageType.FunctionCall) {
        messages.push({
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: typedMsg.call_id || "",
              name: typedMsg.name || "",
              input: JSON.parse(typedMsg.arguments || "{}"),
            },
          ],
        });
        continue;
      }

      // Handle FunctionCallOutput messages - convert to user message with tool_result
      if (typedMsg.type === LlmMessageType.FunctionCallOutput) {
        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: typedMsg.call_id || "",
              content: typedMsg.output || "",
            },
          ],
        });
        continue;
      }

      // Handle regular messages with role and content
      if (typedMsg.role && typedMsg.content !== undefined) {
        messages.push({
          role: typedMsg.role as "user" | "assistant",
          content: convertContentToAnthropic(typedMsg.content),
        } as Anthropic.MessageParam);
      }
    }

    // Append instructions to last message if provided
    if (request.instructions && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (typeof lastMsg.content === "string") {
        lastMsg.content = lastMsg.content + "\n\n" + request.instructions;
      }
    }

    const model = (request.model ||
      this.defaultModel) as Anthropic.MessageCreateParams["model"];
    const anthropicRequest: AnthropicRequestParams = {
      model,
      messages,
      max_tokens:
        resolveMaxOutputTokens(model as string, { stream: request.stream }) ??
        PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
      stream: false,
    };

    const cache = resolveCache(request.cache, {
      defaultTtl: CACHE_TTL_ANTHROPIC_DEFAULT,
    });
    const cacheControl: Anthropic.CacheControlEphemeral | undefined =
      cache.enabled
        ? {
            type: "ephemeral",
            ...(cache.ttl === "1h" ? { ttl: "1h" as const } : {}),
          }
        : undefined;

    if (request.system) {
      // A cache breakpoint on the system block caches tools+system together
      // (render order is tools -> system -> messages).
      anthropicRequest.system = cacheControl
        ? [{ type: "text", text: request.system, cache_control: cacheControl }]
        : request.system;
    }

    const useFallbackStructuredOutput =
      Boolean(request.format) &&
      !this.supportsStructuredOutput(anthropicRequest.model as string);

    const allTools: ProviderToolDefinition[] = request.tools
      ? [...request.tools]
      : [];
    if (useFallbackStructuredOutput && request.format) {
      log.warn(
        `[AnthropicAdapter] Using legacy structured_output tool fallback for model ${anthropicRequest.model as string}; native output_config previously rejected for this model.`,
      );
      allTools.push({
        name: STRUCTURED_OUTPUT_TOOL_NAME,
        description:
          "Output a structured JSON object, " +
          "use this before your final response to give structured outputs to the user",
        parameters: request.format,
      });
    }

    if (allTools.length > 0) {
      anthropicRequest.tools = allTools.map((tool, index) => ({
        name: tool.name,
        description: tool.description,
        input_schema: {
          ...tool.parameters,
          type: "object",
        } as Anthropic.Messages.Tool.InputSchema,
        type: "custom" as const,
        // Breakpoint on the last tool caches the tool list (which renders
        // before system) when there is no system prompt to anchor it.
        ...(cacheControl && index === allTools.length - 1
          ? { cache_control: cacheControl }
          : {}),
      }));

      anthropicRequest.tool_choice = useFallbackStructuredOutput
        ? { type: "any" }
        : { type: "auto" };
    }

    // Native structured output: send schema as `output_config.format`. The
    // legacy tool-emulation path is engaged only as a runtime fallback for
    // models the API has flagged as not supporting native structured output.
    if (request.format && !useFallbackStructuredOutput) {
      anthropicRequest.output_config = {
        format: {
          type: "json_schema",
          schema: request.format,
        },
      };
    }

    if (request.providerOptions) {
      Object.assign(anthropicRequest, request.providerOptions);
    }

    // Normalized reasoning effort -> output_config.effort (merged so a format
    // config above survives). First-class effort wins over providerOptions.
    if (
      request.effort &&
      supportsAnthropicEffort(anthropicRequest.model as string)
    ) {
      const mapping = toAnthropicEffort(request.effort);
      if (mapping.papered) {
        log.debug(
          paperedEffortMessage({
            model: anthropicRequest.model as string,
            provider: this.name,
            requested: request.effort,
            value: mapping.value,
          }),
        );
      }
      anthropicRequest.output_config = {
        ...anthropicRequest.output_config,
        effort: mapping.value,
      };
    }

    // First-class temperature takes precedence over providerOptions
    if (request.temperature !== undefined) {
      anthropicRequest.temperature = request.temperature;
    }

    // Strip temperature for models that don't support it (denylist + runtime cache)
    if (
      anthropicRequest.temperature !== undefined &&
      !this.supportsTemperature(anthropicRequest.model as string)
    ) {
      delete anthropicRequest.temperature;
    }

    return anthropicRequest;
  }

  formatTools(
    toolkit: Toolkit,
    // outputSchema is part of the interface contract but Anthropic now uses
    // native `output_format` (set in buildRequest), so we no longer inject a
    // synthetic structured-output tool here.

    _outputSchema?: JsonObject,
  ): ProviderToolDefinition[] {
    return toolkit.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        ...tool.parameters,
        type: "object",
      } as JsonObject,
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
      isBareJsonSchema(schema)
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

    return sanitizeJsonSchemaForAnthropic(jsonSchema);
  }

  //
  // API Execution
  //

  async executeRequest(
    client: unknown,
    request: unknown,
    signal?: AbortSignal,
  ): Promise<Anthropic.Message> {
    const anthropic = client as AnthropicClient;
    const anthropicRequest = request as AnthropicRequestParams;
    const wantsStructuredOutput = Boolean(anthropicRequest.output_config);
    try {
      const response = (await anthropic.messages.create(
        anthropicRequest as Anthropic.MessageCreateParams,
        signal ? { signal } : undefined,
      )) as AnnotatedAnthropicMessage;
      if (wantsStructuredOutput) {
        response.__jaypieStructuredOutput = true;
      }
      return response;
    } catch (error) {
      if (signal?.aborted) return undefined as unknown as Anthropic.Message;

      // If the model rejected `temperature`, cache it and retry without the param
      if (
        anthropicRequest.temperature !== undefined &&
        isTemperatureDeprecationError(error)
      ) {
        this.rememberModelRejectsTemperature(anthropicRequest.model as string);
        const retryRequest = { ...anthropicRequest };
        delete retryRequest.temperature;
        const response = (await anthropic.messages.create(
          retryRequest as Anthropic.MessageCreateParams,
          signal ? { signal } : undefined,
        )) as AnnotatedAnthropicMessage;
        if (wantsStructuredOutput) {
          response.__jaypieStructuredOutput = true;
        }
        return response;
      }

      // If the model rejected native structured output, cache it and retry
      // via the legacy fake-tool emulation path.
      if (wantsStructuredOutput && isStructuredOutputUnsupportedError(error)) {
        const model = anthropicRequest.model as string;
        this.rememberModelRejectsStructuredOutput(model);
        log.warn(
          `[AnthropicAdapter] Model ${model} rejected native output_config; falling back to legacy structured_output tool emulation.`,
        );
        const fallbackRequest =
          this.toFallbackStructuredOutputRequest(anthropicRequest);
        return (await anthropic.messages.create(
          fallbackRequest as Anthropic.MessageCreateParams,
          signal ? { signal } : undefined,
        )) as Anthropic.Message;
      }

      throw error;
    }
  }

  /**
   * Rebuild a structured-output request without `output_format`, swapping in
   * the legacy fake-tool emulation. Used as a runtime fallback when a model
   * rejects native `output_config.format`.
   */
  private toFallbackStructuredOutputRequest(
    request: AnthropicRequestParams,
  ): AnthropicRequestParams {
    const { output_config, ...rest } = request;
    if (!output_config?.format) return request;
    const fallbackRequest: AnthropicRequestParams = { ...rest };
    // Preserve an effort setting; only the structured-output format falls back.
    if (output_config.effort) {
      fallbackRequest.output_config = { effort: output_config.effort };
    }
    const fakeTool = {
      name: STRUCTURED_OUTPUT_TOOL_NAME,
      description:
        "Output a structured JSON object, " +
        "use this before your final response to give structured outputs to the user",
      input_schema: {
        ...output_config.format.schema,
        type: "object",
      } as Anthropic.Messages.Tool.InputSchema,
      type: "custom" as const,
    };
    fallbackRequest.tools = [...(fallbackRequest.tools ?? []), fakeTool];
    fallbackRequest.tool_choice = { type: "any" };
    return fallbackRequest;
  }

  async *executeStreamRequest(
    client: unknown,
    request: unknown,
    signal?: AbortSignal,
  ): AsyncIterable<LlmStreamChunk> {
    const anthropic = client as AnthropicClient;
    // Preserve `output_config` when passing through to the SDK by typing
    // through the local extension instead of the upstream
    // MessageCreateParams shape.
    let streamRequest = {
      ...(request as AnthropicRequestParams),
      stream: true,
    } as AnthropicRequestParams & { stream: true };

    let stream;
    try {
      stream = await anthropic.messages.create(
        streamRequest as Anthropic.MessageCreateParamsStreaming,
        signal ? { signal } : undefined,
      );
    } catch (error) {
      if (
        streamRequest.temperature !== undefined &&
        isTemperatureDeprecationError(error)
      ) {
        this.rememberModelRejectsTemperature(streamRequest.model as string);
        streamRequest = {
          ...streamRequest,
        };
        delete streamRequest.temperature;
        stream = await anthropic.messages.create(
          streamRequest as Anthropic.MessageCreateParamsStreaming,
          signal ? { signal } : undefined,
        );
      } else {
        throw error;
      }
    }

    // Track current tool call being built
    let currentToolCall: {
      id: string;
      name: string;
      arguments: string;
    } | null = null;

    // Track usage for final chunk
    let inputTokens = 0;
    let outputTokens = 0;
    let thinkingTokens = 0;
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
          // Check for thinking tokens in extended thinking responses
          const extendedUsage = event.usage as { thinking_tokens?: number };
          if (extendedUsage.thinking_tokens) {
            thinkingTokens = extendedUsage.thinking_tokens;
          }
        }
      } else if (event.type === "message_stop") {
        // Emit done chunk with usage
        yield {
          type: LlmStreamChunkType.Done,
          usage: [
            {
              input: inputTokens,
              output: outputTokens,
              reasoning: thinkingTokens,
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

    // Check for thinking tokens in the usage (extended thinking feature)
    // Anthropic includes thinking tokens in a separate field when enabled
    const usage = anthropicResponse.usage as {
      input_tokens: number;
      output_tokens: number;
      thinking_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };

    return {
      input: usage.input_tokens,
      output: usage.output_tokens,
      reasoning: usage.thinking_tokens || 0,
      total: usage.input_tokens + usage.output_tokens,
      ...(usage.cache_read_input_tokens !== undefined
        ? { cacheRead: usage.cache_read_input_tokens }
        : {}),
      ...(usage.cache_creation_input_tokens !== undefined
        ? { cacheWrite: usage.cache_creation_input_tokens }
        : {}),
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

    // Include thinking blocks for extended thinking support
    // Thinking blocks are preserved in history so extractReasoning can find them
    for (const block of anthropicResponse.content) {
      if (block.type === "thinking") {
        // Push raw block - types are loosely checked at runtime
        // This allows extractReasoning to access the thinking property
        historyItems.push(block as unknown as LlmOutputMessage);
      }
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
    // Shared first pass: retryable structured-output timeouts (#422),
    // quota exhaustion, and billing failures classify the same across providers.
    const shared = classifyProviderError(error);
    if (shared) return shared;

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
    const anthropicResponse = response as Anthropic.Message;
    return anthropicResponse.stop_reason !== "tool_use";
  }

  override hasStructuredOutput(response: unknown): boolean {
    const anthropicResponse = response as AnnotatedAnthropicMessage;

    // Native path: executeRequest annotates the response when we sent
    // `output_format`, so we can detect intent statelessly.
    if (anthropicResponse.__jaypieStructuredOutput) {
      return this.extractStructuredOutput(response) !== undefined;
    }

    // Fallback path: legacy fake-tool emulation, kept for models that the
    // runtime has cached as not supporting `output_format`.
    const lastBlock =
      anthropicResponse.content[anthropicResponse.content.length - 1];
    return (
      lastBlock?.type === "tool_use" &&
      (lastBlock as Anthropic.ToolUseBlock).name === STRUCTURED_OUTPUT_TOOL_NAME
    );
  }

  override extractStructuredOutput(response: unknown): JsonObject | undefined {
    const anthropicResponse = response as AnnotatedAnthropicMessage;

    if (anthropicResponse.__jaypieStructuredOutput) {
      // Refusal and truncation are explicit non-JSON outcomes per Anthropic
      // structured-outputs docs — surface the text upstream instead of
      // forcing a JSON.parse on what is not JSON.
      if (
        anthropicResponse.stop_reason &&
        STRUCTURED_OUTPUT_NON_PARSE_STOP_REASONS.has(
          anthropicResponse.stop_reason,
        )
      ) {
        return undefined;
      }

      const textBlock = anthropicResponse.content.find(
        (block) => block.type === "text",
      ) as Anthropic.TextBlock | undefined;
      if (!textBlock) return undefined;

      try {
        const parsed = JSON.parse(textBlock.text);
        return parsed as JsonObject;
      } catch {
        return undefined;
      }
    }

    // Fallback path: legacy fake-tool emulation
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
