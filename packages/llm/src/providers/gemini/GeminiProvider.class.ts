import { JsonObject } from "@jaypie/types";
import type { GoogleGenAI } from "@google/genai";
import { PROVIDER } from "../../constants.js";
import {
  createOperateLoop,
  OperateLoop,
  geminiAdapter,
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
import { getLogger, initializeClient, prepareMessages } from "./utils.js";

export class GeminiProvider implements LlmProvider {
  private model: string;
  private _client?: GoogleGenAI;
  private _operateLoop?: OperateLoop;
  private apiKey?: string;
  private log = getLogger();
  private conversationHistory: LlmHistoryItem[] = [];

  constructor(
    model: string = PROVIDER.GEMINI.MODEL.DEFAULT,
    { apiKey }: { apiKey?: string } = {},
  ) {
    this.model = model;
    this.apiKey = apiKey;
  }

  private async getClient(): Promise<GoogleGenAI> {
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
      adapter: geminiAdapter,
      client,
    });
    return this._operateLoop;
  }

  async send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject> {
    const client = await this.getClient();
    const { messages } = prepareMessages(message, options);
    const modelToUse = options?.model || this.model;

    // Build the request config
    const config: Record<string, unknown> = {};

    if (options?.system) {
      config.systemInstruction = options.system;
    }

    // Handle structured output via responseSchema
    if (options?.response) {
      config.responseMimeType = "application/json";
      // Convert the response schema to JSON schema format
      // Note: For simple send() calls, we'll use Gemini's native JSON response
    }

    const response = await client.models.generateContent({
      model: modelToUse,
      contents: messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      })),
      config: Object.keys(config).length > 0 ? config : undefined,
    });

    const text = response.text;
    this.log.trace(`Assistant reply: ${text?.length || 0} characters`);

    // If structured output was requested, try to parse the response
    if (options?.response && text) {
      try {
        return JSON.parse(text);
      } catch {
        return text || "";
      }
    }

    return text || "";
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
}
