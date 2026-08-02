/**
 * Provider-neutral reasoning-effort levels — a five-point relative scale that
 * deliberately borrows no provider's vocabulary. Each adapter translates these
 * to its provider's native control (OpenAI `reasoning.effort`, Anthropic
 * `output_config.effort`, Gemini `thinkingLevel`/`thinkingBudget`, Grok
 * `reasoning_effort`, OpenRouter `reasoning.effort`), spreading the scale across
 * the provider's available range. Omitting `effort` leaves the provider default
 * untouched, so it is safe to set across a fallback chain.
 */
export const EFFORT = {
  LOWEST: "lowest",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  HIGHEST: "highest",
} as const;

export type LlmEffort = (typeof EFFORT)[keyof typeof EFFORT];

export const MODEL = {
  // Amazon (Nova; the only first-class models served over Bedrock. Bedrock also
  // resells other vendors, but those routes are not catalogued — reach them by
  // passing the literal id, which determineModelProvider resolves to bedrock.)
  NOVA_LITE: "us.amazon.nova-2-lite-v1:0",
  NOVA_PRO: "amazon.nova-pro-v1:0",
  // Anthropic
  FABLE: "claude-fable-5",
  OPUS: "claude-opus-5",
  SONNET: "claude-sonnet-5",
  HAIKU: "claude-haiku-4-5",
  MYTHOS: "claude-mythos-5",
  // Fireworks (serverless open models; ids provided by operator)
  FIREWORKS: {
    DEEPSEEK: "accounts/fireworks/models/deepseek-v4-pro",
    GLM: "accounts/fireworks/models/glm-5p2",
    GPT_OSS: "accounts/fireworks/models/gpt-oss-120b",
    INKLING: "accounts/fireworks/models/inkling",
    KIMI: "accounts/fireworks/models/kimi-k3",
    MINIMAX: "accounts/fireworks/models/minimax-m2p7",
    NEMOTRON: "accounts/fireworks/models/nemotron-3-ultra-nvfp4",
    QWEN: "accounts/fireworks/models/qwen3p7-plus",
  },
  // Google
  GEMINI_FLASH: "gemini-3.6-flash",
  GEMINI_FLASH_LITE: "gemini-3.5-flash-lite",
  GEMINI_PRO: "gemini-3.1-pro-preview",
  // Mistral
  MISTRAL: {
    LARGE: "mistral-large-latest", // mistral-large-2512
    // Medium is deliberately absent. mistral-medium-3-5 will not converge when
    // tools and response_format are combined — it re-calls the tool instead of
    // answering from the result, and has been observed emitting concatenated
    // JSON as the tool *name* and hanging a request to a headers timeout.
    // Structured output with tools is a baseline expectation of operate(), so
    // the model is not cataloged. Its COST entry is retained per policy.
    // Document extraction over POST /v1/ocr, not chat completions. Priced per
    // page, so it carries no COST entry and is excluded from the chat matrix.
    OCR: "mistral-ocr-4-0",
    SMALL: "mistral-small-latest", // mistral-small-2603
  },
  // OpenAI
  SOL: "gpt-5.6-sol",
  TERRA: "gpt-5.6-terra",
  LUNA: "gpt-5.6-luna",
  /** @deprecated use MODEL.SOL (gpt-5.6-sol) */
  GPT: "gpt-5.5",
  /** @deprecated use MODEL.TERRA (gpt-5.6-terra) */
  GPT_MINI: "gpt-5.4-mini",
  /** @deprecated use MODEL.LUNA (gpt-5.6-luna) */
  GPT_NANO: "gpt-5.4-nano",
  // xAI
  // Pinned to a literal version rather than the `grok-latest` alias. COST is
  // keyed by literal id, so an alias xAI repoints would leave the catalog
  // priced for a model it no longer names. That is not hypothetical here:
  // `grok-latest` resolved to `grok-4.3` on 2026-08-02 (verified against the
  // API, which echoes the resolved id) at $1.25/$2.50, while Grok 4.5 bills
  // $2.00/$6.00. The day xAI moves the alias, an unpinned catalog understates
  // output cost by 140% with nothing to signal it.
  GROK: "grok-4.5",
  // OpenRouter (provider-prefixed routes; traversed by the OpenRouter hot test)
  OPENROUTER: {
    GLM: "z-ai/glm-5.2",
    LUNA: "openai/gpt-5.6-luna",
    SONNET: "anthropic/claude-sonnet-5",
  },
};

/** Price of one million tokens, in US dollars. */
export interface LlmModelCost {
  /**
   * Cache-read (cached input) tokens. Omitted when the provider does not price
   * cache reads separately from uncached input.
   */
  cachedInputRead?: number;
  /**
   * Cache-write tokens. A scalar when the rate does not vary by TTL (`0` where
   * the provider publishes a free write); keyed by the same `"5m"` / `"1h"`
   * literals as `LlmCache` when it does, so a cost calculation reads the TTL
   * straight off `OperateRequest.cache`. Omitted means cache writes bill at the
   * `input` rate.
   */
  cachedInputWrite?: number | { "1h": number; "5m": number };
  /** Uncached input tokens. */
  input: number;
  /** Output tokens. */
  output: number;
  /**
   * Reasoning tokens, when billed at a rate other than `output`. Omitted means
   * reasoning bills as output, which is true of every provider listed here.
   */
  reasoning?: number;
}

/**
 * Standard list price per million tokens, keyed by literal model id (verified
 * 2026-07-21). Keys are string literals rather than `MODEL.*` references so a
 * model retired from the catalog keeps its price here: historic ids stay
 * priceable after they leave `MODEL.*`, which is what makes replaying old
 * usage records possible.
 *
 * Caveats the numbers cannot carry:
 * - **Standard rate only.** Introductory, batch, flex, priority, fast-mode, and
 *   data-residency rates are excluded. Sonnet 5 is listed at its standard
 *   $3/$15, not the introductory rate.
 * - **Cache writes are Anthropic-only.** Bedrock publishes a literal $0 write
 *   for Amazon's own models, recorded here as `cachedInputWrite: 0`. Fireworks
 *   writes bill at the input rate. OpenAI and xAI discount reads automatically
 *   and publish no write premium. Google charges nothing to write an implicit
 *   cache; explicit caching bills storage per hour, a unit this table does not
 *   carry (and one `@jaypie/llm` does not wire).
 * - **Short-context tier.** Long-prompt surcharges are not modeled: Gemini 3.1
 *   Pro doubles above 200K, Grok doubles at 200K, GPT-5.5 is 2x in / 1.5x out
 *   above 272K.
 * - **Text rates.** Gemini prices audio input higher than text/image/video.
 * - **Proxy routes are deliberately absent.** `MODEL.OPENROUTER.*`, and any
 *   uncatalogued Bedrock id reselling a third-party model, are another vendor's
 *   model behind a gateway, priced per route and per region, so no single rate
 *   here would be correct. Price those against the backend model, or against
 *   the gateway's own published rate. Amazon's own Nova models are first-class,
 *   not proxies, and are priced below at the standard US on-demand rate (`us.`
 *   geo profile for Nova 2 Lite; the `global.` profile is cheaper and is not
 *   modeled).
 *
 * Unlisted ids return `undefined` — callers must handle a miss.
 */
export const COST: Record<string, LlmModelCost> = {
  // Amazon — AWS Price List API, AmazonBedrock/us-east-1 (published 2026-07-20;
  // us-west-2 identical). https://aws.amazon.com/bedrock/pricing/ renders its
  // tables in JavaScript, so the Price List offer file is the citable source.
  // Nova 2 Lite is quoted at the `us.` geo rate this catalog's id bills against;
  // the `global.` profile is $0.30/$2.50 and is not modeled.
  "amazon.nova-lite-v1:0": {
    cachedInputRead: 0.015,
    cachedInputWrite: 0,
    input: 0.06,
    output: 0.24,
  },
  "amazon.nova-pro-v1:0": {
    cachedInputRead: 0.2,
    cachedInputWrite: 0,
    input: 0.8,
    output: 3.2,
  },
  "us.amazon.nova-2-lite-v1:0": {
    cachedInputRead: 0.0825,
    cachedInputWrite: 0,
    input: 0.33,
    output: 2.75,
  },
  // Anthropic — https://platform.claude.com/docs/en/about-claude/pricing
  "claude-3-5-haiku-20241022": {
    cachedInputRead: 0.08,
    cachedInputWrite: { "1h": 1.6, "5m": 1.0 },
    input: 0.8,
    output: 4.0,
  },
  "claude-fable-5": {
    cachedInputRead: 1.0,
    cachedInputWrite: { "1h": 20.0, "5m": 12.5 },
    input: 10.0,
    output: 50.0,
  },
  "claude-haiku-4-5": {
    cachedInputRead: 0.1,
    cachedInputWrite: { "1h": 2.0, "5m": 1.25 },
    input: 1.0,
    output: 5.0,
  },
  "claude-mythos-5": {
    cachedInputRead: 1.0,
    cachedInputWrite: { "1h": 20.0, "5m": 12.5 },
    input: 10.0,
    output: 50.0,
  },
  "claude-opus-4-1": {
    cachedInputRead: 1.5,
    cachedInputWrite: { "1h": 30.0, "5m": 18.75 },
    input: 15.0,
    output: 75.0,
  },
  "claude-opus-4-5": {
    cachedInputRead: 0.5,
    cachedInputWrite: { "1h": 10.0, "5m": 6.25 },
    input: 5.0,
    output: 25.0,
  },
  "claude-opus-4-6": {
    cachedInputRead: 0.5,
    cachedInputWrite: { "1h": 10.0, "5m": 6.25 },
    input: 5.0,
    output: 25.0,
  },
  "claude-opus-4-7": {
    cachedInputRead: 0.5,
    cachedInputWrite: { "1h": 10.0, "5m": 6.25 },
    input: 5.0,
    output: 25.0,
  },
  "claude-opus-4-8": {
    cachedInputRead: 0.5,
    cachedInputWrite: { "1h": 10.0, "5m": 6.25 },
    input: 5.0,
    output: 25.0,
  },
  "claude-opus-5": {
    cachedInputRead: 0.5,
    cachedInputWrite: { "1h": 10.0, "5m": 6.25 },
    input: 5.0,
    output: 25.0,
  },
  "claude-sonnet-4-20250514": {
    cachedInputRead: 0.3,
    cachedInputWrite: { "1h": 6.0, "5m": 3.75 },
    input: 3.0,
    output: 15.0,
  },
  "claude-sonnet-4-5": {
    cachedInputRead: 0.3,
    cachedInputWrite: { "1h": 6.0, "5m": 3.75 },
    input: 3.0,
    output: 15.0,
  },
  "claude-sonnet-4-6": {
    cachedInputRead: 0.3,
    cachedInputWrite: { "1h": 6.0, "5m": 3.75 },
    input: 3.0,
    output: 15.0,
  },
  "claude-sonnet-5": {
    cachedInputRead: 0.3,
    cachedInputWrite: { "1h": 6.0, "5m": 3.75 },
    input: 3.0,
    output: 15.0,
  },
  // Fireworks — https://docs.fireworks.ai/serverless/pricing
  "accounts/fireworks/models/deepseek-v4-pro": {
    cachedInputRead: 0.145,
    input: 1.74,
    output: 3.48,
  },
  "accounts/fireworks/models/glm-5p2": {
    cachedInputRead: 0.14,
    input: 1.4,
    output: 4.4,
  },
  "accounts/fireworks/models/gpt-oss-120b": {
    cachedInputRead: 0.015,
    input: 0.15,
    output: 0.6,
  },
  "accounts/fireworks/models/inkling": {
    cachedInputRead: 0.17,
    input: 1.0,
    output: 4.05,
  },
  // Superseded by kimi-k3 on 2026-08-02; priced here so historic usage stays
  // replayable.
  "accounts/fireworks/models/kimi-k2p7-code": {
    cachedInputRead: 0.19,
    input: 0.95,
    output: 4.0,
  },
  "accounts/fireworks/models/kimi-k3": {
    cachedInputRead: 0.3,
    input: 3.0,
    output: 15.0,
  },
  "accounts/fireworks/models/minimax-m2p7": {
    cachedInputRead: 0.06,
    input: 0.3,
    output: 1.2,
  },
  // Returned to MODEL.* on 2026-08-02. It was retired 2026-07-21 for
  // nondeterministic structured output (clean JSON, prose, or an empty array
  // from the same request); watch the `structured` matrix cell.
  "accounts/fireworks/models/nemotron-3-ultra-nvfp4": {
    cachedInputRead: 0.12,
    input: 0.6,
    output: 2.4,
  },
  "accounts/fireworks/models/qwen3p7-plus": {
    cachedInputRead: 0.08,
    input: 0.4,
    output: 1.6,
  },
  // Google — https://ai.google.dev/gemini-api/docs/pricing
  "gemini-2.5-flash": { cachedInputRead: 0.03, input: 0.3, output: 2.5 },
  "gemini-3.1-flash-lite": {
    cachedInputRead: 0.025,
    input: 0.25,
    output: 1.5,
  },
  "gemini-3.1-flash-lite-preview": {
    cachedInputRead: 0.025,
    input: 0.25,
    output: 1.5,
  },
  "gemini-3.1-pro-preview": { cachedInputRead: 0.2, input: 2.0, output: 12.0 },
  "gemini-3.5-flash": { cachedInputRead: 0.15, input: 1.5, output: 9.0 },
  // Flash-Lite 3.5 has no separate cache-read rate on the standard tier
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.6-flash": { cachedInputRead: 0.15, input: 1.5, output: 7.5 },
  // OpenAI — https://developers.openai.com/api/docs/pricing
  "gpt-5.4": { cachedInputRead: 0.25, input: 2.5, output: 15.0 },
  "gpt-5.4-mini": { cachedInputRead: 0.075, input: 0.75, output: 4.5 },
  "gpt-5.4-nano": { cachedInputRead: 0.02, input: 0.2, output: 1.25 },
  "gpt-5.5": { cachedInputRead: 0.5, input: 5.0, output: 30.0 },
  "gpt-5.6-luna": { cachedInputRead: 0.1, input: 1.0, output: 6.0 },
  "gpt-5.6-sol": { cachedInputRead: 0.5, input: 5.0, output: 30.0 },
  "gpt-5.6-terra": { cachedInputRead: 0.25, input: 2.5, output: 15.0 },
  // xAI — https://docs.x.ai/docs/models
  // Rates are the sub-200K tier; xAI doubles every figure at or above 200K
  // input tokens, which is the long-prompt surcharge COST excludes by policy.
  // Ids verified against GET /v1/models (2026-08-02). Release order is
  // 4.1 < 4.20 < 4.3 < 4.5: "4.20" is 4.2.0 with the patch segment kept, not
  // minor version twenty. Read as semver it looks newer than 4.3, and both a
  // string sort and a numeric sort of the minor segment put it there. It is
  // not. Do not "fix" the ordering of these keys.
  // The grok-4-1-fast pair is retired — absent from both the models endpoint
  // and the pricing table — and keeps its entry so usage stays replayable.
  // grok-imagine-* are image and video models, priced per asset rather than
  // per token, which LlmModelCost cannot express; they are deliberately absent.
  "grok-4-1-fast-non-reasoning": {
    cachedInputRead: 0.05,
    input: 0.2,
    output: 0.5,
  },
  "grok-4-1-fast-reasoning": {
    cachedInputRead: 0.05,
    input: 0.2,
    output: 0.5,
  },
  "grok-4.20-0309-non-reasoning": {
    cachedInputRead: 0.2,
    input: 1.25,
    output: 2.5,
  },
  "grok-4.20-0309-reasoning": {
    cachedInputRead: 0.2,
    input: 1.25,
    output: 2.5,
  },
  "grok-4.20-multi-agent-0309": {
    cachedInputRead: 0.2,
    input: 1.25,
    output: 2.5,
  },
  "grok-4.3": { cachedInputRead: 0.2, input: 1.25, output: 2.5 },
  "grok-4.5": { cachedInputRead: 0.3, input: 2.0, output: 6.0 },
  "grok-build-0.1": { cachedInputRead: 0.2, input: 1.0, output: 2.0 },
  // Mistral — https://docs.mistral.ai/models/overview
  // Cached prompt tokens bill at 10% of the standard input rate. Note the
  // marketing FAQ at mistral.ai/pricing still quotes $2/$6 for "Mistral
  // Large" — that is stale copy describing Large 2; the model cards govern.
  // mistral-ocr-4-0 is deliberately unpriced: it bills per page ($4/1000,
  // $5/1000 annotated), which LlmModelCost cannot express.
  // Keys are dated ids only. `MODEL.MISTRAL.*` names `-latest` aliases, so a
  // lookup on `COST[MODEL.MISTRAL.LARGE]` misses by design: an alias has no
  // stable price, and an entry under one would quietly go stale the moment
  // Mistral repointed it. Resolve the alias to the id the API echoes on the
  // response and price that. Callers must handle a miss regardless.
  //
  // Medium is **priced but not exported**. It is absent from MODEL.MISTRAL
  // because it cannot combine tools with structured output reliably, but a
  // caller can still pass the id directly and usage records reference it.
  // Pricing a model is not endorsing it; COST answers "what did this cost",
  // not "what should be used".
  "mistral-large-2512": { cachedInputRead: 0.05, input: 0.5, output: 1.5 },
  "mistral-medium-3-5": { cachedInputRead: 0.15, input: 1.5, output: 7.5 },
  "mistral-small-2603": { cachedInputRead: 0.015, input: 0.15, output: 0.6 },
};

const GOOGLE_PROVIDER = {
  // https://ai.google.dev/gemini-api/docs/models
  DEFAULT: MODEL.GEMINI_FLASH,
  /** @deprecated Size tiers are retired in 2.0 and these values are frozen; repointing a tier at a newer model only prolongs its use. Use PROVIDER.GOOGLE.DEFAULT, or pick a specific model from MODEL.*. */
  MODEL: {
    DEFAULT: "gemini-3.1-pro-preview",
    LARGE: "gemini-3.1-pro-preview",
    SMALL: "gemini-3.5-flash",
    TINY: "gemini-3.1-flash-lite",
  },
  MODEL_MATCH_WORDS: ["gemini", "google"] as const,
  NAME: "google" as const,
  ROLE: {
    MODEL: "model" as const,
    USER: "user" as const,
  },
} as const;

export const PROVIDER = {
  // https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html
  BEDROCK: {
    // nova-pro is the Amazon-native model that reliably does tools+structured.
    DEFAULT: MODEL.NOVA_PRO,
    /** @deprecated Size tiers are retired in 2.0 and these values are frozen; repointing a tier at a newer model only prolongs its use. Use PROVIDER.BEDROCK.DEFAULT, or pick a specific model from MODEL.NOVA_*. */
    MODEL: {
      DEFAULT: MODEL.NOVA_LITE,
      LARGE: MODEL.NOVA_PRO,
      SMALL: MODEL.NOVA_LITE,
      TINY: MODEL.NOVA_LITE,
    },
    MODEL_MATCH_WORDS: [
      "ai21.",
      "amazon.nova",
      "amazon.titan",
      "anthropic.claude",
      "cohere.command",
      "deepseek.",
      "google.gemma",
      "meta.llama",
      "mistral.mistral",
      "moonshotai.",
      "openai.gpt-oss",
      "qwen.",
    ] as const,
    NAME: "bedrock" as const,
    REGION: "AWS_REGION" as const,
  },
  ANTHROPIC: {
    // https://docs.anthropic.com/en/docs/about-claude/models/overview
    DEFAULT: MODEL.SONNET,
    MAX_TOKENS: {
      // Non-streaming ceiling: responses above ~16K output tokens risk HTTP
      // timeouts; streaming requests resolve to the model maximum instead
      // (see util/maxOutputTokens.ts)
      DEFAULT: 16384 as const,
    },
    /** @deprecated Size tiers are retired in 2.0 and these values are frozen; repointing a tier at a newer model only prolongs its use. Use PROVIDER.ANTHROPIC.DEFAULT, or pick a specific model from MODEL.*. */
    MODEL: {
      DEFAULT: "claude-sonnet-4-6",
      LARGE: "claude-opus-4-8",
      SMALL: "claude-sonnet-4-6",
      TINY: "claude-haiku-4-5",
    },
    MODEL_MATCH_WORDS: [
      "anthropic",
      "claude",
      "fable",
      "haiku",
      "mythos",
      "opus",
      "sonnet",
    ] as const,
    NAME: "anthropic" as const,
    PROMPT: {
      AI: "\n\nAssistant:" as const,
      HUMAN: "\n\nHuman:" as const,
    },
    ROLE: {
      ASSISTANT: "assistant" as const,
      SYSTEM: "system" as const,
      USER: "user" as const,
    },
    TOOLS: {
      SCHEMA_VERSION: "v2" as const,
    },
  },
  FIREWORKS: {
    // https://docs.fireworks.ai/
    API_KEY: "FIREWORKS_API_KEY" as const,
    BASE_URL: "https://api.fireworks.ai/inference/v1" as const,
    DEFAULT: MODEL.FIREWORKS.GLM,
    MODEL_MATCH_WORDS: ["fireworks"] as const,
    NAME: "fireworks" as const,
  },
  /** @deprecated Use PROVIDER.GOOGLE — "Google" is the provider; Gemini is the model family */
  GEMINI: GOOGLE_PROVIDER,
  GOOGLE: GOOGLE_PROVIDER,
  MISTRAL: {
    // https://docs.mistral.ai/models/overview
    API_KEY: "MISTRAL_API_KEY" as const,
    BASE_URL: "https://api.mistral.ai/v1" as const,
    DEFAULT: MODEL.MISTRAL.LARGE,
    // Most Mistral family names do not contain the substring "mistral" —
    // "ministral" is m-i-n-i-s-t-r-a-l, and codestral/devstral/pixtral/voxtral
    // share only the "-tral" suffix — so each family needs its own word.
    MODEL_MATCH_WORDS: [
      "codestral",
      "devstral",
      "magistral",
      "ministral",
      "mistral",
      "pixtral",
      "voxtral",
    ] as const,
    NAME: "mistral" as const,
    OCR: MODEL.MISTRAL.OCR,
  },
  OPENAI: {
    // https://platform.openai.com/docs/models
    DEFAULT: MODEL.SOL,
    /** @deprecated Size tiers are retired in 2.0 and these values are frozen; repointing a tier at a newer model only prolongs its use. Use PROVIDER.OPENAI.DEFAULT, or pick a specific model from MODEL.*. */
    MODEL: {
      DEFAULT: "gpt-5.4",
      LARGE: "gpt-5.5",
      SMALL: "gpt-5.4-mini",
      TINY: "gpt-5.4-nano",
    },
    MODEL_MATCH_WORDS: ["gpt", "luna", "openai", "sol", "terra", /^o\d/],
    NAME: "openai" as const,
  },
  OPENROUTER: {
    DEFAULT: MODEL.OPENROUTER.SONNET,
    /** @deprecated Size tiers are retired in 2.0 and these values are frozen; repointing a tier at a newer model only prolongs its use. Use PROVIDER.OPENROUTER.DEFAULT, or pick a specific route from MODEL.OPENROUTER.*. */
    MODEL: {
      DEFAULT: "anthropic/claude-sonnet-4-6" as const,
      LARGE: "anthropic/claude-opus-4-8" as const,
      SMALL: "anthropic/claude-sonnet-4-6" as const,
      TINY: "anthropic/claude-haiku-4-5" as const,
    },
    MODEL_MATCH_WORDS: ["openrouter"] as const,
    NAME: "openrouter" as const,
    ROLE: {
      ASSISTANT: "assistant" as const,
      SYSTEM: "system" as const,
      TOOL: "tool" as const,
      USER: "user" as const,
    },
  },
  XAI: {
    // https://docs.x.ai/docs/models
    API_KEY: "XAI_API_KEY" as const,
    BASE_URL: "https://api.x.ai/v1" as const,
    DEFAULT: MODEL.GROK,
    /** @deprecated Size tiers are retired in 2.0 and these values are frozen; repointing a tier at a newer model only prolongs its use. Use PROVIDER.XAI.DEFAULT, or pick a specific model from MODEL.*. */
    MODEL: {
      DEFAULT: "grok-latest",
      LARGE: "grok-latest",
      SMALL: "grok-4-1-fast-reasoning",
      TINY: "grok-4-1-fast-non-reasoning",
    },
    MODEL_MATCH_WORDS: ["grok", "xai"] as const,
    NAME: "xai" as const,
  },
} as const;

export type LlmProviderName =
  | typeof PROVIDER.ANTHROPIC.NAME
  | typeof PROVIDER.BEDROCK.NAME
  | typeof PROVIDER.FIREWORKS.NAME
  | typeof PROVIDER.GOOGLE.NAME
  | typeof PROVIDER.MISTRAL.NAME
  | typeof PROVIDER.OPENAI.NAME
  | typeof PROVIDER.OPENROUTER.NAME
  | typeof PROVIDER.XAI.NAME;

// Last: Defaults
export const DEFAULT = {
  /** @deprecated Size tiers are retired in 2.0 and these values are frozen; repointing a tier at a newer model only prolongs its use. Use DEFAULT.PROVIDER.DEFAULT, or pick a specific model from MODEL.*. */
  MODEL: {
    BASE: PROVIDER.OPENAI.MODEL.DEFAULT,
    LARGE: PROVIDER.OPENAI.MODEL.LARGE,
    SMALL: PROVIDER.OPENAI.MODEL.SMALL,
    TINY: PROVIDER.OPENAI.MODEL.TINY,
  },
  PROVIDER: PROVIDER.OPENAI,
} as const;

/**
 * @deprecated Size-tier catalogs are retired in 2.0. Pick specific models from
 * MODEL.* (grouped by provider via MODEL_MATCH_WORDS / determineModelProvider).
 */
// Only include "first class" models, not OpenRouter or other proxy services
export const ALL = {
  BASE: [
    PROVIDER.ANTHROPIC.MODEL.DEFAULT,
    PROVIDER.GOOGLE.MODEL.DEFAULT,
    PROVIDER.OPENAI.MODEL.DEFAULT,
    PROVIDER.XAI.MODEL.DEFAULT,
  ],
  COMBINED: [
    ...new Set([
      PROVIDER.ANTHROPIC.MODEL.DEFAULT,
      PROVIDER.ANTHROPIC.MODEL.LARGE,
      PROVIDER.ANTHROPIC.MODEL.SMALL,
      PROVIDER.ANTHROPIC.MODEL.TINY,
      PROVIDER.GOOGLE.MODEL.DEFAULT,
      PROVIDER.GOOGLE.MODEL.LARGE,
      PROVIDER.GOOGLE.MODEL.SMALL,
      PROVIDER.GOOGLE.MODEL.TINY,
      PROVIDER.OPENAI.MODEL.DEFAULT,
      PROVIDER.OPENAI.MODEL.LARGE,
      PROVIDER.OPENAI.MODEL.SMALL,
      PROVIDER.OPENAI.MODEL.TINY,
      PROVIDER.XAI.MODEL.DEFAULT,
      PROVIDER.XAI.MODEL.LARGE,
      PROVIDER.XAI.MODEL.SMALL,
      PROVIDER.XAI.MODEL.TINY,
    ]),
  ],
  LARGE: [
    PROVIDER.ANTHROPIC.MODEL.LARGE,
    PROVIDER.GOOGLE.MODEL.LARGE,
    PROVIDER.OPENAI.MODEL.LARGE,
    PROVIDER.XAI.MODEL.LARGE,
  ],
  SMALL: [
    PROVIDER.ANTHROPIC.MODEL.SMALL,
    PROVIDER.GOOGLE.MODEL.SMALL,
    PROVIDER.OPENAI.MODEL.SMALL,
    PROVIDER.XAI.MODEL.SMALL,
  ],
  TINY: [
    PROVIDER.ANTHROPIC.MODEL.TINY,
    PROVIDER.GOOGLE.MODEL.TINY,
    PROVIDER.OPENAI.MODEL.TINY,
    PROVIDER.XAI.MODEL.TINY,
  ],
} as const;
