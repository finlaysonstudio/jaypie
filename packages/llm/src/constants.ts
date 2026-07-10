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
  // Anthropic
  FABLE: "claude-fable-5",
  OPUS: "claude-opus-4-8",
  SONNET: "claude-sonnet-5",
  HAIKU: "claude-haiku-4-5",
  MYTHOS: "claude-mythos-5",
  // Google
  GEMINI_FLASH: "gemini-3.5-flash",
  GEMINI_FLASH_LITE: "gemini-3.1-flash-lite",
  GEMINI_PRO: "gemini-3.1-pro-preview",
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
  GROK: "grok-latest",
  // OpenRouter (provider-prefixed routes; traversed by the OpenRouter hot test)
  OPENROUTER: {
    GLM: "z-ai/glm-5.2",
    LUNA: "openai/gpt-5.6-luna",
    SONNET: "anthropic/claude-sonnet-5",
  },
};

const GOOGLE_PROVIDER = {
  // https://ai.google.dev/gemini-api/docs/models
  DEFAULT: MODEL.GEMINI_FLASH,
  /** @deprecated Size tiers are retired in 2.0. Use PROVIDER.GOOGLE.DEFAULT, or pick a specific model from MODEL.*. */
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
    // Bedrock has no MODEL.* catalog entry yet; keep the literal default id.
    DEFAULT: "amazon.nova-lite-v1:0" as const,
    /** @deprecated Size tiers are retired in 2.0. Use PROVIDER.BEDROCK.DEFAULT. */
    MODEL: {
      DEFAULT: "amazon.nova-lite-v1:0" as const,
      LARGE: "amazon.nova-pro-v1:0" as const,
      SMALL: "amazon.nova-lite-v1:0" as const,
      TINY: "amazon.nova-micro-v1:0" as const,
    },
    MODEL_MATCH_WORDS: [
      "amazon.nova",
      "amazon.titan",
      "anthropic.claude",
      "cohere.command",
      "meta.llama",
      "mistral.mistral",
      "ai21.",
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
    /** @deprecated Size tiers are retired in 2.0. Use PROVIDER.ANTHROPIC.DEFAULT, or pick a specific model from MODEL.*. */
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
  /** @deprecated Use PROVIDER.GOOGLE — "Google" is the provider; Gemini is the model family */
  GEMINI: GOOGLE_PROVIDER,
  GOOGLE: GOOGLE_PROVIDER,
  OPENAI: {
    // https://platform.openai.com/docs/models
    DEFAULT: MODEL.SOL,
    /** @deprecated Size tiers are retired in 2.0. Use PROVIDER.OPENAI.DEFAULT, or pick a specific model from MODEL.*. */
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
    /** @deprecated Size tiers are retired in 2.0. Use PROVIDER.OPENROUTER.DEFAULT, or pick a specific route from MODEL.OPENROUTER.*. */
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
    /** @deprecated Size tiers are retired in 2.0. Use PROVIDER.XAI.DEFAULT, or pick a specific model from MODEL.*. */
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
  | typeof PROVIDER.GOOGLE.NAME
  | typeof PROVIDER.OPENAI.NAME
  | typeof PROVIDER.OPENROUTER.NAME
  | typeof PROVIDER.XAI.NAME;

// Last: Defaults
export const DEFAULT = {
  /** @deprecated Size tiers are retired in 2.0. Use DEFAULT.PROVIDER.DEFAULT, or pick a specific model from MODEL.*. */
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
