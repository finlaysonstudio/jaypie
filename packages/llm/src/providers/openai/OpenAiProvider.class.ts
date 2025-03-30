import { JsonObject } from "@jaypie/types";
import { OpenAI } from "openai";
import { PROVIDER } from "../../constants.js";
import {
  LlmMessageOptions,
  LlmOperateOptions,
  LlmProvider,
} from "../../types/LlmProvider.interface.js";
import { operate, formatInput } from "./operate.js";
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
    input: string | JsonObject | JsonObject[],
    options: LlmOperateOptions = {},
  ): Promise<JsonObject[]> {
    const client = await this.getClient();
    options.model = options?.model || this.model;

    // Format the input to ensure consistent format
    const formattedInput = formatInput(input, { data: options?.data });

    // Create a merged history including both the tracked history and any explicitly provided history
    const mergedHistory = [...this.conversationHistory];
    if (options?.history && Array.isArray(options.history)) {
      mergedHistory.push(...options.history);
    }

    // Set the merged history in the options
    const optionsWithHistory: LlmOperateOptions = {
      ...options,
      history: mergedHistory,
    };

    // Call operate with the updated options
    const response = await operate(input, optionsWithHistory, { client });

    // Update conversation history with the input and response
    this.updateConversationHistory(formattedInput, response);

    return response;
  }

  /**
   * Updates the conversation history with the latest input and response
   * @param input The formatted input messages
   * @param response The response from the model
   */
  private updateConversationHistory(
    input: JsonObject[],
    response: JsonObject[],
  ): void {
    // Add the input to history
    this.conversationHistory.push(...input);

    // Add the response to history if it exists and has content
    if (response && response.length > 0) {
      // Extract the last response item and add it to history
      const lastResponse = response[response.length - 1];
      if (lastResponse) {
        this.conversationHistory.push(lastResponse);
      }
    }
  }
}
