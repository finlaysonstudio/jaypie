import { JsonObject } from "@jaypie/types";
import type { OpenRouter } from "@openrouter/sdk";
import {
  createOperateLoop,
  createStreamLoop,
  OperateLoop,
  openRouterAdapter,
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

export class OpenRouterProvider implements LlmProvider {
  private model: string;
  private _client?: OpenRouter;
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

  private async getClient(): Promise<OpenRouter> {
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
      adapter: openRouterAdapter,
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
      adapter: openRouterAdapter,
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

    // Build the request
    const response = await client.chat.send({
      model: modelToUse,
      messages: messages as Parameters<typeof client.chat.send>[0]["messages"],
    });

    const rawContent = response.choices?.[0]?.message?.content;
    // Extract text content - content could be string or array of content items
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
      // If options.history exists, merge with instance history, otherwise use instance history
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
}
