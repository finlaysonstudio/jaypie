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

// Validation types
export interface LlmProviderStatus {
  available: boolean;
}

export interface LlmValidationResult {
  success: boolean;
  providers: {
    anthropic: LlmProviderStatus;
    google: LlmProviderStatus;
    openai: LlmProviderStatus;
    openrouter: LlmProviderStatus;
  };
  availableCount: number;
  totalProviders: number;
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

const TOTAL_PROVIDERS = 4;

/**
 * Validate LLM setup without making API calls
 */
export function validateLlmSetup(): LlmValidationResult {
  const anthropicAvailable = Boolean(process.env.ANTHROPIC_API_KEY);
  const googleAvailable = Boolean(process.env.GOOGLE_API_KEY);
  const openaiAvailable = Boolean(process.env.OPENAI_API_KEY);
  const openrouterAvailable = Boolean(process.env.OPENROUTER_API_KEY);

  const availableCount = [
    anthropicAvailable,
    googleAvailable,
    openaiAvailable,
    openrouterAvailable,
  ].filter(Boolean).length;

  return {
    availableCount,
    providers: {
      anthropic: { available: anthropicAvailable },
      google: { available: googleAvailable },
      openai: { available: openaiAvailable },
      openrouter: { available: openrouterAvailable },
    },
    success: availableCount > 0,
    totalProviders: TOTAL_PROVIDERS,
  };
}

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
