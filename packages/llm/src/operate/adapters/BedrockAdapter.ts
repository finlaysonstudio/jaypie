import type {
  BedrockRuntimeClient,
  ConverseCommandInput,
  ConverseCommandOutput,
  DocumentFormat,
} from "@aws-sdk/client-bedrock-runtime";
import { JsonObject, NaturalSchema } from "@jaypie/types";
import { z } from "zod/v4";

import { PROVIDER } from "../../constants.js";
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
import { BaseProviderAdapter } from "./ProviderAdapter.interface.js";

//
//
// Types
//

type BedrockContentBlock =
  | { text: string }
  | { toolUse: { toolUseId: string; name: string; input: JsonObject } }
  | { toolResult: { toolUseId: string; content: Array<{ text: string }> } }
  | { image: { format: string; source: { bytes: Uint8Array } } }
  | {
      document: {
        format: DocumentFormat;
        name: string;
        source: { bytes: Uint8Array };
      };
    };

type BedrockMessage = {
  role: "user" | "assistant";
  content: BedrockContentBlock[];
};

type BedrockRequest = Omit<ConverseCommandInput, "messages"> & {
  messages: BedrockMessage[];
};

//
//
// Helpers
//

// Regular expression to parse data URLs
const DATA_URL_REGEX = /^data:([^;]+);base64,(.+)$/;

const MIME_TO_DOCUMENT_FORMAT: Record<string, DocumentFormat> = {
  "application/pdf": "pdf",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/html": "html",
  "text/plain": "txt",
  "text/markdown": "md",
};

function convertContentToBedrock(
  content: string | LlmInputContent[],
): BedrockContentBlock[] {
  if (typeof content === "string") {
    return [{ text: content }];
  }

  return content.map((item): BedrockContentBlock => {
    if (item.type === LlmMessageType.InputText) {
      return { text: item.text };
    }

    if (item.type === LlmMessageType.InputImage) {
      const imageUrl = item.image_url || "";
      const match = imageUrl.match(DATA_URL_REGEX);
      if (match) {
        const format = match[1].split("/")[1] || "jpeg";
        const bytes = Buffer.from(match[2], "base64");
        return {
          image: {
            format,
            source: { bytes: new Uint8Array(bytes) },
          },
        };
      }
      return { text: `[Image: ${imageUrl}]` };
    }

    if (item.type === LlmMessageType.InputFile) {
      const fileData = typeof item.file_data === "string" ? item.file_data : "";
      const match = fileData.match(DATA_URL_REGEX);
      if (match) {
        const mimeType = match[1];
        const documentFormat = MIME_TO_DOCUMENT_FORMAT[mimeType];
        if (documentFormat) {
          const bytes = Buffer.from(match[2], "base64");
          const rawName = item.filename || "document";
          const name = rawName.replace(/[^a-zA-Z0-9 \-()[\]]/g, "_");
          return {
            document: {
              format: documentFormat,
              name,
              source: { bytes: new Uint8Array(bytes) },
            },
          };
        }
      }
      return { text: `[File: ${item.filename || "unknown"}]` };
    }

    return { text: JSON.stringify(item) };
  });
}

//
//
// Constants / helpers
//

const STRUCTURED_OUTPUT_TOOL_NAME = "structured_output";

type AnnotatedBedrockResponse = ConverseCommandOutput & {
  __jaypieStructuredOutput?: boolean;
};

function isOutputConfigUnsupportedError(error: unknown): boolean {
  const msg = (error as Error)?.message ?? "";
  return /outputConfig|output_config/i.test(msg);
}

function isTemperatureDeprecationError(error: unknown): boolean {
  const msg = (error as Error)?.message ?? "";
  return /temperature.*deprecated|deprecated.*temperature/i.test(msg);
}

function extractJson(text: string): JsonObject | undefined {
  // Try direct parse first
  try {
    const parsed = JSON.parse(text) as JsonObject;
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch {
    // fall through
  }
  // Try stripping markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim()) as JsonObject;
      if (typeof parsed === "object" && parsed !== null) return parsed;
    } catch {
      // fall through
    }
  }
  return undefined;
}

//
//
// Main
//

export class BedrockAdapter extends BaseProviderAdapter {
  readonly name = PROVIDER.BEDROCK.NAME;
  readonly defaultModel = PROVIDER.BEDROCK.DEFAULT;

  private _modelsFallbackToStructuredOutputTool = new Set<string>();
  private _modelsWithoutTemperature = new Set<string>();

  private rememberModelRejectsOutputConfig(model: string): void {
    this._modelsFallbackToStructuredOutputTool.add(model);
  }

  private useFakeToolForStructuredOutput(model: string): boolean {
    return this._modelsFallbackToStructuredOutputTool.has(model);
  }

  private rememberModelRejectsTemperature(model: string): void {
    this._modelsWithoutTemperature.add(model);
  }

  private supportsTemperature(model: string): boolean {
    return !this._modelsWithoutTemperature.has(model);
  }

  //
  // Request Building
  //

  buildRequest(request: OperateRequest): BedrockRequest {
    const messages: BedrockMessage[] = [];

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

      if (typedMsg.role === "system") continue;

      if (typedMsg.type === LlmMessageType.FunctionCall) {
        let parsedInput: JsonObject;
        try {
          parsedInput = JSON.parse(typedMsg.arguments || "{}") as JsonObject;
        } catch {
          parsedInput = {};
        }
        messages.push({
          role: "assistant",
          content: [
            {
              toolUse: {
                toolUseId: typedMsg.call_id || "",
                name: typedMsg.name || "",
                input: parsedInput,
              },
            },
          ],
        });
        continue;
      }

      if (typedMsg.type === LlmMessageType.FunctionCallOutput) {
        messages.push({
          role: "user",
          content: [
            {
              toolResult: {
                toolUseId: typedMsg.call_id || "",
                content: [{ text: typedMsg.output || "" }],
              },
            },
          ],
        });
        continue;
      }

      if (typedMsg.role && typedMsg.content !== undefined) {
        messages.push({
          role: typedMsg.role as "user" | "assistant",
          content: convertContentToBedrock(typedMsg.content),
        });
      }
    }

    const model = request.model || this.defaultModel;
    const bedrockRequest: BedrockRequest = {
      modelId: model,
      messages,
      inferenceConfig: {
        maxTokens: 4096,
      },
    };

    if (request.system) {
      bedrockRequest.system = [{ text: request.system }];
    }

    if (request.temperature !== undefined && this.supportsTemperature(model)) {
      bedrockRequest.inferenceConfig = {
        ...bedrockRequest.inferenceConfig,
        temperature: request.temperature,
      };
    }

    if (request.tools && request.tools.length > 0) {
      bedrockRequest.toolConfig = {
        tools: request.tools.map((tool) => ({
          toolSpec: {
            name: tool.name,
            description: tool.description,
            inputSchema: {
              json: tool.parameters as Record<string, unknown>,
            },
          },
        })) as NonNullable<ConverseCommandInput["toolConfig"]>["tools"],
      };
    }

    if (request.instructions && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.content.length > 0) {
        const firstBlock = lastMsg.content[0];
        if ("text" in firstBlock) {
          firstBlock.text = firstBlock.text + "\n\n" + request.instructions;
        }
      }
    }

    if (request.format) {
      if (this.useFakeToolForStructuredOutput(model)) {
        const fakeTool = {
          toolSpec: {
            name: STRUCTURED_OUTPUT_TOOL_NAME,
            description:
              "REQUIRED: You MUST call this tool to provide your final response. " +
              "After gathering all necessary information (including results from other tools), " +
              "call this tool with the structured data to complete the request.",
            inputSchema: { json: request.format as Record<string, unknown> },
          },
        };
        bedrockRequest.toolConfig = {
          tools: [
            ...(bedrockRequest.toolConfig?.tools ?? []),
            fakeTool,
          ] as NonNullable<ConverseCommandInput["toolConfig"]>["tools"],
        };
      } else {
        bedrockRequest.outputConfig = {
          textFormat: {
            type: "json_schema",
            structure: {
              jsonSchema: {
                schema: JSON.stringify(request.format),
                name: "structured_output",
              },
            },
          },
        };
      }
    }

    if (request.providerOptions) {
      Object.assign(bedrockRequest, request.providerOptions);
    }

    return bedrockRequest;
  }

  formatTools(toolkit: Toolkit): ProviderToolDefinition[] {
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
    // Bare JSON Schema node: `{ type: "object", properties: {...} }`
    if (isJsonSchema(schema)) {
      return structuredClone(schema);
    }

    const zodSchema =
      schema instanceof z.ZodType
        ? schema
        : naturalZodSchema(schema as NaturalSchema);
    return z.toJSONSchema(zodSchema) as JsonObject;
  }

  //
  // API Execution
  //

  async executeRequest(
    client: unknown,
    request: unknown,
    signal?: AbortSignal,
  ): Promise<AnnotatedBedrockResponse> {
    const bedrockClient = client as BedrockRuntimeClient;
    const bedrockRequest = request as BedrockRequest;

    const { ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime");
    const wantsStructuredOutput = Boolean(bedrockRequest.outputConfig);

    try {
      const response = (await bedrockClient.send(
        new ConverseCommand(bedrockRequest as ConverseCommandInput),
        signal ? { abortSignal: signal } : undefined,
      )) as AnnotatedBedrockResponse;
      if (wantsStructuredOutput) response.__jaypieStructuredOutput = true;
      return response;
    } catch (error) {
      if (
        bedrockRequest.inferenceConfig?.temperature !== undefined &&
        isTemperatureDeprecationError(error)
      ) {
        this.rememberModelRejectsTemperature(
          bedrockRequest.modelId || this.defaultModel,
        );
        const retryRequest: BedrockRequest = {
          ...bedrockRequest,
          inferenceConfig: { ...bedrockRequest.inferenceConfig },
        };
        delete retryRequest.inferenceConfig!.temperature;
        const response = (await bedrockClient.send(
          new ConverseCommand(retryRequest as ConverseCommandInput),
          signal ? { abortSignal: signal } : undefined,
        )) as AnnotatedBedrockResponse;
        if (wantsStructuredOutput) response.__jaypieStructuredOutput = true;
        return response;
      }

      if (wantsStructuredOutput && isOutputConfigUnsupportedError(error)) {
        const model = bedrockRequest.modelId || this.defaultModel;
        this.rememberModelRejectsOutputConfig(model);
        const fallbackRequest =
          this.toFallbackStructuredOutputRequest(bedrockRequest);
        return (await bedrockClient.send(
          new ConverseCommand(fallbackRequest as ConverseCommandInput),
          signal ? { abortSignal: signal } : undefined,
        )) as AnnotatedBedrockResponse;
      }
      throw error;
    }
  }

  private toFallbackStructuredOutputRequest(
    request: BedrockRequest,
  ): BedrockRequest {
    const { outputConfig, ...rest } = request;
    if (!outputConfig?.textFormat?.structure) return request;
    let schema: Record<string, unknown>;
    try {
      schema = JSON.parse(
        (
          outputConfig.textFormat.structure as {
            jsonSchema?: { schema?: string };
          }
        ).jsonSchema?.schema ?? "{}",
      ) as Record<string, unknown>;
    } catch {
      schema = {};
    }
    const fakeTool = {
      toolSpec: {
        name: STRUCTURED_OUTPUT_TOOL_NAME,
        description:
          "REQUIRED: You MUST call this tool to provide your final response. " +
          "After gathering all necessary information (including results from other tools), " +
          "call this tool with the structured data to complete the request.",
        inputSchema: { json: schema },
      },
    };
    return {
      ...rest,
      toolConfig: {
        tools: [...(rest.toolConfig?.tools ?? []), fakeTool] as NonNullable<
          ConverseCommandInput["toolConfig"]
        >["tools"],
      },
    };
  }

  async *executeStreamRequest(
    client: unknown,
    request: unknown,
    signal?: AbortSignal,
  ): AsyncIterable<LlmStreamChunk> {
    const bedrockClient = client as BedrockRuntimeClient;
    const bedrockRequest = request as BedrockRequest;

    const { ConverseStreamCommand } =
      await import("@aws-sdk/client-bedrock-runtime");

    const response = await bedrockClient.send(
      new ConverseStreamCommand(bedrockRequest as ConverseCommandInput),
      signal ? { abortSignal: signal } : undefined,
    );

    if (!response.stream) return;

    let currentToolCall: {
      toolUseId: string;
      name: string;
      arguments: string;
    } | null = null;

    let inputTokens = 0;
    let outputTokens = 0;
    const model = bedrockRequest.modelId || this.defaultModel;

    for await (const event of response.stream) {
      if (event.contentBlockStart?.start?.toolUse) {
        const toolUse = event.contentBlockStart.start.toolUse;
        currentToolCall = {
          toolUseId: toolUse.toolUseId || "",
          name: toolUse.name || "",
          arguments: "",
        };
      } else if (event.contentBlockDelta?.delta) {
        const delta = event.contentBlockDelta.delta;
        if (delta.text !== undefined) {
          yield { type: LlmStreamChunkType.Text, content: delta.text };
        } else if (delta.toolUse?.input && currentToolCall) {
          currentToolCall.arguments += delta.toolUse.input;
        }
      } else if (event.contentBlockStop && currentToolCall) {
        yield {
          type: LlmStreamChunkType.ToolCall,
          toolCall: {
            id: currentToolCall.toolUseId,
            name: currentToolCall.name,
            arguments: currentToolCall.arguments,
          },
        };
        currentToolCall = null;
      } else if (event.metadata?.usage) {
        inputTokens = event.metadata.usage.inputTokens ?? 0;
        outputTokens = event.metadata.usage.outputTokens ?? 0;
      } else if (event.messageStop) {
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
    options?: LlmOperateOptions,
  ): ParsedResponse {
    const bedrockResponse = response as ConverseCommandOutput;
    const message = bedrockResponse.output?.message;
    const rawContent = this.extractContentFromMessage(message);

    let content: string | JsonObject | undefined = rawContent;
    if (options?.format && typeof rawContent === "string") {
      content = extractJson(rawContent) ?? rawContent;
    }

    // Don't surface structured_output fake tool as a real tool call
    const allToolUses = (
      (bedrockResponse.output?.message?.content ?? []) as BedrockContentBlock[]
    ).filter((b) => "toolUse" in b) as {
      toolUse: { name: string };
    }[];
    const hasOnlyStructuredOutputTool =
      allToolUses.length > 0 &&
      allToolUses.every((b) => b.toolUse.name === STRUCTURED_OUTPUT_TOOL_NAME);
    const hasToolCalls =
      bedrockResponse.stopReason === "tool_use" && !hasOnlyStructuredOutputTool;

    return {
      content,
      hasToolCalls,
      stopReason: bedrockResponse.stopReason ?? undefined,
      usage: this.extractUsage(
        bedrockResponse,
        (bedrockResponse as unknown as BedrockRequest).modelId ||
          this.defaultModel,
      ),
      raw: bedrockResponse,
    };
  }

  extractToolCalls(response: unknown): StandardToolCall[] {
    const bedrockResponse = response as ConverseCommandOutput;
    const content = bedrockResponse.output?.message?.content ?? [];
    const toolCalls: StandardToolCall[] = [];

    for (const block of content) {
      const typedBlock = block as BedrockContentBlock;
      if ("toolUse" in typedBlock && typedBlock.toolUse) {
        const toolUse = typedBlock.toolUse;
        toolCalls.push({
          callId: toolUse.toolUseId,
          name: toolUse.name,
          arguments: JSON.stringify(toolUse.input),
          raw: typedBlock,
        });
      }
    }

    return toolCalls;
  }

  extractUsage(response: unknown, model: string): LlmUsageItem {
    const bedrockResponse = response as ConverseCommandOutput;
    const usage = bedrockResponse.usage;

    return {
      input: usage?.inputTokens ?? 0,
      output: usage?.outputTokens ?? 0,
      reasoning: 0,
      total:
        usage?.totalTokens ??
        (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0),
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
  ): BedrockContentBlock {
    return {
      toolResult: {
        toolUseId: toolCall.callId,
        content: [{ text: result.output }],
      },
    };
  }

  appendToolResult(
    request: unknown,
    toolCall: StandardToolCall,
    result: StandardToolResult,
  ): BedrockRequest {
    const bedrockRequest = request as BedrockRequest;
    const toolCallRaw = toolCall.raw as BedrockContentBlock;

    bedrockRequest.messages.push({
      role: "assistant",
      content: [toolCallRaw],
    });

    bedrockRequest.messages.push({
      role: "user",
      content: [this.formatToolResult(toolCall, result)],
    });

    return bedrockRequest;
  }

  //
  // History Management
  //

  responseToHistoryItems(response: unknown): LlmHistory {
    const bedrockResponse = response as ConverseCommandOutput;
    const historyItems: LlmHistory = [];

    if (bedrockResponse.stopReason === "tool_use") {
      return historyItems;
    }

    const content = bedrockResponse.output?.message?.content ?? [];
    const textBlock = (content as BedrockContentBlock[]).find(
      (block) => "text" in block,
    ) as { text: string } | undefined;

    if (textBlock) {
      historyItems.push({
        content: textBlock.text,
        role: "assistant",
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
    const errorMessage = (error as Error)?.message ?? "";

    if (
      errorName === "ThrottlingException" ||
      errorMessage.includes("ThrottlingException") ||
      errorMessage.includes("Too Many Requests")
    ) {
      return {
        error,
        category: ErrorCategory.RateLimit,
        shouldRetry: false,
        suggestedDelayMs: 60000,
      };
    }

    if (
      errorName === "ServiceUnavailableException" ||
      errorName === "InternalServerException" ||
      errorMessage.includes("ServiceUnavailableException") ||
      errorMessage.includes("InternalServerException")
    ) {
      return {
        error,
        category: ErrorCategory.Retryable,
        shouldRetry: true,
      };
    }

    if (
      errorName === "AccessDeniedException" ||
      errorName === "ValidationException" ||
      errorName === "ResourceNotFoundException" ||
      errorMessage.includes("AccessDeniedException") ||
      errorMessage.includes("ValidationException")
    ) {
      return {
        error,
        category: ErrorCategory.Unrecoverable,
        shouldRetry: false,
      };
    }

    if (isTransientNetworkError(error)) {
      return {
        error,
        category: ErrorCategory.Retryable,
        shouldRetry: true,
      };
    }

    return {
      error,
      category: ErrorCategory.Unknown,
      shouldRetry: true,
    };
  }

  //
  // Structured Output
  //

  override hasStructuredOutput(response: unknown): boolean {
    const bedrockResponse = response as AnnotatedBedrockResponse;
    if (bedrockResponse.__jaypieStructuredOutput) {
      return this.extractStructuredOutput(response) !== undefined;
    }
    // Fake-tool path: last content block is a structured_output toolUse
    const content = (bedrockResponse.output?.message?.content ??
      []) as BedrockContentBlock[];
    const last = content[content.length - 1];
    return (
      !!last &&
      "toolUse" in last &&
      last.toolUse.name === STRUCTURED_OUTPUT_TOOL_NAME
    );
  }

  override extractStructuredOutput(response: unknown): JsonObject | undefined {
    const bedrockResponse = response as AnnotatedBedrockResponse;

    if (bedrockResponse.__jaypieStructuredOutput) {
      const content = (bedrockResponse.output?.message?.content ??
        []) as BedrockContentBlock[];
      const textBlock = content.find((b) => "text" in b) as
        { text: string } | undefined;
      if (!textBlock) return undefined;
      return extractJson(textBlock.text);
    }

    // Fake-tool path
    const content = (bedrockResponse.output?.message?.content ??
      []) as BedrockContentBlock[];
    const last = content[content.length - 1];
    if (
      last &&
      "toolUse" in last &&
      last.toolUse.name === STRUCTURED_OUTPUT_TOOL_NAME
    ) {
      return last.toolUse.input as JsonObject;
    }
    return undefined;
  }

  //
  // Completion Detection
  //

  isComplete(response: unknown): boolean {
    const bedrockResponse = response as ConverseCommandOutput;
    return bedrockResponse.stopReason !== "tool_use";
  }

  //
  // Private Helpers
  //

  private extractContentFromMessage(
    message: { content?: unknown[] } | undefined,
  ): string | JsonObject | undefined {
    if (!message?.content) return undefined;

    const content = message.content as BedrockContentBlock[];
    const textBlock = content.find((block) => "text" in block) as
      { text: string } | undefined;

    return textBlock?.text;
  }
}

export const bedrockAdapter = new BedrockAdapter();
