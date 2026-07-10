import { EFFORT, type LlmEffort } from "../constants.js";

/**
 * Result of translating the provider-neutral {@link LlmEffort} scale to a
 * provider's native reasoning control.
 */
export interface LlmEffortMapping<T extends string | number = string> {
  /**
   * True when the requested neutral level had no distinct native rung and was
   * collapsed or clamped onto a neighbor (e.g. `highest` -> Grok `high`, or
   * `highest` -> OpenAI `high` on a model predating `xhigh`). Adapters log
   * these at debug so a papered-over request stays on the record.
   */
  papered: boolean;
  /** Native effort value for the target provider. */
  value: T;
}

/**
 * Per-provider translation of the provider-neutral {@link LlmEffort} scale.
 *
 * The neutral enum (lowest → low → medium → high → highest) is a relative
 * five-point scale. Each table below maps it onto the target provider's native
 * effort control, keeping `medium`/`high` semantically aligned across providers
 * and using each provider's extra bottom (`minimal`) or top (`xhigh`/`max`)
 * rung where one exists. Providers with fewer levels collapse the ends and mark
 * the result `papered`. A single `effort` value is therefore safe to reuse
 * across providers and fallback chains.
 */

/** Consistent debug message for a papered-over effort level. */
export function paperedEffortMessage({
  model,
  provider,
  requested,
  value,
}: {
  model: string;
  provider: string;
  requested: LlmEffort;
  value: string | number;
}): string {
  return `[llm] effort '${requested}' has no distinct tier on ${provider} model '${model}'; using '${value}'`;
}

// OpenAI Responses API `reasoning.effort`.
// Full ladder: minimal | low | medium | high | xhigh (plus `none`). Availability
// is not uniform across the gpt-5 line:
//   - `xhigh` was introduced at gpt-5.2 and has been continuous since, so it is
//     safe for our gpt-5.4 default and everything newer.
//   - `minimal` shipped on gpt-5/5.1, was dropped at gpt-5.2, and returned on
//     the current line; because that history is non-monotonic we only trust it
//     from gpt-5.4 (our default floor) onward.
// Outside those windows (older gpt-5, o-series) the extreme rung is clamped and
// the mapping reports `papered: true`.
const OPENAI_EFFORT: Record<LlmEffort, string> = {
  [EFFORT.LOWEST]: "minimal",
  [EFFORT.LOW]: "low",
  [EFFORT.MEDIUM]: "medium",
  [EFFORT.HIGH]: "high",
  [EFFORT.HIGHEST]: "xhigh",
};

interface GptVersion {
  major: number;
  minor: number;
}

function openAiGptVersion(model: string): GptVersion | null {
  const match = model.match(/^gpt-(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  return { major: Number(match[1]), minor: match[2] ? Number(match[2]) : 0 };
}

function atLeast(
  version: GptVersion | null,
  major: number,
  minor: number,
): boolean {
  if (!version) return false;
  return (
    version.major > major || (version.major === major && version.minor >= minor)
  );
}

export function toOpenAiEffort(
  effort: LlmEffort,
  { model }: { model: string },
): LlmEffortMapping {
  const native = OPENAI_EFFORT[effort];
  const version = openAiGptVersion(model);
  // `minimal` only from gpt-5.4 (non-monotonic history; absent on o-series)
  if (native === "minimal" && !atLeast(version, 5, 4)) {
    return { papered: true, value: "low" };
  }
  // `xhigh` from gpt-5.2 onward (absent on older gpt-5 and o-series)
  if (native === "xhigh" && !atLeast(version, 5, 2)) {
    return { papered: true, value: "high" };
  }
  return { papered: false, value: native };
}

// xAI Grok `reasoning_effort` — low | medium | high. No sub-low or top rung, so
// `lowest` collapses onto `low` and `highest` onto `high`.
const XAI_EFFORT: Record<LlmEffort, LlmEffortMapping> = {
  [EFFORT.LOWEST]: { papered: true, value: "low" },
  [EFFORT.LOW]: { papered: false, value: "low" },
  [EFFORT.MEDIUM]: { papered: false, value: "medium" },
  [EFFORT.HIGH]: { papered: false, value: "high" },
  [EFFORT.HIGHEST]: { papered: true, value: "high" },
};

export function toXaiEffort(effort: LlmEffort): LlmEffortMapping {
  return XAI_EFFORT[effort];
}

// Anthropic `output_config.effort` — low | medium | high | xhigh | max. No
// sub-low rung, so `lowest` collapses onto `low`; `highest` reaches `max`.
const ANTHROPIC_EFFORT: Record<LlmEffort, LlmEffortMapping> = {
  [EFFORT.LOWEST]: { papered: true, value: "low" },
  [EFFORT.LOW]: { papered: false, value: "low" },
  [EFFORT.MEDIUM]: { papered: false, value: "medium" },
  [EFFORT.HIGH]: { papered: false, value: "high" },
  [EFFORT.HIGHEST]: { papered: false, value: "max" },
};

export function toAnthropicEffort(effort: LlmEffort): LlmEffortMapping {
  return ANTHROPIC_EFFORT[effort];
}

// Gemini 3.x `thinkingConfig.thinkingLevel` — MINIMAL | LOW | MEDIUM | HIGH. No
// top rung above HIGH, so `highest` collapses onto HIGH.
const GEMINI_THINKING_LEVEL: Record<LlmEffort, LlmEffortMapping> = {
  [EFFORT.LOWEST]: { papered: false, value: "MINIMAL" },
  [EFFORT.LOW]: { papered: false, value: "LOW" },
  [EFFORT.MEDIUM]: { papered: false, value: "MEDIUM" },
  [EFFORT.HIGH]: { papered: false, value: "HIGH" },
  [EFFORT.HIGHEST]: { papered: true, value: "HIGH" },
};

export function toGeminiThinkingLevel(effort: LlmEffort): LlmEffortMapping {
  return GEMINI_THINKING_LEVEL[effort];
}

// Gemini 2.5 `thinkingConfig.thinkingBudget` — every tier is a distinct token
// budget, so nothing is papered over. Floor (512) clears every 2.5 minimum;
// ceiling (24,576) is valid across 2.5 Pro (max 32,768) and Flash (max 24,576).
const GEMINI_THINKING_BUDGET: Record<LlmEffort, number> = {
  [EFFORT.LOWEST]: 512,
  [EFFORT.LOW]: 4096,
  [EFFORT.MEDIUM]: 8192,
  [EFFORT.HIGH]: 16384,
  [EFFORT.HIGHEST]: 24576,
};

export function toGeminiThinkingBudget(
  effort: LlmEffort,
): LlmEffortMapping<number> {
  return { papered: false, value: GEMINI_THINKING_BUDGET[effort] };
}

// OpenRouter `reasoning.effort` — accepts the full minimal..xhigh ladder and
// maps to the routed provider's nearest supported level itself, so nothing is
// papered here.
const OPENROUTER_EFFORT: Record<LlmEffort, string> = {
  [EFFORT.LOWEST]: "minimal",
  [EFFORT.LOW]: "low",
  [EFFORT.MEDIUM]: "medium",
  [EFFORT.HIGH]: "high",
  [EFFORT.HIGHEST]: "xhigh",
};

export function toOpenRouterEffort(effort: LlmEffort): LlmEffortMapping {
  return { papered: false, value: OPENROUTER_EFFORT[effort] };
}
