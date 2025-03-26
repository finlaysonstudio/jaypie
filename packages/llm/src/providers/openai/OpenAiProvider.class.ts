import { JsonObject } from "@jaypie/types";
import { OpenAI } from "openai";
import { PROVIDER } from "../../constants.js";
import {
  LlmMessageOptions,
  LlmOperateOptions,
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

    return operate(input, options, { client });
  }
}
