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
