const FIRST_CLASS_PROVIDER = {
  // https://docs.anthropic.com/en/docs/about-claude/models/overview
  ANTHROPIC: {
    DEFAULT: "claude-sonnet-4-6" as const,
    LARGE: "claude-opus-4-6" as const,
    SMALL: "claude-sonnet-4-6" as const,
    TINY: "claude-haiku-4-5" as const,
  },
  // https://ai.google.dev/gemini-api/docs/models
  GEMINI: {
    DEFAULT: "gemini-3.1-pro-preview" as const,
    LARGE: "gemini-3.1-pro-preview" as const,
    SMALL: "gemini-3-flash-preview" as const,
    TINY: "gemini-3.1-flash-lite-preview" as const,
  },
  // https://developers.openai.com/api/docs/models
  OPENAI: {
    DEFAULT: "gpt-5.4" as const,
    LARGE: "gpt-5.4" as const,
    SMALL: "gpt-5.4-mini" as const,
    TINY: "gpt-5.4-nano" as const,
  },
  // https://docs.x.ai/developers/models
  XAI: {
    DEFAULT: "grok-4.20-0309-reasoning" as const,
    LARGE: "grok-4.20-0309-reasoning" as const,
    SMALL: "grok-4.20-0309-non-reasoning" as const,
    TINY: "grok-4-1-fast-non-reasoning" as const,
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
    MODEL: {
      DEFAULT: FIRST_CLASS_PROVIDER.XAI.DEFAULT,
      LARGE: FIRST_CLASS_PROVIDER.XAI.LARGE,
      SMALL: FIRST_CLASS_PROVIDER.XAI.SMALL,
      TINY: FIRST_CLASS_PROVIDER.XAI.TINY,
    },
    MODEL_MATCH_WORDS: ["grok", "xai"] as const,
    NAME: "xai" as const,
  },
} as const;

export type LlmProviderName =
  | typeof PROVIDER.ANTHROPIC.NAME
  | typeof PROVIDER.GEMINI.NAME
  | typeof PROVIDER.OPENAI.NAME
  | typeof PROVIDER.OPENROUTER.NAME
  | typeof PROVIDER.XAI.NAME;

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
    PROVIDER.XAI.MODEL.DEFAULT,
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
    PROVIDER.XAI.MODEL.DEFAULT,
    PROVIDER.XAI.MODEL.LARGE,
    PROVIDER.XAI.MODEL.SMALL,
    PROVIDER.XAI.MODEL.TINY,
  ],
  LARGE: [
    PROVIDER.ANTHROPIC.MODEL.LARGE,
    PROVIDER.GEMINI.MODEL.LARGE,
    PROVIDER.OPENAI.MODEL.LARGE,
    PROVIDER.XAI.MODEL.LARGE,
  ],
  SMALL: [
    PROVIDER.ANTHROPIC.MODEL.SMALL,
    PROVIDER.GEMINI.MODEL.SMALL,
    PROVIDER.OPENAI.MODEL.SMALL,
    PROVIDER.XAI.MODEL.SMALL,
  ],
  TINY: [
    PROVIDER.ANTHROPIC.MODEL.TINY,
    PROVIDER.GEMINI.MODEL.TINY,
    PROVIDER.OPENAI.MODEL.TINY,
    PROVIDER.XAI.MODEL.TINY,
  ],
} as const;
