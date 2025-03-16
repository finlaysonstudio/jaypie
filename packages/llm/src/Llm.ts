import { JsonArray, JsonObject } from "@jaypie/types";
import { NotImplementedError } from "@jaypie/errors";
import { DEFAULT, LlmProviderName, PROVIDER } from "./constants.js";
import {
  LlmProvider,
  LlmMessageOptions,
  LlmOperateOptions,
} from "./types/LlmProvider.interface.js";
import { OpenAiProvider } from "./providers/openai/index.js";
import { AnthropicProvider } from "./providers/AnthropicProvider.class.js";

class Llm implements LlmProvider {
  private _provider: LlmProviderName;
  private _llm: LlmProvider;

  constructor(providerName: LlmProviderName = DEFAULT.PROVIDER.NAME) {
    this._provider = providerName;
    this._llm = this.createProvider(providerName);
  }

  private createProvider(providerName: LlmProviderName): LlmProvider {
    switch (providerName) {
      case PROVIDER.OPENAI.NAME:
        return new OpenAiProvider();
      case PROVIDER.ANTHROPIC.NAME:
        return new AnthropicProvider();
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
    options?: LlmMessageOptions & { llm?: LlmProviderName },
  ): Promise<string | JsonObject> {
    const { llm, ...messageOptions } = options || {};
    const instance = new Llm(llm);
    return instance.send(message, messageOptions);
  }

  static async operate(
    message: string,
    options?: LlmOperateOptions & { llm?: LlmProviderName },
  ): Promise<JsonArray> {
    const { llm, ...operateOptions } = options || {};
    const instance = new Llm(llm);
    return instance.operate(message, operateOptions);
  }
}

export default Llm;
