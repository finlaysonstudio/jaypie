import { JsonObject } from "@jaypie/types";
import { ConfigurationError, NotImplementedError } from "@jaypie/errors";
import log from "@jaypie/logger";
import { DEFAULT, LlmProviderName, PROVIDER } from "./constants.js";
import { determineModelProvider } from "./util/determineModelProvider.js";
import { resolveModelChain } from "./util/resolveModelChain.js";
import { runWithFallback } from "./util/runWithFallback.js";
import { emulateQuestion, validateQuestions } from "./question/index.js";
import { emulateOcr, resolveOcrDocument } from "./ocr/index.js";
import { emitExchange } from "./operate/exchange/index.js";
import {
  ExchangeStore,
  persistExchange,
  useExchangeStore,
} from "./observability/exchangeStore.js";
import {
  LlmExchangeCallback,
  LlmExchangeEnvelope,
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
import {
  LlmQuestionOptions,
  LlmQuestionResponse,
  LlmQuestionState,
} from "./types/LlmQuestion.interface.js";
import {
  LlmOcrDocument,
  LlmOcrOptions,
  LlmOcrResponse,
} from "./types/LlmOcr.interface.js";
import { LlmStreamChunk } from "./types/LlmStreamChunk.interface.js";
import { AnthropicProvider } from "./providers/anthropic/AnthropicProvider.class.js";
import { BedrockProvider } from "./providers/bedrock/index.js";
import { FireworksProvider } from "./providers/fireworks/index.js";
import { GoogleProvider } from "./providers/google/GoogleProvider.class.js";
import { LlamaCloudProvider } from "./providers/llamacloud/index.js";
import { MetaProvider } from "./providers/meta/index.js";
import { MistralProvider } from "./providers/mistral/index.js";
import { OpenAiProvider } from "./providers/openai/index.js";
import { OpenRouterProvider } from "./providers/openrouter/index.js";
import { TypeSafeProvider } from "./providers/typesafe/index.js";
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
      case PROVIDER.LLAMACLOUD.NAME:
        return new LlamaCloudProvider(model || PROVIDER.LLAMACLOUD.DEFAULT, {
          apiKey,
        });
      case PROVIDER.META.NAME:
        return new MetaProvider(model || PROVIDER.META.DEFAULT, {
          apiKey,
        });
      case PROVIDER.MISTRAL.NAME:
        return new MistralProvider(model || PROVIDER.MISTRAL.DEFAULT, {
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
      case PROVIDER.TYPESAFE.NAME:
        return new TypeSafeProvider(model || PROVIDER.TYPESAFE.DEFAULT, {
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
  private resolveFallbackChain(options: {
    fallback?: LlmFallbackConfig[] | false;
  }): LlmFallbackConfig[] {
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
    input?: string | LlmHistory | LlmInputMessage | LlmOperateInput,
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

    // A resumed exchange defaults to the model that served the parked
    // segment and never falls back: call ids and history are provider-bound.
    const resume = resolvedOptions.resume;
    if (resume && !resolvedOptions.model) {
      resolvedOptions.model = resume.exchange?.resolution?.model;
    }

    const fallbackChain = resume
      ? []
      : [...modelFallback, ...this.resolveFallbackChain(resolvedOptions)];
    const optionsWithoutFallback = {
      ...resolvedOptions,
      fallback: false as const,
    };

    // Reaching for another provider beats waiting out a rate limit, so every
    // attempt with somewhere left to go fails fast instead of sleeping. The
    // final attempt keeps the wait: there is no cheaper remedy left. An
    // explicit `retry` option from the caller wins over both.
    const eagerOptions =
      fallbackChain.length > 0 && resolvedOptions.retry === undefined
        ? { ...optionsWithoutFallback, retry: { rateLimit: false as const } }
        : optionsWithoutFallback;

    return runWithFallback<Llm, LlmOperateResponse>({
      attempt: async ({ attempts, instance, isLast, provider }) => {
        if (!instance._llm.operate) {
          throw new NotImplementedError(
            `Provider ${provider} does not support operate method`,
          );
        }
        // A fallback runs its own model: the per-call model named the
        // primary, and forwarding it would ask the next provider for a
        // model it does not serve.
        const attemptOptions = isLast ? optionsWithoutFallback : eagerOptions;
        const response = await instance._llm.operate(
          input,
          instance === this
            ? attemptOptions
            : { ...attemptOptions, model: undefined },
        );
        const settled = {
          ...response,
          fallbackAttempts: attempts,
          fallbackUsed: attempts > 1,
          provider: response.provider || provider,
        };
        await this.settleExchange({
          onExchange: resolvedOptions.onExchange,
          response: settled,
        });
        return settled;
      },
      chain: fallbackChain,
      createInstance: (config) => this.createFallbackInstance(config),
      onExhausted: async ({ attempts, error }) => {
        // All providers failed: settle the exchange from the envelope the
        // loop attached to the last error before it is rethrown
        const failureEnvelope = (error as { exchange?: LlmExchangeEnvelope })
          ?.exchange;
        if (!failureEnvelope) {
          return;
        }
        failureEnvelope.resolution = {
          ...failureEnvelope.resolution,
          fallbackAttempts: attempts,
          fallbackUsed: attempts > 1,
        };
        await emitExchange({
          envelope: failureEnvelope,
          onExchange: resolvedOptions.onExchange,
        });
        await persistExchange(failureEnvelope);
      },
      primary: this,
      primaryProvider: this._provider,
    });
  }

  /**
   * Turn a document into per-page markdown. Mistral OCR and LlamaParse
   * answer natively behind one request and response shape; every other
   * provider answers through the emulator, which sends each page through
   * one structured `operate()` call. A chain can therefore fall from a
   * native engine to any chat model. The document is resolved once (S3,
   * disk, or data URI) before the chain runs, so a fallback never re-reads
   * it.
   */
  async ocr(
    document: LlmOcrDocument,
    options: LlmOcrOptions = {},
  ): Promise<LlmOcrResponse> {
    const { fallback: modelFallback, model: perCallModel } = resolveModelChain(
      options.model,
    );
    const resolvedOptions: LlmOcrOptions = {
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
    // Same bargain as operate: an attempt with somewhere left to go fails
    // fast instead of waiting out a rate limit.
    const eagerOptions =
      fallbackChain.length > 0 && resolvedOptions.retry === undefined
        ? { ...optionsWithoutFallback, retry: { rateLimit: false as const } }
        : optionsWithoutFallback;
    const resolvedDocument = await resolveOcrDocument(document);

    return runWithFallback<Llm, LlmOcrResponse>({
      attempt: async ({ attempts, instance, isLast, provider }) => {
        const base = isLast ? optionsWithoutFallback : eagerOptions;
        // A fallback runs its own model: the per-call model named the
        // primary, and forwarding it would ask the next provider for a
        // tier it does not serve.
        const attemptOptions =
          instance === this ? base : { ...base, model: undefined };
        const response = instance._llm.ocr
          ? await instance._llm.ocr(resolvedDocument, attemptOptions)
          : await emulateOcr({
              document: resolvedDocument,
              options: attemptOptions,
              provider: instance._llm,
              providerName: provider,
            });
        return {
          ...response,
          fallbackAttempts: attempts,
          fallbackUsed: attempts > 1,
          provider: response.provider || provider,
        };
      },
      chain: fallbackChain,
      createInstance: (config) => this.createFallbackInstance(config),
      primary: this,
      primaryProvider: this._provider,
    });
  }

  /**
   * Answer typed questions about a state, in TypeSafe's (Jev's) shape. A
   * provider with native `question` support answers directly; every other
   * provider answers through the emulator, which rigs up one structured
   * `operate()` call and derives the answers from the reported
   * distributions. A chain can therefore mix the two: the shape of the
   * request and the response does not change with who served it.
   */
  async question(
    state: LlmQuestionState,
    options: LlmQuestionOptions,
  ): Promise<LlmQuestionResponse> {
    validateQuestions(options.questions);

    const { fallback: modelFallback, model: perCallModel } = resolveModelChain(
      options.model,
    );
    const resolvedOptions: LlmQuestionOptions = {
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
    // Same bargain as operate: an attempt with somewhere left to go fails
    // fast instead of waiting out a rate limit.
    const eagerOptions =
      fallbackChain.length > 0 && resolvedOptions.retry === undefined
        ? { ...optionsWithoutFallback, retry: { rateLimit: false as const } }
        : optionsWithoutFallback;

    return runWithFallback<Llm, LlmQuestionResponse>({
      attempt: async ({ attempts, instance, isLast, provider }) => {
        const base = isLast ? optionsWithoutFallback : eagerOptions;
        const attemptOptions =
          instance === this ? base : { ...base, model: undefined };
        const response = instance._llm.question
          ? await instance._llm.question(state, attemptOptions)
          : await emulateQuestion({
              options: attemptOptions,
              provider: instance._llm,
              providerName: provider,
              state,
            });
        return {
          ...response,
          fallbackAttempts: attempts,
          fallbackUsed: attempts > 1,
          provider: response.provider || provider,
        };
      },
      chain: fallbackChain,
      createInstance: (config) => this.createFallbackInstance(config),
      primary: this,
      primaryProvider: this._provider,
    });
  }

  /**
   * Stamp fallback resolution onto the envelope the operate loop attached to
   * the response and deliver it to the caller's onExchange. Fires once per
   * operate() settlement; callback errors are logged and never thrown.
   */
  private async settleExchange({
    onExchange,
    response,
  }: {
    onExchange?: LlmExchangeCallback;
    response: LlmOperateResponse;
  }): Promise<void> {
    const envelope = response.exchange;
    if (!envelope) {
      return;
    }
    envelope.resolution = {
      ...envelope.resolution,
      fallbackAttempts: response.fallbackAttempts,
      fallbackUsed: response.fallbackUsed,
      model: response.model,
      provider: response.provider,
    };
    await emitExchange({ envelope, onExchange });
    await persistExchange(envelope);
  }

  async *stream(
    input?: string | LlmHistory | LlmInputMessage | LlmOperateInput,
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
    // A resumed exchange defaults to the model that served the parked segment
    if (streamOptions.resume && !streamOptions.model) {
      streamOptions.model = streamOptions.resume.exchange?.resolution?.model;
    }
    yield* this._llm.stream(input, streamOptions);
  }

  /**
   * Register the @jaypie/dynamodb instance exchange persistence should use.
   * Call once at bootstrap, beside `initClient()`; see `useExchangeStore`.
   */
  static useExchangeStore(store: ExchangeStore | null): void {
    useExchangeStore(store);
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
    input?: string | LlmHistory | LlmInputMessage | LlmOperateInput,
    options?: Omit<LlmOperateOptions, "model"> & {
      apiKey?: string;
      fallback?: LlmFallbackConfig[] | false;
      llm?: LlmProviderName;
      model?: string | string[];
    },
  ): Promise<LlmOperateResponse> {
    // A resumed exchange with no explicit model resolves its provider from
    // the model that served the parked segment.
    const resumeModel = options?.resume?.exchange?.resolution?.model;
    const {
      apiKey,
      fallback,
      llm,
      model = resumeModel,
      ...operateOptions
    } = options || {};

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

  /**
   * With neither `llm` nor `model`, the default engine is Mistral OCR
   * (`DEFAULT.OCR`): one synchronous call and the cheapest markdown tier.
   */
  static async ocr(
    document: LlmOcrDocument,
    options: LlmOcrOptions = {},
  ): Promise<LlmOcrResponse> {
    const { apiKey, fallback, llm, model, ...ocrOptions } = options;

    // A `model` array becomes primary + derived fallback chain
    const { fallback: modelFallback, model: primaryModel } =
      resolveModelChain(model);

    let finalLlm = llm as LlmProviderName | undefined;
    let finalModel = primaryModel;

    if (!llm && primaryModel) {
      const determined = determineModelProvider(primaryModel);
      if (determined.provider) {
        finalLlm = determined.provider as LlmProviderName;
      }
    } else if (llm && primaryModel) {
      const determined = determineModelProvider(primaryModel);
      if (determined.provider && determined.provider !== llm) {
        finalModel = undefined;
      }
    }
    if (!finalLlm && !finalModel) {
      finalLlm = DEFAULT.OCR.PROVIDER.NAME;
      finalModel = DEFAULT.OCR.MODEL;
    }

    const explicitFallback = Array.isArray(fallback) ? fallback : [];
    const instanceFallback =
      modelFallback.length || explicitFallback.length
        ? [...modelFallback, ...explicitFallback]
        : undefined;

    const instance = new Llm(finalLlm, {
      apiKey,
      fallback: instanceFallback,
      model: finalModel,
    });
    return instance.ocr(document, {
      ...ocrOptions,
      ...(fallback === false && { fallback: false }),
    });
  }

  static async question(
    state: LlmQuestionState,
    options: LlmQuestionOptions,
  ): Promise<LlmQuestionResponse> {
    const { apiKey, fallback, llm, model, ...questionOptions } = options;

    // A `model` array becomes primary + derived fallback chain
    const { fallback: modelFallback, model: primaryModel } =
      resolveModelChain(model);

    let finalLlm = llm as LlmProviderName | undefined;
    let finalModel = primaryModel;

    if (!llm && primaryModel) {
      const determined = determineModelProvider(primaryModel);
      if (determined.provider) {
        finalLlm = determined.provider as LlmProviderName;
      }
    } else if (llm && primaryModel) {
      const determined = determineModelProvider(primaryModel);
      if (determined.provider && determined.provider !== llm) {
        finalModel = undefined;
      }
    }

    const explicitFallback = Array.isArray(fallback) ? fallback : [];
    const instanceFallback =
      modelFallback.length || explicitFallback.length
        ? [...modelFallback, ...explicitFallback]
        : undefined;

    const instance = new Llm(finalLlm, {
      apiKey,
      fallback: instanceFallback,
      model: finalModel,
    });
    return instance.question(state, {
      ...questionOptions,
      ...(fallback === false && { fallback: false }),
    });
  }

  static stream(
    input?: string | LlmHistory | LlmInputMessage | LlmOperateInput,
    options?: Omit<LlmOperateOptions, "model"> & {
      llm?: LlmProviderName;
      apiKey?: string;
      model?: string | string[];
    },
  ): AsyncIterable<LlmStreamChunk> {
    // A resumed exchange with no explicit model resolves its provider from
    // the model that served the parked segment.
    const resumeModel = options?.resume?.exchange?.resolution?.model;
    const {
      llm,
      apiKey,
      model = resumeModel,
      ...streamOptions
    } = options || {};

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
