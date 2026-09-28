import { LlmUsageItem } from "../types/LlmProvider.interface.js";

//
//
// Types
//

/**
 * Usage as OpenAI-compatible chat-completions APIs report it. SDKs return
 * camelCase and raw HTTP returns snake_case, so both spellings are read.
 */
export interface ChatCompletionsUsage {
  completionTokens?: number;
  completionTokensDetails?: { reasoningTokens?: number };
  completion_tokens?: number;
  completion_tokens_details?: { reasoning_tokens?: number };
  promptTokens?: number;
  promptTokensDetails?: {
    cacheWriteTokens?: number;
    cache_write_tokens?: number;
    cachedTokens?: number;
    cached_tokens?: number;
  };
  prompt_tokens?: number;
  prompt_tokens_details?: {
    cache_write_tokens?: number;
    cached_tokens?: number;
  };
  totalTokens?: number;
  total_tokens?: number;
}

//
//
// Main
//

/**
 * Map chat-completions usage to `LlmUsageItem`. `prompt_tokens` already
 * includes cached tokens and `completion_tokens` already includes reasoning,
 * so `cacheRead`/`cacheWrite` and `reasoning` are subsets as the contract
 * requires. Missing usage maps to zeros.
 */
export function chatCompletionsUsage(
  usage: ChatCompletionsUsage | undefined,
  { model, provider }: { model: string; provider: string },
): LlmUsageItem {
  const promptDetails = usage?.promptTokensDetails;
  const promptDetailsSnake = usage?.prompt_tokens_details;
  const input = usage?.promptTokens || usage?.prompt_tokens || 0;
  const output = usage?.completionTokens || usage?.completion_tokens || 0;
  const cacheRead =
    promptDetails?.cachedTokens ??
    promptDetails?.cached_tokens ??
    promptDetailsSnake?.cached_tokens;
  const cacheWrite =
    promptDetails?.cacheWriteTokens ??
    promptDetails?.cache_write_tokens ??
    promptDetailsSnake?.cache_write_tokens;
  return {
    input,
    output,
    reasoning:
      usage?.completionTokensDetails?.reasoningTokens ||
      usage?.completion_tokens_details?.reasoning_tokens ||
      0,
    total: usage?.totalTokens || usage?.total_tokens || input + output,
    ...(cacheRead ? { cacheRead } : {}),
    ...(cacheWrite ? { cacheWrite } : {}),
    provider,
    model,
  };
}
