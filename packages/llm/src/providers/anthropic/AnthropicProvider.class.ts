import type Anthropic from "@anthropic-ai/sdk";
import { JsonObject } from "@jaypie/types";
import { PROVIDER } from "../../constants.js";
import {
  anthropicAdapter,
  createOperateLoop,
  createStreamLoop,
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
  createStructuredCompletion,
  createTextCompletion,
  formatSystemMessage,
  getLogger,
  initializeClient,
  prepareMessages,
} from "./index.js";

// Main class implementation
export class AnthropicProvider implements LlmProvider {
  private model: string;
  private _client?: Anthropic;
  private _operateLoop?: OperateLoop;
  private _streamLoop?: StreamLoop;
  private apiKey?: string;
  private log = getLogger();
  private conversationHistory: LlmHistoryItem[] = [];

  constructor(
    model: string = PROVIDER.ANTHROPIC.MODEL.DEFAULT,
    { apiKey }: { apiKey?: string } = {},
  ) {
    this.model = model;
    this.apiKey = apiKey;
  }

  private async getClient(): Promise<Anthropic> {
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
      adapter: anthropicAdapter,
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
      adapter: anthropicAdapter,
      client,
    });
    return this._streamLoop;
  }

  // Main send method
  async send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject> {
    const client = await this.getClient();
    const messages = prepareMessages(message, options || {});
    const modelToUse = options?.model || this.model;

    // Process system message if provided
    let systemMessage: string | undefined;
    if (options?.system) {
      systemMessage = formatSystemMessage(options.system, {
        data: options.data,
        placeholders: options.placeholders,
      });
    }

    if (options?.response) {
      return createStructuredCompletion(
        client,
        messages,
        modelToUse,
        options.response,
        systemMessage,
      );
    }

    return createTextCompletion(client, messages, modelToUse, systemMessage);
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
