export const PROVIDER = {
  ANTHROPIC: {
    MODEL: {
      CLAUDE_3_HAIKU: "claude-3-5-haiku-latest" as const,
      CLAUDE_3_OPUS: "claude-3-opus-latest" as const,
      CLAUDE_3_SONNET: "claude-3-5-sonnet-latest" as const,
      DEFAULT: "claude-3-5-sonnet-latest" as const,
    },
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
    MAX_TOKENS: {
      DEFAULT: 4096 as const,
    },
    TOOLS: {
      SCHEMA_VERSION: "v2" as const,
    },
  },
  OPENAI: {
    MODEL: {
      DEFAULT: "gpt-4o" as const,
      GPT_4: "gpt-4" as const,
      GPT_4_O_MINI: "gpt-4o-mini" as const,
      GPT_4_O: "gpt-4o" as const,
      GPT_4_5: "gpt-4.5-preview" as const,
      O1: "o1" as const,
      O1_MINI: "o1-mini" as const,
      O1_PRO: "o1-pro" as const,
      O3_MINI: "o3-mini" as const,
      O3_MINI_HIGH: "o3-mini-high" as const,
    },
    NAME: "openai" as const,
  },
  OPENROUTER: {
    MODEL: {
      DEFAULT: "google/gemini-2.0-flash-001" as const,
      DEEPSEEK_V3: "deepseek/deepseek-chat-v3-0324" as const,
    },
    NAME: "openrouter" as const,
    ROLE: {
      ASSISTANT: "assistant" as const,
      SYSTEM: "system" as const,
      USER: "user" as const,
    },
    MAX_TOKENS: {
      DEFAULT: 4096 as const,
    },
  },
} as const;

export type LlmProviderName =
  | typeof PROVIDER.OPENAI.NAME
  | typeof PROVIDER.ANTHROPIC.NAME
  | typeof PROVIDER.OPENROUTER.NAME;

// Last: Defaults
export const DEFAULT = {
  PROVIDER: PROVIDER.OPENAI,
} as const;
