export const PROVIDER = {
  ANTHROPIC: {
    // https://docs.anthropic.com/en/docs/about-claude/models/overview
    MODEL: {
      // Jaypie Aliases
      DEFAULT: "claude-opus-4-1" as const,
      SMALL: "claude-sonnet-4-0" as const,
      TINY: "claude-3-5-haiku-latest" as const,
      LARGE: "claude-opus-4-1" as const,
      // Latests
      CLAUDE_OPUS_4: "claude-opus-4-1" as const,
      CLAUDE_SONNET_4: "claude-sonnet-4-0" as const,
      CLAUDE_3_HAIKU: "claude-3-5-haiku-latest" as const,
      CLAUDE_3_OPUS: "claude-3-opus-latest" as const,
      CLAUDE_3_SONNET: "claude-3-7-sonnet-latest" as const,
      // Specifics
      CLAUDE_OPUS_4_1: "claude-opus-4-1" as const,
      CLAUDE_OPUS_4_0: "claude-opus-4-0" as const,
      CLAUDE_SONNET_4_0: "claude-sonnet-4-0" as const,
      CLAUDE_3_7_SONNET: "claude-3-7-sonnet-latest	" as const,
      CLAUDE_3_5_SONNET: "claude-3-5-sonnet-latest" as const,
      CLAUDE_3_5_HAIKU: "claude-3-5-haiku-latest" as const,
      // _Note: Claude reversed the order of model name and version in 4_
      // Backward compatibility
      CLAUDE_HAIKU_3: "claude-3-5-haiku-latest" as const,
      CLAUDE_OPUS_3: "claude-3-opus-latest" as const,
      CLAUDE_SONNET_3: "claude-3-7-sonnet-latest" as const,
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
    // https://platform.openai.com/docs/models
    MODEL: {
      // Jaypie Aliases
      DEFAULT: "gpt-5" as const,
      SMALL: "gpt-5-mini" as const,
      LARGE: "gpt-5" as const,
      TINY: "gpt-5-nano" as const,
      // OpenAI Official
      GPT_5: "gpt-5" as const,
      GPT_5_MINI: "gpt-5-mini" as const,
      GPT_5_NANO: "gpt-5-nano" as const,
      GPT_4_1: "gpt-4.1" as const,
      GPT_4_1_MINI: "gpt-4.1-mini" as const,
      GPT_4_1_NANO: "gpt-4.1-nano" as const,
      GPT_4: "gpt-4" as const,
      GPT_4_O_MINI: "gpt-4o-mini" as const,
      GPT_4_O: "gpt-4o" as const,
      GPT_4_5: "gpt-4.5-preview" as const,
      O1: "o1" as const,
      O1_MINI: "o1-mini" as const,
      O1_PRO: "o1-pro" as const,
      O3_MINI: "o3-mini" as const,
      O3_MINI_HIGH: "o3-mini-high" as const,
      O3: "o3" as const,
      O3_PRO: "o3-pro" as const,
      O4_MINI: "o4-mini" as const,
    },
    NAME: "openai" as const,
  },
} as const;

export type LlmProviderName =
  | typeof PROVIDER.OPENAI.NAME
  | typeof PROVIDER.ANTHROPIC.NAME;

// Last: Defaults
export const DEFAULT = {
  PROVIDER: PROVIDER.OPENAI,
} as const;
