import { JsonObject } from "@jaypie/types";
import { OpenAI } from "openai";
import { PROVIDER } from "../../constants.js";
import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageOptions,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmProvider,
} from "../../types/LlmProvider.interface.js";
import { operate } from "./operate.js";
import {
  createStructuredCompletion,
  createTextCompletion,
  getLogger,
  initializeClient,
  prepareMessages,
} from "./utils.js";

export class OpenAiProvider implements LlmProvider {
  private model: string;
  private _client?: OpenAI;
  private apiKey?: string;
  private log = getLogger();
  private conversationHistory: JsonObject[] = [];

  constructor(
    model: string = PROVIDER.OPENAI.MODEL.DEFAULT,
    { apiKey }: { apiKey?: string } = {},
  ) {
    this.model = model;
    this.apiKey = apiKey;
  }

  private async getClient(): Promise<OpenAI> {
    if (this._client) {
      return this._client;
    }

    this._client = await initializeClient({ apiKey: this.apiKey });
    return this._client;
  }

  async send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject> {
    const client = await this.getClient();
    const messages = prepareMessages(message, options || {});
    const modelToUse = options?.model || this.model;

    if (options?.response) {
      return createStructuredCompletion(client, {
        messages,
        responseSchema: options.response,
        model: modelToUse,
      });
    }

    return createTextCompletion(client, {
      messages,
      model: modelToUse,
    });
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
