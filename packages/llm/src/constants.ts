const FIRST_CLASS_PROVIDER = {
  ANTHROPIC: {
    DEFAULT: "claude-sonnet-4-5" as const,
    LARGE: "claude-opus-4-5" as const,
    SMALL: "claude-sonnet-4-5" as const,
    TINY: "claude-haiku-4-5" as const,
  },
  GEMINI: {
    DEFAULT: "gemini-3-pro-preview" as const,
    LARGE: "gemini-3-pro-preview" as const,
    SMALL: "gemini-3-flash-preview" as const,
    TINY: "gemini-3-flash-preview" as const,
  },
  OPENAI: {
    DEFAULT: "gpt-5.2" as const,
    LARGE: "gpt-5.2-pro" as const,
    SMALL: "gpt-5-mini" as const,
    TINY: "gpt-5-nano" as const,
  },
  OPENROUTER: {
    DEFAULT: "z-ai/glm-4.7" as const,
    LARGE: "z-ai/glm-4.7" as const,
    SMALL: "z-ai/glm-4.7" as const,
    TINY: "z-ai/glm-4.7" as const,
  },
};

export const PROVIDER = {
  ANTHROPIC: {
    // https://docs.anthropic.com/en/docs/about-claude/models/overview
    MAX_TOKENS: {
      DEFAULT: 4096 as const,
    },
    MODEL: {
      DEFAULT: FIRST_CLASS_PROVIDER.ANTHROPIC.DEFAULT,
      LARGE: FIRST_CLASS_PROVIDER.ANTHROPIC.LARGE,
      SMALL: FIRST_CLASS_PROVIDER.ANTHROPIC.SMALL,
      TINY: FIRST_CLASS_PROVIDER.ANTHROPIC.TINY,
    },
    MODEL_MATCH_WORDS: [
      "anthropic",
      "claude",
      "haiku",
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
  GEMINI: {
    // https://ai.google.dev/gemini-api/docs/models
    MODEL: {
      DEFAULT: FIRST_CLASS_PROVIDER.GEMINI.DEFAULT,
      LARGE: FIRST_CLASS_PROVIDER.GEMINI.LARGE,
      SMALL: FIRST_CLASS_PROVIDER.GEMINI.SMALL,
      TINY: FIRST_CLASS_PROVIDER.GEMINI.TINY,
    },
    MODEL_MATCH_WORDS: ["gemini", "google"] as const,
    NAME: "google" as const,
    ROLE: {
      MODEL: "model" as const,
      USER: "user" as const,
    },
  },
  OPENAI: {
    // https://platform.openai.com/docs/models
    MODEL: {
      DEFAULT: FIRST_CLASS_PROVIDER.OPENAI.DEFAULT,
      LARGE: FIRST_CLASS_PROVIDER.OPENAI.LARGE,
      SMALL: FIRST_CLASS_PROVIDER.OPENAI.SMALL,
      TINY: FIRST_CLASS_PROVIDER.OPENAI.TINY,
    },
    MODEL_MATCH_WORDS: ["openai", "gpt", /^o\d/],
    NAME: "openai" as const,
  },
  OPENROUTER: {
    // https://openrouter.ai/models
    // OpenRouter provides access to hundreds of models from various providers
    // The model format is: provider/model-name (e.g., "openai/gpt-4", "anthropic/claude-3-opus")
    MODEL: {
      // Default uses env var OPENROUTER_MODEL if set, otherwise a reasonable default
      DEFAULT: FIRST_CLASS_PROVIDER.OPENROUTER.DEFAULT,
      LARGE: FIRST_CLASS_PROVIDER.OPENROUTER.LARGE,
      SMALL: FIRST_CLASS_PROVIDER.OPENROUTER.SMALL,
      TINY: FIRST_CLASS_PROVIDER.OPENROUTER.TINY,
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
} as const;

export type LlmProviderName =
  | typeof PROVIDER.ANTHROPIC.NAME
  | typeof PROVIDER.GEMINI.NAME
  | typeof PROVIDER.OPENAI.NAME
  | typeof PROVIDER.OPENROUTER.NAME;

// Last: Defaults
export const DEFAULT = {
  MODEL: {
    BASE: PROVIDER.OPENAI.MODEL.DEFAULT,
    LARGE: PROVIDER.OPENAI.MODEL.LARGE,
    SMALL: PROVIDER.OPENAI.MODEL.SMALL,
    TINY: PROVIDER.OPENAI.MODEL.TINY,
  },
  PROVIDER: PROVIDER.OPENAI,
} as const;

// Only include "first class" models, not OpenRouter or other proxy services
export const ALL = {
  BASE: [
    PROVIDER.ANTHROPIC.MODEL.DEFAULT,
    PROVIDER.GEMINI.MODEL.DEFAULT,
    PROVIDER.OPENAI.MODEL.DEFAULT,
  ],
  COMBINED: [
    PROVIDER.ANTHROPIC.MODEL.DEFAULT,
    PROVIDER.ANTHROPIC.MODEL.LARGE,
    PROVIDER.ANTHROPIC.MODEL.SMALL,
    PROVIDER.ANTHROPIC.MODEL.TINY,
    PROVIDER.GEMINI.MODEL.DEFAULT,
    PROVIDER.GEMINI.MODEL.LARGE,
    PROVIDER.GEMINI.MODEL.SMALL,
    PROVIDER.GEMINI.MODEL.TINY,
    PROVIDER.OPENAI.MODEL.DEFAULT,
    PROVIDER.OPENAI.MODEL.LARGE,
    PROVIDER.OPENAI.MODEL.SMALL,
    PROVIDER.OPENAI.MODEL.TINY,
  ],
  LARGE: [
    PROVIDER.ANTHROPIC.MODEL.LARGE,
    PROVIDER.GEMINI.MODEL.LARGE,
    PROVIDER.OPENAI.MODEL.LARGE,
  ],
  SMALL: [
    PROVIDER.ANTHROPIC.MODEL.SMALL,
    PROVIDER.GEMINI.MODEL.SMALL,
    PROVIDER.OPENAI.MODEL.SMALL,
  ],
  TINY: [
    PROVIDER.ANTHROPIC.MODEL.TINY,
    PROVIDER.GEMINI.MODEL.TINY,
    PROVIDER.OPENAI.MODEL.TINY,
  ],
} as const;
