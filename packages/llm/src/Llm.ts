import { DEFAULT, LlmProviderName, PROVIDER } from "./constants.js";
import { LlmProvider } from "./types/LlmProvider.interface.js";
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

  async send(message: string): Promise<string> {
    return this._llm.send(message);
  }
}

export default Llm;
