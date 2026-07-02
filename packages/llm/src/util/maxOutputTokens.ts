import { PROVIDER } from "../constants.js";

//
//
// Constants
//

// Non-streaming requests above ~16K output tokens risk HTTP timeouts
// (Anthropic guidance is to stream anything larger), so non-streaming
// defaults are capped here and only streaming requests resolve to the
// full model maximum.
const NON_STREAMING_MAX_TOKENS = PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT;

// Maximum output tokens by model; first match wins.
// Providers without low output ceilings (OpenAI, xAI) are intentionally
// absent — their requests leave the limit unset.
const MODEL_MAX_OUTPUT_TOKENS: { pattern: RegExp; tokens: number }[] = [
  // Anthropic — https://platform.claude.com/docs/en/about-claude/models/overview
  { pattern: /^claude-opus-4-(0$|1$|1-|2025)/, tokens: 32_000 },
  { pattern: /^claude-opus-4-5/, tokens: 64_000 },
  { pattern: /^claude-sonnet-4-(0$|5$|5-|2025)/, tokens: 64_000 },
  { pattern: /haiku/, tokens: 64_000 },
  { pattern: /claude|fable|mythos|opus|sonnet/, tokens: 128_000 },
  // Google — https://ai.google.dev/gemini-api/docs/models
  { pattern: /gemini-(2\.5|3)/, tokens: 65_536 },
  { pattern: /gemini/, tokens: 8_192 },
];

//
//
// Main
//

/**
 * Maximum output tokens the model supports, or undefined when unknown.
 */
export function maxOutputTokens(model: string): number | undefined {
  const match = MODEL_MAX_OUTPUT_TOKENS.find(({ pattern }) =>
    pattern.test(model),
  );
  return match?.tokens;
}

/**
 * Default output token limit for a request: the model maximum when
 * streaming, capped at the non-streaming maximum otherwise. Returns
 * undefined when the model's maximum is unknown.
 */
export function resolveMaxOutputTokens(
  model: string,
  { stream = false }: { stream?: boolean } = {},
): number | undefined {
  const max = maxOutputTokens(model);
  if (max === undefined) return undefined;
  return stream ? max : Math.min(max, NON_STREAMING_MAX_TOKENS);
}
