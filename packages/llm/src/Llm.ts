import { JsonObject } from "@jaypie/types";
import { ConfigurationError, NotImplementedError } from "@jaypie/errors";
import log from "@jaypie/logger";
import { DEFAULT, LlmProviderName, PROVIDER } from "./constants.js";
import { determineModelProvider } from "./util/determineModelProvider.js";
import {
  LlmFallbackConfig,
  LlmHistory,
  LlmInputMessage,
  LlmMessageOptions,
  LlmOperateInput,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmOptions,
  LlmProvider,
} from "./types/LlmProvider.interface.js";
import { LlmStreamChunk } from "./types/LlmStreamChunk.interface.js";
import { AnthropicProvider } from "./providers/anthropic/AnthropicProvider.class.js";
import { GeminiProvider } from "./providers/gemini/GeminiProvider.class.js";
import { OpenAiProvider } from "./providers/openai/index.js";
import { OpenRouterProvider } from "./providers/openrouter/index.js";

class Llm implements LlmProvider {
  private _fallbackConfig?: LlmFallbackConfig[];
  private _llm: LlmProvider;
  private _options: LlmOptions;
  private _provider: LlmProviderName;

  constructor(
    providerName: LlmProviderName | string = DEFAULT.PROVIDER.NAME,
    options: LlmOptions = {},
  ) {
    const { fallback, model } = options;
    let finalProvider = providerName;
    let finalModel = model;

    // Legacy: accept "gemini" but warn
    if (providerName === "gemini") {
      log.warn(
        `Provider "gemini" is deprecated, use "${PROVIDER.GEMINI.NAME}" instead`,
      );
    }

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

    this._fallbackConfig = fallback;
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
      case PROVIDER.OPENROUTER.NAME:
        return new OpenRouterProvider(
          model || PROVIDER.OPENROUTER.MODEL.DEFAULT,
          {
            apiKey,
          },
        );
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

  /**
   * Resolves the fallback chain from instance config and per-call options.
   * Per-call options take precedence over instance config.
   * Returns empty array if fallback is disabled.
   */
  private resolveFallbackChain(
    options: LlmOperateOptions,
  ): LlmFallbackConfig[] {
    // Per-call `fallback: false` disables fallback entirely
    if (options.fallback === false) {
      return [];
    }
    // Per-call fallback array overrides instance config
    if (Array.isArray(options.fallback)) {
      return options.fallback;
    }
    // Use instance config if available
    return this._fallbackConfig || [];
  }

  /**
   * Creates a fallback Llm instance lazily when needed.
   */
  private createFallbackInstance(config: LlmFallbackConfig): Llm {
    return new Llm(config.provider, {
      apiKey: config.apiKey,
      model: config.model,
    });
  }

  async operate(
    input: string | LlmHistory | LlmInputMessage | LlmOperateInput,
    options: LlmOperateOptions = {},
  ): Promise<LlmOperateResponse> {
    if (!this._llm.operate) {
      throw new NotImplementedError(
        `Provider ${this._provider} does not support operate method`,
      );
    }

    const fallbackChain = this.resolveFallbackChain(options);
    const optionsWithoutFallback = { ...options, fallback: false as const };

    let lastError: Error | undefined;
    let attempts = 0;

    // Try primary provider first
    attempts++;
    try {
      const response = await this._llm.operate(input, optionsWithoutFallback);
      return {
        ...response,
        fallbackAttempts: attempts,
        fallbackUsed: false,
        provider: response.provider || this._provider,
      };
    } catch (error) {
      lastError = error as Error;
      log.warn(`Provider ${this._provider} failed`, {
        error: lastError.message,
        fallbacksRemaining: fallbackChain.length,
      });
    }

    // Try fallback providers
    for (const fallbackConfig of fallbackChain) {
      attempts++;
      try {
        const fallbackInstance = this.createFallbackInstance(fallbackConfig);
        const response = await fallbackInstance.operate(
          input,
          optionsWithoutFallback,
        );
        return {
          ...response,
          fallbackAttempts: attempts,
          fallbackUsed: true,
          provider: response.provider || fallbackConfig.provider,
        };
      } catch (error) {
        lastError = error as Error;
        log.warn(`Fallback provider ${fallbackConfig.provider} failed`, {
          error: lastError.message,
          fallbacksRemaining: fallbackChain.length - attempts + 1,
        });
      }
    }

    // All providers failed, throw the last error
    throw lastError;
  }

  async *stream(
    input: string | LlmHistory | LlmInputMessage | LlmOperateInput,
    options: LlmOperateOptions = {},
  ): AsyncIterable<LlmStreamChunk> {
    if (!this._llm.stream) {
      throw new NotImplementedError(
        `Provider ${this._provider} does not support stream method`,
      );
    }
    yield* this._llm.stream(input, options);
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
    input: string | LlmHistory | LlmInputMessage | LlmOperateInput,
    options?: LlmOperateOptions & {
      apiKey?: string;
      fallback?: LlmFallbackConfig[] | false;
      llm?: LlmProviderName;
      model?: string;
    },
  ): Promise<LlmOperateResponse> {
    const { apiKey, fallback, llm, model, ...operateOptions } = options || {};

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

    // Resolve fallback for static method: pass to instance if array, pass to operate options if false
    const instanceFallback = Array.isArray(fallback) ? fallback : undefined;
    const operateFallback = fallback === false ? false : undefined;

    const instance = new Llm(finalLlm, {
      apiKey,
      fallback: instanceFallback,
      model: finalModel,
    });
    return instance.operate(input, {
      ...operateOptions,
      ...(operateFallback !== undefined && { fallback: operateFallback }),
    });
  }

  static stream(
    input: string | LlmHistory | LlmInputMessage | LlmOperateInput,
    options?: LlmOperateOptions & {
      llm?: LlmProviderName;
      apiKey?: string;
      model?: string;
    },
  ): AsyncIterable<LlmStreamChunk> {
    const { llm, apiKey, model, ...streamOptions } = options || {};

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
    return instance.stream(input, streamOptions);
  }
}

export default Llm;
