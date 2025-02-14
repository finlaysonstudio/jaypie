import { JsonObject } from "@jaypie/types";
import { DEFAULT, LlmProviderName, PROVIDER } from "./constants.js";
import {
  LlmProvider,
  LlmMessageOptions,
} from "./types/LlmProvider.interface.js";
import { OpenAiProvider } from "./providers/OpenAiProvider.class.js";
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

  static async send(
    message: string,
    options?: LlmMessageOptions & { llm?: LlmProviderName },
  ): Promise<string | JsonObject> {
    const { llm, ...messageOptions } = options || {};
    const instance = new Llm(llm);
    return instance.send(message, messageOptions);
  }
}

export default Llm;
