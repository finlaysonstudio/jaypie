import { JsonArray, JsonObject } from "@jaypie/types";
import { NotImplementedError } from "@jaypie/errors";
import { DEFAULT, LlmProviderName, PROVIDER } from "./constants.js";
import {
  LlmProvider,
  LlmMessageOptions,
  LlmOperateOptions,
  LlmOptions,
} from "./types/LlmProvider.interface.js";
import { OpenAiProvider } from "./providers/openai/index.js";
import { AnthropicProvider } from "./providers/AnthropicProvider.class.js";

class Llm implements LlmProvider {
  private _provider: LlmProviderName;
  private _llm: LlmProvider;
  private _options: LlmOptions;

  constructor(
    providerName: LlmProviderName = DEFAULT.PROVIDER.NAME,
    options: LlmOptions = {},
  ) {
    this._provider = providerName;
    this._options = options;
    this._llm = this.createProvider(providerName, options);
  }

  private createProvider(
    providerName: LlmProviderName,
    options: LlmOptions = {},
  ): LlmProvider {
    const { apiKey, model } = options;

    switch (providerName) {
      case PROVIDER.OPENAI.NAME:
        return new OpenAiProvider(model || PROVIDER.OPENAI.MODEL.DEFAULT, {
          apiKey,
        });
      case PROVIDER.ANTHROPIC.NAME:
        return new AnthropicProvider(
          model || PROVIDER.ANTHROPIC.MODEL.DEFAULT,
          { apiKey },
        );
      default:
        throw new Error(`Unsupported provider: ${providerName}`);
    }
  }

  async send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject> {
    return this._llm.send(message, options);
  }

  async operate(
    message: string,
    options: LlmOperateOptions = {},
  ): Promise<JsonArray> {
    if (!this._llm.operate) {
      throw new NotImplementedError(
        `Provider ${this._provider} does not support operate method`,
      );
    }
    return this._llm.operate(message, options);
  }

  static async send(
    message: string,
    options?: LlmMessageOptions & {
      llm?: LlmProviderName;
      apiKey?: string;
      model?: string;
    },
  ): Promise<string | JsonObject> {
    const { llm, apiKey, model, ...messageOptions } = options || {};
    const instance = new Llm(llm, { apiKey, model });
    return instance.send(message, messageOptions);
  }

  static async operate(
    message: string,
    options?: LlmOperateOptions & {
      llm?: LlmProviderName;
      apiKey?: string;
      model?: string;
    },
  ): Promise<JsonArray> {
    const { llm, apiKey, model, ...operateOptions } = options || {};
    const instance = new Llm(llm, { apiKey, model });
    return instance.operate(message, operateOptions);
  }
}

export default Llm;
