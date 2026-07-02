import { log } from "@jaypie/logger";
import { JsonObject, NaturalSchema } from "@jaypie/types";
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
import {
  LlmStreamChunk,
  LlmStreamChunkType,
} from "../../types/LlmStreamChunk.interface.js";
import {
  isJsonSchema,
  jsonSchemaToOpenApi3,
  naturalZodSchema,
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
import { GoogleClient } from "../../providers/google/client.js";
import { BaseProviderAdapter } from "./ProviderAdapter.interface.js";
import {
  GeminiContent,
  GeminiErrorInfo,
  GeminiFunctionCall,
  GeminiFunctionDeclaration,
  GeminiPart,
  GeminiRawResponse,
  GeminiRequest,
} from "../../providers/google/types.js";

//
//
// Constants
//

const STRUCTURED_OUTPUT_TOOL_NAME = "structured_output";

// Gemini 3 family supports combining tools (function calling) with native
// structured output via `responseJsonSchema`. Earlier Gemini families
// (including 2.5 thinking) do not support the combo and fall back to the
// legacy `structured_output` fake-tool emulation.
const GEMINI_3_PATTERN = /^gemini-3/;

/**
 * Detect 4xx errors that indicate the model itself does not support the
 * `responseJsonSchema` + tools combo. Triggers the runtime fallback to the
 * fake-tool emulation path. Other 400s propagate.
 */
function isStructuredOutputComboUnsupportedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    status?: number;
    code?: number;
    message?: string;
    error?: { message?: string };
  };
  const status = err.status ?? err.code;
  if (status !== 400) return false;
  const messages = [err.message, err.error?.message].filter(
    (m): m is string => typeof m === "string",
  );
  return messages.some((m) =>
    /response[_ ]?json[_ ]?schema|response[_ ]?schema|response[_ ]?mime|function[_ ]?call|tools/i.test(
      m,
    ),
  );
}

// Gemini uses HTTP status codes for error classification
// Documented at: https://ai.google.dev/api/rest/v1beta/Status
const RETRYABLE_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests (Rate Limit)
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

const NOT_RETRYABLE_STATUS_CODES = [
  400, // Bad Request
  401, // Unauthorized
  403, // Forbidden
  404, // Not Found
  409, // Conflict
  422, // Unprocessable Entity
];

//
//
// Main
//

/**
 * GoogleAdapter implements the ProviderAdapter interface for Google's Gemini API.
 * It handles request building, response parsing, and error classification
 * specific to Gemini's generateContent API.
 */
export class GoogleAdapter extends BaseProviderAdapter {
  readonly name = PROVIDER.GOOGLE.NAME;
  readonly defaultModel = PROVIDER.GOOGLE.MODEL.DEFAULT;

  // Session-level cache of Gemini 3 models observed to reject the native
  // `responseJsonSchema` + tools combo. When a model is in this set,
  // buildRequest engages the legacy fake-tool path instead.
  private runtimeNoStructuredOutputComboModels = new Set<string>();

  rememberModelRejectsStructuredOutputCombo(model: string): void {
    this.runtimeNoStructuredOutputComboModels.add(model);
  }

  clearRuntimeNoStructuredOutputComboModels(): void {
    this.runtimeNoStructuredOutputComboModels.clear();
  }

  private supportsStructuredOutputCombo(model: string): boolean {
    if (this.runtimeNoStructuredOutputComboModels.has(model)) return false;
    return GEMINI_3_PATTERN.test(model);
  }

  //
  // Request Building
  //

  buildRequest(request: OperateRequest): GeminiRequest {
    // Convert messages to Gemini format (Content[])
    const contents: GeminiContent[] = this.convertMessagesToContents(
      request.messages,
    );

    const geminiRequest: GeminiRequest = {
      model: request.model || this.defaultModel,
      contents,
    };

    // Add system instruction if provided
    if (request.system) {
      geminiRequest.config = {
        ...geminiRequest.config,
        systemInstruction: request.system,
      };
    }

    // Append instructions to the last user message if provided
    if (request.instructions && contents.length > 0) {
      const lastContent = contents[contents.length - 1];
      if (lastContent.role === "user" && lastContent.parts) {
        const lastPart = lastContent.parts[lastContent.parts.length - 1];
        if (lastPart.text) {
          lastPart.text = lastPart.text + "\n\n" + request.instructions;
        }
      }
    }

    const hasUserTools = !!(request.tools && request.tools.length > 0);
    const useNativeCombo =
      Boolean(request.format) &&
      hasUserTools &&
      this.supportsStructuredOutputCombo(geminiRequest.model);

    // When tools+format are combined and the model does not support the native
    // combo, inject the legacy `structured_output` fake tool here so the model
    // is forced to call it before its final answer.
    const allTools: ProviderToolDefinition[] = request.tools
      ? [...request.tools]
      : [];
    if (request.format && hasUserTools && !useNativeCombo) {
      log.warn(
        `[GoogleAdapter] Using legacy structured_output tool fallback for model ${geminiRequest.model}; native responseJsonSchema + tools combo is only available on Gemini 3.`,
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
      const functionDeclarations: GeminiFunctionDeclaration[] = allTools.map(
        (tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        }),
      );

      geminiRequest.config = {
        ...geminiRequest.config,
        tools: [{ functionDeclarations }],
      };
    }

    // Native structured output: send schema as `responseJsonSchema`
    // (or `responseSchema` for Gemini 2.5+ no-tools path). The legacy
    // fake-tool emulation only runs when format+tools is combined on a model
    // that doesn't support the native combo.
    const wantsNativeStructured =
      Boolean(request.format) && (!hasUserTools || useNativeCombo);

    if (wantsNativeStructured) {
      const useJsonSchema =
        useNativeCombo || request.providerOptions?.useJsonSchema === true;

      if (useJsonSchema) {
        geminiRequest.config = {
          ...geminiRequest.config,
          responseMimeType: "application/json",
          responseJsonSchema: request.format,
        };
      } else {
        geminiRequest.config = {
          ...geminiRequest.config,
          responseMimeType: "application/json",
          responseSchema: jsonSchemaToOpenApi3(request.format!),
        };
      }
    }

    // Legacy fake-tool path needs a system-prompt nudge so the model actually
    // calls the synthetic tool before its final answer.
    if (request.format && hasUserTools && !useNativeCombo) {
      const structuredOutputInstruction =
        "IMPORTANT: Before providing your final response, you MUST use the structured_output tool " +
        "to output your answer in the required JSON format.";

      const existingSystem = geminiRequest.config?.systemInstruction || "";
      geminiRequest.config = {
        ...geminiRequest.config,
        systemInstruction: existingSystem
          ? `${existingSystem}\n\n${structuredOutputInstruction}`
          : structuredOutputInstruction,
      };
    }

    // Add provider-specific options
    if (request.providerOptions) {
      geminiRequest.config = {
        ...geminiRequest.config,
        ...request.providerOptions,
      };
    }

    // First-class temperature takes precedence over providerOptions
    if (request.temperature !== undefined) {
      geminiRequest.config = {
        ...geminiRequest.config,
        temperature: request.temperature,
      };
    }

    return geminiRequest;
  }

  formatTools(
    toolkit: Toolkit,
    // outputSchema is part of the interface contract but Gemini now handles
    // structured output via `responseJsonSchema`/`responseSchema` (or the
    // legacy fake-tool injected in buildRequest as a fallback). We no longer
    // inject a synthetic structured-output tool here.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      isJsonSchema(schema)
    ) {
      jsonSchema = structuredClone(schema) as JsonObject;
      jsonSchema.type = "object";
    } else {
      // Convert NaturalSchema to JSON schema through Zod
      const zodSchema =
        schema instanceof z.ZodType
          ? schema
          : naturalZodSchema(schema as NaturalSchema);
      jsonSchema = z.toJSONSchema(zodSchema) as JsonObject;
    }

    return jsonSchemaToOpenApi3(jsonSchema);
  }

  //
  // API Execution
  //

  async executeRequest(
    client: unknown,
    request: unknown,
    signal?: AbortSignal,
  ): Promise<GeminiRawResponse> {
    const genAI = client as GoogleClient;
    const geminiRequest = request as GeminiRequest;
    const wantsNativeCombo =
      !!geminiRequest.config?.responseJsonSchema &&
      !!geminiRequest.config?.tools;

    try {
      // Cast config to any to bypass strict type checking between our internal types
      // and the SDK's types. The SDK will validate at runtime.
      const response = await genAI.models.generateContent({
        model: geminiRequest.model,
        contents: geminiRequest.contents as any,
        config: geminiRequest.config as any,
      });

      return response as unknown as GeminiRawResponse;
    } catch (error) {
      if (signal?.aborted) return undefined as unknown as GeminiRawResponse;

      // If the model rejected the native responseJsonSchema + tools combo,
      // cache it and retry with the legacy fake-tool emulation path.
      if (wantsNativeCombo && isStructuredOutputComboUnsupportedError(error)) {
        const model = geminiRequest.model;
        this.rememberModelRejectsStructuredOutputCombo(model);
        log.warn(
          `[GoogleAdapter] Model ${model} rejected native responseJsonSchema + tools combo; falling back to legacy structured_output tool emulation.`,
        );
        const fallbackRequest =
          this.toFallbackStructuredOutputRequest(geminiRequest);
        const response = await genAI.models.generateContent({
          model: fallbackRequest.model,
          contents: fallbackRequest.contents as any,
          config: fallbackRequest.config as any,
        });
        return response as unknown as GeminiRawResponse;
      }

      throw error;
    }
  }

  /**
   * Rebuild a Gemini 3 native-combo request without `responseJsonSchema`/
   * `responseMimeType`, swapping in the legacy fake-tool emulation. Used as
   * a runtime fallback when a Gemini 3 model rejects the combo.
   */
  private toFallbackStructuredOutputRequest(
    request: GeminiRequest,
  ): GeminiRequest {
    if (!request.config?.responseJsonSchema) return request;
    const schema = request.config.responseJsonSchema as JsonObject;
    const newConfig: GeminiRequest["config"] = { ...request.config };
    delete (newConfig as Record<string, unknown>).responseJsonSchema;
    delete (newConfig as Record<string, unknown>).responseMimeType;

    const fakeTool: GeminiFunctionDeclaration = {
      name: STRUCTURED_OUTPUT_TOOL_NAME,
      description:
        "Output a structured JSON object, " +
        "use this before your final response to give structured outputs to the user",
      parameters: schema,
    };
    const existingDeclarations =
      newConfig.tools?.[0]?.functionDeclarations ?? [];
    newConfig.tools = [
      { functionDeclarations: [...existingDeclarations, fakeTool] },
    ];

    const structuredOutputInstruction =
      "IMPORTANT: Before providing your final response, you MUST use the structured_output tool " +
      "to output your answer in the required JSON format.";
    const existingSystem = newConfig.systemInstruction || "";
    newConfig.systemInstruction = existingSystem
      ? `${existingSystem}\n\n${structuredOutputInstruction}`
      : structuredOutputInstruction;

    return {
      ...request,
      config: newConfig,
    };
  }

  async *executeStreamRequest(
    client: unknown,
    request: unknown,
    signal?: AbortSignal,
  ): AsyncIterable<LlmStreamChunk> {
    // signal is accepted for interface conformance; Gemini SDK does not natively support it
    void signal;
    const genAI = client as GoogleClient;
    const geminiRequest = request as GeminiRequest;

    // Use generateContentStream for streaming
    const stream = await genAI.models.generateContentStream({
      model: geminiRequest.model,
      contents: geminiRequest.contents as any,
      config: geminiRequest.config as any,
    });

    // Track usage for final chunk
    let inputTokens = 0;
    let outputTokens = 0;
    let reasoningTokens = 0;
    const model = geminiRequest.model || this.defaultModel;

    for await (const chunk of stream) {
      // Extract text content from the chunk
      const candidate = chunk.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          // Handle text content (excluding thought parts)
          if (part.text && !part.thought) {
            yield {
              type: LlmStreamChunkType.Text,
              content: part.text,
            };
          }

          // Handle function calls
          if (part.functionCall) {
            const functionCall = part.functionCall as GeminiFunctionCall;
            const currentFunctionCall = {
              id: functionCall.id || this.generateCallId(),
              name: functionCall.name || "",
              arguments: functionCall.args || {},
            };

            // Preserve thoughtSignature for Gemini 3 models
            // Required to maintain tool call context between turns
            const metadata: Record<string, unknown> | undefined =
              part.thoughtSignature
                ? { thoughtSignature: part.thoughtSignature }
                : undefined;

            // Emit the function call immediately
            yield {
              type: LlmStreamChunkType.ToolCall,
              toolCall: {
                id: currentFunctionCall.id,
                name: currentFunctionCall.name,
                arguments: JSON.stringify(currentFunctionCall.arguments),
                metadata,
              },
            };
          }
        }
      }

      // Extract usage metadata if present
      if (chunk.usageMetadata) {
        inputTokens = chunk.usageMetadata.promptTokenCount || 0;
        outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
        reasoningTokens = chunk.usageMetadata.thoughtsTokenCount || 0;
      }
    }

    // Emit done chunk with final usage
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

  //
  // Response Parsing
  //

  parseResponse(
    response: unknown,
    options?: LlmOperateOptions,
  ): ParsedResponse {
    const geminiResponse = response as GeminiRawResponse;

    const content = this.extractContent(geminiResponse, options);
    const hasToolCalls = this.hasToolCalls(geminiResponse);

    return {
      content,
      hasToolCalls,
      stopReason: this.getFinishReason(geminiResponse),
      usage: this.extractUsage(
        geminiResponse,
        options?.model || this.defaultModel,
      ),
      raw: geminiResponse,
    };
  }

  extractToolCalls(response: unknown): StandardToolCall[] {
    const geminiResponse = response as GeminiRawResponse;
    const toolCalls: StandardToolCall[] = [];

    const candidate = geminiResponse.candidates?.[0];
    if (!candidate?.content?.parts) {
      return toolCalls;
    }

    for (const part of candidate.content.parts) {
      if (part.functionCall) {
        const functionCall = part.functionCall as GeminiFunctionCall;
        toolCalls.push({
          callId: functionCall.id || this.generateCallId(),
          name: functionCall.name || "",
          arguments: JSON.stringify(functionCall.args || {}),
          raw: part,
        });
      }
    }

    return toolCalls;
  }

  extractUsage(response: unknown, model: string): LlmUsageItem {
    const geminiResponse = response as GeminiRawResponse;

    if (!geminiResponse.usageMetadata) {
      return {
        input: 0,
        output: 0,
        reasoning: 0,
        total: 0,
        provider: this.name,
        model,
      };
    }

    const usage = geminiResponse.usageMetadata;

    return {
      input: usage.promptTokenCount || 0,
      output: usage.candidatesTokenCount || 0,
      reasoning: usage.thoughtsTokenCount || 0,
      total: usage.totalTokenCount || 0,
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
  ): GeminiPart {
    // Gemini's `function_response.response` is a protobuf Struct, which only
    // accepts plain objects. Some models (e.g. gemini-3.1-pro) accept scalar
    // values silently; gemini-3.1-flash-lite rejects them. Parse the output
    // and wrap any non-object value (string, number, boolean, array, null)
    // in `{ result: value }` so every tool result is a valid Struct.
    let responseData: Record<string, unknown>;
    try {
      const parsed = JSON.parse(result.output);
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        responseData = parsed as Record<string, unknown>;
      } else {
        responseData = { result: parsed };
      }
    } catch {
      responseData = { result: result.output };
    }

    return {
      functionResponse: {
        name: toolCall.name,
        response: responseData,
      },
    };
  }

  appendToolResult(
    request: unknown,
    toolCall: StandardToolCall,
    result: StandardToolResult,
  ): GeminiRequest {
    const geminiRequest = request as GeminiRequest;
    const toolCallRaw = toolCall.raw as GeminiPart;
    const toolResponse = this.formatToolResult(toolCall, result);

    // Get the last two contents to check for existing tool call/response pattern
    const lastContent =
      geminiRequest.contents[geminiRequest.contents.length - 1];
    const secondLastContent =
      geminiRequest.contents[geminiRequest.contents.length - 2];

    // Check if we're adding to an existing tool call batch
    // Pattern: [..., model (with functionCall), user (with functionResponse)]
    const hasExistingToolBatch =
      lastContent?.role === "user" &&
      lastContent?.parts?.some((p) => p.functionResponse) &&
      secondLastContent?.role === "model" &&
      secondLastContent?.parts?.some((p) => p.functionCall);

    if (hasExistingToolBatch) {
      // Append to existing batch
      secondLastContent.parts!.push(toolCallRaw);
      lastContent.parts!.push(toolResponse);
    } else {
      // Create new batch
      geminiRequest.contents.push({
        role: "model",
        parts: [toolCallRaw],
      });
      geminiRequest.contents.push({
        role: "user",
        parts: [toolResponse],
      });
    }

    return geminiRequest;
  }

  //
  // History Management
  //

  responseToHistoryItems(response: unknown): LlmHistory {
    const geminiResponse = response as GeminiRawResponse;
    const historyItems: LlmHistory = [];

    const candidate = geminiResponse.candidates?.[0];
    if (!candidate?.content?.parts) {
      return historyItems;
    }

    // Check if this is a function call response
    const hasFunctionCalls = candidate.content.parts.some(
      (part) => part.functionCall,
    );

    if (hasFunctionCalls) {
      // Don't add to history yet - will be added after tool execution
      return historyItems;
    }

    // Extract text content for non-tool responses
    const textParts = candidate.content.parts.filter(
      (part) => part.text && !part.thought,
    );

    if (textParts.length > 0) {
      const textContent = textParts.map((part) => part.text).join("");
      historyItems.push({
        content: textContent,
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
    const geminiError = error as GeminiErrorInfo;

    // Extract status code from error
    const statusCode = geminiError.status || geminiError.code;

    // Check for rate limit error (429)
    if (statusCode === 429) {
      return {
        error,
        category: ErrorCategory.RateLimit,
        shouldRetry: false,
        suggestedDelayMs: 60000,
      };
    }

    // Check for retryable errors
    if (
      typeof statusCode === "number" &&
      RETRYABLE_STATUS_CODES.includes(statusCode)
    ) {
      return {
        error,
        category: ErrorCategory.Retryable,
        shouldRetry: true,
      };
    }

    // Check for non-retryable errors
    if (
      typeof statusCode === "number" &&
      NOT_RETRYABLE_STATUS_CODES.includes(statusCode)
    ) {
      return {
        error,
        category: ErrorCategory.Unrecoverable,
        shouldRetry: false,
      };
    }

    // Check error message for common patterns
    const errorMessage = geminiError.message || String(error) || "";

    if (
      errorMessage.includes("rate limit") ||
      errorMessage.includes("quota exceeded")
    ) {
      return {
        error,
        category: ErrorCategory.RateLimit,
        shouldRetry: false,
        suggestedDelayMs: 60000,
      };
    }

    if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("connection") ||
      errorMessage.includes("ECONNREFUSED")
    ) {
      return {
        error,
        category: ErrorCategory.Retryable,
        shouldRetry: true,
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
    const geminiResponse = response as GeminiRawResponse;

    const candidate = geminiResponse.candidates?.[0];
    if (!candidate?.content?.parts) {
      return true;
    }

    // Check if there are any function calls
    const hasFunctionCalls = candidate.content.parts.some(
      (part) => part.functionCall,
    );

    return !hasFunctionCalls;
  }

  override hasStructuredOutput(response: unknown): boolean {
    const geminiResponse = response as GeminiRawResponse;

    const candidate = geminiResponse.candidates?.[0];
    if (!candidate?.content?.parts) {
      return false;
    }

    // Check if the last part is a function call with structured_output
    const lastPart =
      candidate.content.parts[candidate.content.parts.length - 1];
    return lastPart?.functionCall?.name === STRUCTURED_OUTPUT_TOOL_NAME;
  }

  override extractStructuredOutput(response: unknown): JsonObject | undefined {
    const geminiResponse = response as GeminiRawResponse;

    const candidate = geminiResponse.candidates?.[0];
    if (!candidate?.content?.parts) {
      return undefined;
    }

    const lastPart =
      candidate.content.parts[candidate.content.parts.length - 1];
    if (lastPart?.functionCall?.name === STRUCTURED_OUTPUT_TOOL_NAME) {
      return lastPart.functionCall.args as JsonObject;
    }

    return undefined;
  }

  //
  // Private Helpers
  //

  private convertMessagesToContents(messages: LlmHistory): GeminiContent[] {
    const contents: GeminiContent[] = [];

    for (const message of messages) {
      // Handle input/output messages
      if ("role" in message && "content" in message) {
        const role = this.mapRole(message.role as LlmMessageRole);
        const parts = this.convertContentToParts(message.content);

        contents.push({
          role,
          parts,
        });
      }
      // Handle function call items
      else if (
        "type" in message &&
        message.type === LlmMessageType.FunctionCall
      ) {
        // Build the function call part, including thoughtSignature if present
        // (required for Gemini 3 models)
        const functionCallPart: GeminiPart = {
          functionCall: {
            name: (message as any).name,
            args: JSON.parse((message as any).arguments || "{}"),
            id: (message as any).call_id,
          },
        };
        // Preserve thoughtSignature for Gemini 3 models
        if ((message as any).thoughtSignature) {
          functionCallPart.thoughtSignature = (message as any).thoughtSignature;
        }
        contents.push({
          role: "model",
          parts: [functionCallPart],
        });
      }
      // Handle function call output items
      else if (
        "type" in message &&
        message.type === LlmMessageType.FunctionCallOutput
      ) {
        // Parse the output to get the actual response object
        let responseData: Record<string, unknown>;
        try {
          responseData = JSON.parse((message as any).output || "{}");
        } catch {
          responseData = { result: (message as any).output };
        }

        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: (message as any).name || "function",
                response: responseData,
              },
            },
          ],
        });
      }
    }

    return contents;
  }

  private convertContentToParts(content: unknown): GeminiPart[] {
    // Handle string content
    if (typeof content === "string") {
      return [{ text: content }];
    }

    // Handle array content
    if (Array.isArray(content)) {
      const parts: GeminiPart[] = [];

      for (const item of content) {
        // Handle Gemini-native parts (already have inlineData, text, etc.)
        if (item.inlineData) {
          parts.push({ inlineData: item.inlineData });
          continue;
        }

        if (item.text && !item.type) {
          // Plain text part
          parts.push({ text: item.text });
          continue;
        }

        if (item.fileData) {
          parts.push({ fileData: item.fileData });
          continue;
        }

        // Handle standardized LlmInputContentText
        if (item.type === LlmMessageType.InputText) {
          parts.push({ text: item.text });
          continue;
        }

        // Handle standardized LlmInputContentImage
        if (item.type === LlmMessageType.InputImage) {
          const imageUrl = item.image_url as string;
          // Parse data URL format: data:image/png;base64,<data>
          if (imageUrl?.startsWith("data:")) {
            const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              parts.push({
                inlineData: {
                  mimeType: match[1],
                  data: match[2],
                },
              });
              continue;
            }
          }
          // If not a data URL, try to use as file URI
          if (imageUrl) {
            parts.push({
              fileData: {
                mimeType: "image/png",
                fileUri: imageUrl,
              },
            });
          }
          continue;
        }

        // Handle standardized LlmInputContentFile
        if (item.type === LlmMessageType.InputFile) {
          const fileData = item.file_data as string;
          // Parse data URL format: data:application/pdf;base64,<data>
          if (fileData?.startsWith("data:")) {
            const match = fileData.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              parts.push({
                inlineData: {
                  mimeType: match[1],
                  data: match[2],
                },
              });
              continue;
            }
          }
          // If not a data URL, just add as text (fallback)
          if (typeof fileData === "string") {
            parts.push({ text: `[File: ${item.filename || "unknown"}]` });
          }
          continue;
        }

        // Fallback: stringify unknown content
        parts.push({ text: JSON.stringify(item) });
      }

      return parts;
    }

    // Fallback for other types
    return [{ text: JSON.stringify(content) }];
  }

  private mapRole(role: LlmMessageRole): "user" | "model" {
    switch (role) {
      case LlmMessageRole.User:
      case LlmMessageRole.System:
      case LlmMessageRole.Developer:
        return "user";
      case LlmMessageRole.Assistant:
        return "model";
      default:
        return "user";
    }
  }

  private hasToolCalls(response: GeminiRawResponse): boolean {
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      return false;
    }

    return candidate.content.parts.some((part) => part.functionCall);
  }

  private getFinishReason(response: GeminiRawResponse): string | undefined {
    const candidate = response.candidates?.[0];
    return candidate?.finishReason;
  }

  private extractContent(
    response: GeminiRawResponse,
    options?: LlmOperateOptions,
  ): string | JsonObject | undefined {
    // Check for structured output first
    if (this.hasStructuredOutput(response)) {
      return this.extractStructuredOutput(response);
    }

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      return undefined;
    }

    // Extract text content (excluding thought parts)
    const textParts = candidate.content.parts.filter(
      (part) => part.text && !part.thought,
    );

    if (textParts.length === 0) {
      return undefined;
    }

    const textContent = textParts.map((part) => part.text).join("");

    // If format is provided, try to parse the content as JSON
    if (options?.format && typeof textContent === "string") {
      try {
        return JSON.parse(textContent);
      } catch {
        // Strip markdown code fences and retry (Gemini sometimes wraps JSON in fences)
        const jsonMatch =
          textContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
          textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[1] || jsonMatch[0]);
          } catch {
            // Fall through to return original string
          }
        }
        return textContent;
      }
    }

    return textContent;
  }

  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Export singleton instance
export const googleAdapter = new GoogleAdapter();
