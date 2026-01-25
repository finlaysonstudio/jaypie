/**
 * LLM debugging utilities for inspecting raw provider responses
 */

import { LLM, Llm } from "@jaypie/llm";

export type LlmProvider = "anthropic" | "gemini" | "openai" | "openrouter";

export interface LlmDebugCallParams {
  provider: LlmProvider;
  model?: string;
  message: string;
}

export interface LlmDebugCallResult {
  success: boolean;
  provider: string;
  model: string;
  content?: string;
  reasoning?: string[];
  reasoningTokens?: number;
  history?: unknown[];
  rawResponses?: unknown[];
  usage?: unknown[];
  error?: string;
}

interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

// Default models for each provider
const DEFAULT_MODELS: Record<LlmProvider, string> = {
  anthropic: LLM.PROVIDER.ANTHROPIC.MODEL.SMALL,
  gemini: LLM.PROVIDER.GEMINI.MODEL.SMALL,
  openai: LLM.PROVIDER.OPENAI.MODEL.SMALL,
  openrouter: LLM.PROVIDER.OPENROUTER.MODEL.SMALL,
};

// Reasoning-capable models for testing reasoning extraction
export const REASONING_MODELS: Record<string, string> = {
  "openai-o3-mini": "o3-mini",
  "openai-o1-preview": "o1-preview",
  "openai-o1-mini": "o1-mini",
};

/**
 * Make a debug LLM call and return the raw response data for inspection
 */
export async function debugLlmCall(
  params: LlmDebugCallParams,
  log: Logger,
): Promise<LlmDebugCallResult> {
  const { provider, message } = params;
  const model = params.model || DEFAULT_MODELS[provider];

  log.info(`Making debug LLM call to ${provider} with model ${model}`);

  try {
    const llm = new Llm(provider, { model });

    const result = await llm.operate(message, {
      user: "[jaypie-mcp] Debug LLM Call",
    });

    if (result.error) {
      return {
        success: false,
        provider,
        model,
        error: `${result.error.title}: ${result.error.detail || "Unknown error"}`,
      };
    }

    // Calculate total reasoning tokens
    const reasoningTokens = result.usage.reduce(
      (sum, u) => sum + (u.reasoning || 0),
      0,
    );

    return {
      success: true,
      provider,
      model,
      content:
        typeof result.content === "string"
          ? result.content
          : JSON.stringify(result.content),
      reasoning: result.reasoning,
      reasoningTokens,
      history: result.history,
      rawResponses: result.responses,
      usage: result.usage,
    };
  } catch (error) {
    log.error(`Error calling ${provider}:`, error);
    return {
      success: false,
      provider,
      model,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * List available providers and their default/reasoning models
 */
export function listLlmProviders(): {
  providers: Array<{
    name: LlmProvider;
    defaultModel: string;
    reasoningModels: string[];
  }>;
} {
  return {
    providers: [
      {
        name: "openai",
        defaultModel: DEFAULT_MODELS.openai,
        reasoningModels: ["o3-mini", "o1-preview", "o1-mini"],
      },
      {
        name: "anthropic",
        defaultModel: DEFAULT_MODELS.anthropic,
        reasoningModels: [], // Anthropic doesn't expose reasoning the same way
      },
      {
        name: "gemini",
        defaultModel: DEFAULT_MODELS.gemini,
        reasoningModels: [], // Gemini has thoughtsTokenCount but unclear on content
      },
      {
        name: "openrouter",
        defaultModel: DEFAULT_MODELS.openrouter,
        reasoningModels: ["openai/o3-mini", "openai/o1-preview"],
      },
    ],
  };
}
