import { JsonObject } from "@jaypie/types";
import type { MistralClient, OcrRequest } from "./client.js";
import {
  createOperateLoop,
  createStreamLoop,
  mistralAdapter,
  OperateLoop,
  StreamLoop,
} from "../../operate/index.js";
import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageOptions,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmProvider,
  LlmHistoryItem,
} from "../../types/LlmProvider.interface.js";
import { LlmStreamChunk } from "../../types/LlmStreamChunk.interface.js";
import {
  getDefaultModel,
  getLogger,
  initializeClient,
  prepareMessages,
} from "./utils.js";

export interface MistralOcrPage {
  index: number;
  markdown: string;
  [key: string]: unknown;
}

export interface MistralOcrResponse {
  /** Every page's markdown joined with a blank line, for the common case. */
  markdown: string;
  model?: string;
  pages: MistralOcrPage[];
  /** The unmodified API response, for callers wanting block geometry. */
  raw: JsonObject;
}

export class MistralProvider implements LlmProvider {
  private model: string;
  private _client?: MistralClient;
  private _operateLoop?: OperateLoop;
  private _streamLoop?: StreamLoop;
  private apiKey?: string;
  private log = getLogger();
  private conversationHistory: LlmHistoryItem[] = [];

  constructor(
    model: string = getDefaultModel(),
    { apiKey }: { apiKey?: string } = {},
  ) {
    this.model = model;
    this.apiKey = apiKey;
  }

  private async getClient(): Promise<MistralClient> {
    if (this._client) {
      return this._client;
    }

    this._client = await initializeClient({ apiKey: this.apiKey });
    return this._client;
  }

  private async getOperateLoop(): Promise<OperateLoop> {
    if (this._operateLoop) {
      return this._operateLoop;
    }

    const client = await this.getClient();
    this._operateLoop = createOperateLoop({
      adapter: mistralAdapter,
      client,
    });
    return this._operateLoop;
  }

  private async getStreamLoop(): Promise<StreamLoop> {
    if (this._streamLoop) {
      return this._streamLoop;
    }

    const client = await this.getClient();
    this._streamLoop = createStreamLoop({
      adapter: mistralAdapter,
      client,
    });
    return this._streamLoop;
  }

  async send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject> {
    const client = await this.getClient();
    const messages = prepareMessages(message, options);
    const modelToUse = options?.model || this.model;

    // OpenAI-compatible Chat Completions body; messages are already wire-shaped.
    const response = await client.chatCompletion({
      model: modelToUse,
      messages,
    });

    const choices = response.choices as
      Array<{ message?: { content?: unknown } }> | undefined;
    const rawContent = choices?.[0]?.message?.content;
    // Content is a string unless reasoning is on, in which case it is an array
    // of chunks (a `thinking` chunk followed by a `text` chunk).
    const content =
      typeof rawContent === "string"
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent
              .filter((item) => item.type === "text")
              .map((item) => (item as { text: string }).text)
              .join("")
          : "";

    this.log.trace(`Assistant reply: ${content?.length || 0} characters`);

    // If structured output was requested, try to parse the response
    if (options?.response && content) {
      try {
        return JSON.parse(content);
      } catch {
        return content || "";
      }
    }

    return content || "";
  }

  async operate(
    input: string | LlmHistory | LlmInputMessage,
    options: LlmOperateOptions = {},
  ): Promise<LlmOperateResponse> {
    const operateLoop = await this.getOperateLoop();
    const mergedOptions = { ...options, model: options.model ?? this.model };

    // Create a merged history including both the tracked history and any explicitly provided history
    if (this.conversationHistory.length > 0) {
      mergedOptions.history = options.history
        ? [...this.conversationHistory, ...options.history]
        : [...this.conversationHistory];
    }

    // Execute operate loop
    const response = await operateLoop.execute(input, mergedOptions);

    // Update conversation history with the new history from the response
    if (response.history && response.history.length > 0) {
      this.conversationHistory = response.history;
    }

    return response;
  }

  async *stream(
    input: string | LlmHistory | LlmInputMessage,
    options: LlmOperateOptions = {},
  ): AsyncIterable<LlmStreamChunk> {
    const streamLoop = await this.getStreamLoop();
    const mergedOptions = { ...options, model: options.model ?? this.model };

    // Create a merged history including both the tracked history and any explicitly provided history
    if (this.conversationHistory.length > 0) {
      mergedOptions.history = options.history
        ? [...this.conversationHistory, ...options.history]
        : [...this.conversationHistory];
    }

    // Execute stream loop
    yield* streamLoop.execute(input, mergedOptions);
  }

  /**
   * Extract a document with Mistral's OCR models.
   *
   * OCR is a document-processing route (`POST /v1/ocr`) rather than a chat
   * completion, so it lives outside the `LlmProvider` interface and is reached
   * on the provider directly rather than through the `Llm` facade.
   */
  async ocr(request: OcrRequest): Promise<MistralOcrResponse> {
    const client = await this.getClient();
    const raw = await client.ocr(request);
    const pages = (raw.pages as MistralOcrPage[] | undefined) ?? [];
    const markdown = pages.map((page) => page.markdown ?? "").join("\n\n");

    this.log.trace(`OCR extracted ${pages.length} page(s)`);

    return {
      markdown,
      model: raw.model as string | undefined,
      pages,
      raw,
    };
  }
}
