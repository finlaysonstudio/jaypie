import { JsonObject } from "@jaypie/types";
import { ConfigurationError, NotImplementedError } from "@jaypie/errors";
import { DEFAULT, LlmProviderName, PROVIDER } from "./constants.js";
import { determineModelProvider } from "./util/determineModelProvider.js";
import {
  LlmProvider,
  LlmHistory,
  LlmInputMessage,
  LlmMessageOptions,
  LlmOperateOptions,
  LlmOptions,
  LlmOperateResponse,
} from "./types/LlmProvider.interface.js";
import { AnthropicProvider } from "./providers/anthropic/AnthropicProvider.class.js";
import { GeminiProvider } from "./providers/gemini/GeminiProvider.class.js";
import { OpenAiProvider } from "./providers/openai/index.js";

class Llm implements LlmProvider {
  private _provider: LlmProviderName;
  private _llm: LlmProvider;
  private _options: LlmOptions;

  constructor(
    providerName: LlmProviderName | string = DEFAULT.PROVIDER.NAME,
    options: LlmOptions = {},
  ) {
    const { model } = options;
    let finalProvider = providerName;
    let finalModel = model;

    if (model) {
      const modelDetermined = determineModelProvider(model);
      finalModel = modelDetermined.model;
      if (modelDetermined.provider) {
        finalProvider = modelDetermined.provider as LlmProviderName;
      }
    }

    // Only determine provider from providerName if we don't have a provider from model
    if (!model || !determineModelProvider(model).provider) {
      const providerDetermined = determineModelProvider(providerName);
      if (!providerDetermined.provider) {
        throw new ConfigurationError(
          `Unable to determine provider from: ${providerName}`,
        );
      }
      finalProvider = providerDetermined.provider;
    }

    // Handle conflicts: if both providerName and model specify different providers
    if (model && providerName !== DEFAULT.PROVIDER.NAME) {
      const modelDetermined = determineModelProvider(model);
      const providerDetermined = determineModelProvider(providerName);
      if (
        modelDetermined.provider &&
        providerDetermined.provider &&
        modelDetermined.provider !== providerDetermined.provider
      ) {
        // Model's provider conflicts with explicit provider, don't pass model
        finalModel = undefined;
      }
    }

    this._provider = finalProvider as LlmProviderName;
    this._options = { ...options, model: finalModel };
    this._llm = this.createProvider(
      finalProvider as LlmProviderName,
      this._options,
    );
  }

  private createProvider(
    providerName: LlmProviderName,
    options: LlmOptions = {},
  ): LlmProvider {
    const { apiKey, model } = options;

    switch (providerName) {
      case PROVIDER.ANTHROPIC.NAME:
        return new AnthropicProvider(
          model || PROVIDER.ANTHROPIC.MODEL.DEFAULT,
          { apiKey },
        );
      case PROVIDER.GEMINI.NAME:
        return new GeminiProvider(model || PROVIDER.GEMINI.MODEL.DEFAULT, {
          apiKey,
        });
      case PROVIDER.OPENAI.NAME:
        return new OpenAiProvider(model || PROVIDER.OPENAI.MODEL.DEFAULT, {
          apiKey,
        });
      default:
        throw new ConfigurationError(`Unsupported provider: ${providerName}`);
    }
  }

  async send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject> {
    return this._llm.send(message, options);
  }

  async operate(
    input: string | LlmHistory | LlmInputMessage,
    options: LlmOperateOptions = {},
  ): Promise<LlmOperateResponse> {
    if (!this._llm.operate) {
      throw new NotImplementedError(
        `Provider ${this._provider} does not support operate method`,
      );
    }
    return this._llm.operate(input, options);
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
    input: string | LlmHistory | LlmInputMessage,
    options?: LlmOperateOptions & {
      llm?: LlmProviderName;
      apiKey?: string;
      model?: string;
    },
  ): Promise<LlmOperateResponse> {
    const { llm, apiKey, model, ...operateOptions } = options || {};

    let finalLlm = llm;
    let finalModel = model;

    if (!llm && model) {
      const determined = determineModelProvider(model);
      if (determined.provider) {
        finalLlm = determined.provider as LlmProviderName;
      }
    } else if (llm && model) {
      // When both llm and model are provided, check if they conflict
      const determined = determineModelProvider(model);
      if (determined.provider && determined.provider !== llm) {
        // Don't pass the conflicting model to the constructor
        finalModel = undefined;
      }
    }

    const instance = new Llm(finalLlm, { apiKey, model: finalModel });
    return instance.operate(input, operateOptions);
  }
}

export default Llm;
