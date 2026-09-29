import { LlmStopReason } from "../types/LlmProvider.interface.js";

//
//
// Incomplete stop reasons
//
// Every provider reports a cut-off answer as a normal 200 with a stop reason
// and the partial text in place. The loop settles those as incomplete
// (`loopStop.ts` `incompleteStop`) so a caller can tell a truncated answer
// from a finished one; this is the per-API list of which stop reasons mean
// the model did not finish. OpenAI and xAI are absent: the Responses API
// marks the payload `status: "incomplete"` and names the cause separately.
//

export const INCOMPLETE_STOP_REASONS = {
  ANTHROPIC: new Set(["max_tokens", "refusal"]),
  BEDROCK: new Set(["content_filtered", "guardrail_intervened", "max_tokens"]),
  /** Chat Completions shape: Fireworks, Mistral, OpenRouter */
  CHAT_COMPLETIONS: new Set(["content_filter", "length"]),
  GOOGLE: new Set([
    "BLOCKLIST",
    "MAX_TOKENS",
    "PROHIBITED_CONTENT",
    "RECITATION",
    "SAFETY",
    "SPII",
  ]),
} as const;

/**
 * The stop reason itself when it means the model stopped before finishing,
 * or undefined when the model finished (or nothing was reported).
 */
export function incompleteReasonFrom(
  stopReason: string | null | undefined,
  reasons: ReadonlySet<string>,
): string | undefined {
  return stopReason && reasons.has(stopReason) ? stopReason : undefined;
}

//
//
// Standard stop reason
//

// Every provider's incomplete stop reason, lowercased, to the standard one.
// A reason missing here still settles incomplete, as `Other`.
const STANDARD_STOP_REASONS: Record<string, LlmStopReason> = {
  blocklist: LlmStopReason.ContentFilter,
  content_filter: LlmStopReason.ContentFilter,
  content_filtered: LlmStopReason.ContentFilter,
  guardrail_intervened: LlmStopReason.ContentFilter,
  length: LlmStopReason.MaxTokens,
  max_output_tokens: LlmStopReason.MaxTokens,
  max_tokens: LlmStopReason.MaxTokens,
  prohibited_content: LlmStopReason.ContentFilter,
  recitation: LlmStopReason.ContentFilter,
  refusal: LlmStopReason.Refusal,
  safety: LlmStopReason.ContentFilter,
  spii: LlmStopReason.ContentFilter,
};

/**
 * The standard stop reason for one model response. Derived from the parsed
 * response rather than the raw stop reason, because providers disagree on
 * how a tool call reports (OpenAI `completed`, Gemini `STOP`, Anthropic
 * `tool_use`) while every adapter agrees on `hasToolCalls`.
 */
export function standardStopReason({
  hasToolCalls = false,
  incompleteReason,
}: {
  hasToolCalls?: boolean;
  incompleteReason?: string;
} = {}): LlmStopReason {
  if (incompleteReason) {
    return (
      STANDARD_STOP_REASONS[incompleteReason.toLowerCase()] ??
      LlmStopReason.Other
    );
  }
  return hasToolCalls ? LlmStopReason.ToolUse : LlmStopReason.EndTurn;
}
