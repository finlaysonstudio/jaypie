import { JsonObject } from "@jaypie/types";
import { ConfigurationError, NotImplementedError } from "@jaypie/errors";
import log from "@jaypie/logger";
import { DEFAULT, LlmProviderName, PROVIDER } from "./constants.js";
import { determineModelProvider } from "./util/determineModelProvider.js";
import { resolveModelChain } from "./util/resolveModelChain.js";
import {
  LlmFallbackConfig,
  LlmHistory,
  LlmInputMessage,
  LlmMessageOptions,
  LlmModelOption,
  LlmOperateInput,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmOptions,
  LlmProvider,
} from "./types/LlmProvider.interface.js";
import { LlmStreamChunk } from "./types/LlmStreamChunk.interface.js";
import { AnthropicProvider } from "./providers/anthropic/AnthropicProvider.class.js";
import { BedrockProvider } from "./providers/bedrock/index.js";
import { FireworksProvider } from "./providers/fireworks/index.js";
import { GoogleProvider } from "./providers/google/GoogleProvider.class.js";
import { OpenAiProvider } from "./providers/openai/index.js";
import { OpenRouterProvider } from "./providers/openrouter/index.js";
import { XaiProvider } from "./providers/xai/index.js";

class Llm implements LlmProvider {
  private _fallbackConfig?: LlmFallbackConfig[];
  private _llm: LlmProvider;
  private _options: LlmOptions;
  private _provider: LlmProviderName;

  constructor(
    providerName: LlmProviderName | string = DEFAULT.PROVIDER.NAME,
    options: Omit<LlmOptions, "model"> & { model?: LlmModelOption } = {},
  ) {
    const { fallback: fallbackOption, model: modelOption } = options;
    // A `model` array is sugar for a preference-ordered fallback chain:
    // index 0 is primary, the rest become fallback entries (provider
    // auto-detected). Any explicit `fallback` is appended after the chain.
    const { fallback: modelFallback, model } = resolveModelChain(modelOption);
    const fallback =
      modelFallback.length || fallbackOption
        ? [...modelFallback, ...(fallbackOption ?? [])]
        : undefined;
    let finalProvider = providerName;
    let finalModel = model;

    // Legacy: accept "gemini" but warn
    if (providerName === "gemini") {
      log.warn(
        `Provider "gemini" is deprecated, use "${PROVIDER.GOOGLE.NAME}" instead`,
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
      // When providerName is actually a model name, extract the model (#213)
      if (!finalModel && providerName !== providerDetermined.provider) {
        finalModel = providerDetermined.model;
      }
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
        return new AnthropicProvider(model || PROVIDER.ANTHROPIC.DEFAULT, {
          apiKey,
        });
      case PROVIDER.BEDROCK.NAME:
        return new BedrockProvider(model || PROVIDER.BEDROCK.DEFAULT);
      case PROVIDER.FIREWORKS.NAME:
        return new FireworksProvider(model || PROVIDER.FIREWORKS.DEFAULT, {
          apiKey,
        });
      case PROVIDER.GOOGLE.NAME:
        return new GoogleProvider(model || PROVIDER.GOOGLE.DEFAULT, {
          apiKey,
        });
      case PROVIDER.OPENAI.NAME:
        return new OpenAiProvider(model || PROVIDER.OPENAI.DEFAULT, {
          apiKey,
        });
      case PROVIDER.OPENROUTER.NAME:
        return new OpenRouterProvider(model || PROVIDER.OPENROUTER.DEFAULT, {
          apiKey,
        });
      case PROVIDER.XAI.NAME:
        return new XaiProvider(model || PROVIDER.XAI.DEFAULT, {
          apiKey,
        });
      default:
        throw new ConfigurationError(`Unsupported provider: ${providerName}`);
    }
  }

  async send(
    message: string,
    options?: Omit<LlmMessageOptions, "model"> & { model?: LlmModelOption },
  ): Promise<string | JsonObject> {
    if (options && Array.isArray(options.model)) {
      // `send` has no fallback machinery; use the primary model only
      const { model } = resolveModelChain(options.model);
      return this._llm.send(message, { ...options, model });
    }
    return this._llm.send(message, options as LlmMessageOptions | undefined);
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
    options: Omit<LlmOperateOptions, "model"> & { model?: LlmModelOption } = {},
  ): Promise<LlmOperateResponse> {
    if (!this._llm.operate) {
      throw new NotImplementedError(
        `Provider ${this._provider} does not support operate method`,
      );
    }

    // A per-call `model` array becomes primary + a derived fallback chain
    // prepended to any resolved chain.
    const { fallback: modelFallback, model: perCallModel } = resolveModelChain(
      options.model,
    );
    const resolvedOptions: LlmOperateOptions = {
      ...options,
      model: perCallModel,
    };

    const fallbackChain = [
      ...modelFallback,
      ...this.resolveFallbackChain(resolvedOptions),
    ];
    const optionsWithoutFallback = {
      ...resolvedOptions,
      fallback: false as const,
    };

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
    options: Omit<LlmOperateOptions, "model"> & { model?: LlmModelOption } = {},
  ): AsyncIterable<LlmStreamChunk> {
    if (!this._llm.stream) {
      throw new NotImplementedError(
        `Provider ${this._provider} does not support stream method`,
      );
    }
    // `stream` has no instance-level fallback machinery; an array model uses
    // the primary and ignores the rest.
    const { model } = resolveModelChain(options.model);
    const streamOptions: LlmOperateOptions = { ...options, model };
    yield* this._llm.stream(input, streamOptions);
  }

  static async send(
    message: string,
    options?: Omit<LlmMessageOptions, "model"> & {
      llm?: LlmProviderName;
      apiKey?: string;
      model?: string | string[];
    },
  ): Promise<string | JsonObject> {
    const { llm, apiKey, model, ...messageOptions } = options || {};
    // A `model` array derives a fallback chain; `send` has no fallback
    // machinery, so the primary model is used and the chain is ignored.
    const { model: primaryModel } = resolveModelChain(model);
    const instance = new Llm(llm, { apiKey, model: primaryModel });
    return instance.send(message, messageOptions);
  }

  static async operate(
    input: string | LlmHistory | LlmInputMessage | LlmOperateInput,
    options?: Omit<LlmOperateOptions, "model"> & {
      apiKey?: string;
      fallback?: LlmFallbackConfig[] | false;
      llm?: LlmProviderName;
      model?: string | string[];
    },
  ): Promise<LlmOperateResponse> {
    const { apiKey, fallback, llm, model, ...operateOptions } = options || {};

    // A `model` array becomes primary + derived fallback chain
    const { fallback: modelFallback, model: primaryModel } =
      resolveModelChain(model);

    let finalLlm = llm;
    let finalModel = primaryModel;

    if (!llm && primaryModel) {
      const determined = determineModelProvider(primaryModel);
      if (determined.provider) {
        finalLlm = determined.provider as LlmProviderName;
      }
    } else if (llm && primaryModel) {
      // When both llm and model are provided, check if they conflict
      const determined = determineModelProvider(primaryModel);
      if (determined.provider && determined.provider !== llm) {
        // Don't pass the conflicting model to the constructor
        finalModel = undefined;
      }
    }

    // Resolve fallback for static method: pass to instance if array, pass to operate options if false
    const explicitFallback = Array.isArray(fallback) ? fallback : [];
    const instanceFallback =
      modelFallback.length || explicitFallback.length
        ? [...modelFallback, ...explicitFallback]
        : undefined;
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
    options?: Omit<LlmOperateOptions, "model"> & {
      llm?: LlmProviderName;
      apiKey?: string;
      model?: string | string[];
    },
  ): AsyncIterable<LlmStreamChunk> {
    const { llm, apiKey, model, ...streamOptions } = options || {};

    // A `model` array becomes primary + derived fallback chain
    const { fallback: modelFallback, model: primaryModel } =
      resolveModelChain(model);

    let finalLlm = llm;
    let finalModel = primaryModel;

    if (!llm && primaryModel) {
      const determined = determineModelProvider(primaryModel);
      if (determined.provider) {
        finalLlm = determined.provider as LlmProviderName;
      }
    } else if (llm && primaryModel) {
      // When both llm and model are provided, check if they conflict
      const determined = determineModelProvider(primaryModel);
      if (determined.provider && determined.provider !== llm) {
        // Don't pass the conflicting model to the constructor
        finalModel = undefined;
      }
    }

    const instance = new Llm(finalLlm, {
      apiKey,
      fallback: modelFallback.length ? modelFallback : undefined,
      model: finalModel,
    });
    return instance.stream(input, streamOptions);
  }
}

export default Llm;
