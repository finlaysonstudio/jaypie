import { JsonObject, NaturalSchema } from "@jaypie/types";
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

import { PROVIDER } from "../../constants";
import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageOptions,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmProvider,
  LlmHistoryItem,
} from "../../types/LlmProvider.interface.js";
import { operate } from "./operate.js";
import {
  getLogger,
  initializeClient,
  prepareMessages,
  formatSystemMessage,
  createTextCompletion,
  createStructuredCompletion,
} from "./index.js";

// Main class implementation
export class OpenRouterProvider implements LlmProvider {
  private model: string;
  private _client?: OpenRouterProvider;
  private apiKey?: string;
  private log = getLogger();
  private conversationHistory: LlmHistoryItem[] = [];

  constructor(
    model: string = PROVIDER.OPENROUTER.MODEL.DEFAULT,
    { apiKey }: { apiKey?: string } = {},
  ) {
    this.model = model;
    this.apiKey = apiKey;
  }

  private async getClient(): Promise<OpenRouterProvider> {
    if (this._client) {
      return this._client;
    }

    const newClient = await initializeClient({ apiKey: this.apiKey });
    if (!newClient) {
      throw new Error("Failed to initialize OpenRouter client");
    }

    this._client = newClient as unknown as OpenRouterProvider;
    return this._client;
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
    const client = await this.getClient();
    options.model = options?.model || this.model;

    // Create a merged history including both the tracked history and any explicitly provided history
    const mergedOptions = { ...options };
    if (this.conversationHistory.length > 0) {
      // If options.history exists, merge with instance history, otherwise use instance history
      mergedOptions.history = options.history
        ? [...this.conversationHistory, ...options.history]
        : [...this.conversationHistory];
    }

    // Call operate with the updated options
    const response = await operate(input, mergedOptions, { client });

    // Update conversation history with the new history from the response
    if (response.history && response.history.length > 0) {
      this.conversationHistory = response.history;
    }

    return response;
  }
}
