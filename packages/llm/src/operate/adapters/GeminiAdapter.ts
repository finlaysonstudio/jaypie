import { GoogleGenAI } from "@google/genai";
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
import {
  GeminiContent,
  GeminiErrorInfo,
  GeminiFunctionCall,
  GeminiFunctionDeclaration,
  GeminiPart,
  GeminiRawResponse,
  GeminiRequest,
} from "../../providers/gemini/types.js";

//
//
// Constants
//

const STRUCTURED_OUTPUT_TOOL_NAME = "structured_output";

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
 * GeminiAdapter implements the ProviderAdapter interface for Google's Gemini API.
 * It handles request building, response parsing, and error classification
 * specific to Gemini's generateContent API.
 */
export class GeminiAdapter extends BaseProviderAdapter {
  readonly name = PROVIDER.GEMINI.NAME;
  readonly defaultModel = PROVIDER.GEMINI.MODEL.DEFAULT;

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

    // Add tools if provided
    if (request.tools && request.tools.length > 0) {
      const functionDeclarations: GeminiFunctionDeclaration[] =
        request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        }));

      geminiRequest.config = {
        ...geminiRequest.config,
        tools: [{ functionDeclarations }],
      };
    }

    // Add structured output format if provided (but NOT when tools are present)
    // Gemini doesn't support combining function calling with responseMimeType: 'application/json'
    // When tools are present, structured output is handled via the structured_output tool
    if (request.format && !(request.tools && request.tools.length > 0)) {
      geminiRequest.config = {
        ...geminiRequest.config,
        responseMimeType: "application/json",
        responseJsonSchema: request.format,
      };
    }

    // When format is specified with tools, add instruction to use structured_output tool
    if (request.format && request.tools && request.tools.length > 0) {
      const structuredOutputInstruction =
        "IMPORTANT: Before providing your final response, you MUST use the structured_output tool " +
        "to output your answer in the required JSON format.";

      // Add to system instruction if it exists, otherwise create one
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

    return geminiRequest;
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
      jsonSchema.type = "object";
    } else {
      // Convert NaturalSchema to JSON schema through Zod
      const zodSchema =
        schema instanceof z.ZodType
          ? schema
          : naturalZodSchema(schema as NaturalSchema);
      jsonSchema = z.toJSONSchema(zodSchema) as JsonObject;
    }

    // Remove $schema property (Gemini doesn't need it)
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
  ): Promise<GeminiRawResponse> {
    const genAI = client as GoogleGenAI;
    const geminiRequest = request as GeminiRequest;

    // Cast config to any to bypass strict type checking between our internal types
    // and the SDK's types. The SDK will validate at runtime.
    const response = await genAI.models.generateContent({
      model: geminiRequest.model,
      contents: geminiRequest.contents as any,
      config: geminiRequest.config as any,
    });

    return response as unknown as GeminiRawResponse;
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
    // Gemini expects the response to be the actual result object, not wrapped in "result"
    // The output from StandardToolResult is JSON-stringified, so we need to parse it
    let responseData: Record<string, unknown>;
    try {
      responseData = JSON.parse(result.output);
    } catch {
      // If parsing fails, wrap the output as a string result
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
        const content =
          typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content);

        contents.push({
          role,
          parts: [{ text: content }],
        });
      }
      // Handle function call items
      else if (
        "type" in message &&
        message.type === LlmMessageType.FunctionCall
      ) {
        contents.push({
          role: "model",
          parts: [
            {
              functionCall: {
                name: (message as any).name,
                args: JSON.parse((message as any).arguments || "{}"),
                id: (message as any).call_id,
              },
            },
          ],
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
        // If parsing fails, return the original string
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
export const geminiAdapter = new GeminiAdapter();
