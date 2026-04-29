//
// Model matrix configuration for `test/matrix.ts`.
//
// Edit this list with the models you actually want to verify. Each row is one
// model id; the optional `provider` field is only needed when the model id is
// ambiguous (e.g., when sending an OpenAI-named model through OpenRouter).
//
// `expect` documents the *expected* outcome per capability. The harness
// compares actual outcomes to these and flags mismatches:
//
//   "ok"   — capability works and produces no warnings
//   "warn" — capability works but is expected to emit a fallback log.warn
//            (e.g., gemini-2.5 + tools+structured engages the legacy fake-tool path)
//   "skip" — capability is not exercised (e.g., OpenRouter cannot upload files)
//   "fail" — capability is expected to fail outright
//
// Any capability not listed in `expect` defaults to "ok".

export type Capability =
  | "plain"
  | "tools"
  | "structured"
  | "both"
  | "pdf"
  | "image";

export type ExpectedOutcome = "ok" | "warn" | "skip" | "fail";

export interface ModelConfig {
  /** Model id, e.g. "claude-sonnet-4-5" or "openai/gpt-4o" (when provider="openrouter") */
  model: string;
  /** Optional explicit provider; auto-detected from the model id when omitted */
  provider?: string;
  /** Friendly label for the matrix output; defaults to `model` */
  label?: string;
  /** Per-capability expected outcomes; missing entries default to "ok" */
  expect?: Partial<Record<Capability, ExpectedOutcome>>;
}

export const CAPABILITIES: readonly Capability[] = [
  "plain",
  "tools",
  "structured",
  "both",
  "pdf",
  "image",
] as const;

/**
 * Default model list. Edit freely. The harness honors APP_MODELS
 * (comma-separated model ids) to override at runtime without editing.
 *
 * Includes the major (non-mini/flash/lite) models in the GPT-5, Gemini 3,
 * and Claude Sonnet 4 / Opus 4 lines, plus every model id referenced by
 * `src/constants.ts` (smaller variants, xAI Grok line, OpenRouter routes).
 *
 * Defaults assume "ok" everywhere; only known limitations are pinned.
 * After the first run, refine `expect` per cell based on what your account
 * actually has access to.
 */
export const MODELS: readonly ModelConfig[] = [
  // ─── Anthropic Sonnet 4 ──────────────────────────────────────────────
  // Note: Anthropic does not expose bare-name aliases like `claude-sonnet-4`
  // or `claude-opus-4` — only the dated/versioned ids resolve.
  { model: "claude-sonnet-4-5" },
  { model: "claude-sonnet-4-6" }, // constants ANTHROPIC.DEFAULT/SMALL

  // ─── Anthropic Opus 4 ────────────────────────────────────────────────
  { model: "claude-opus-4-1" },
  { model: "claude-opus-4-5" },
  { model: "claude-opus-4-7" }, // constants ANTHROPIC.LARGE

  // ─── Anthropic Haiku 4 ───────────────────────────────────────────────
  { model: "claude-haiku-4-5" }, // constants ANTHROPIC.TINY

  // ─── OpenAI GPT-5 ────────────────────────────────────────────────────
  { model: "gpt-5" },
  { model: "gpt-5.1" },
  { model: "gpt-5-pro" },
  { model: "gpt-5.4" }, // constants OPENAI.DEFAULT
  { model: "gpt-5.4-mini" }, // constants OPENAI.SMALL
  { model: "gpt-5.4-nano" }, // constants OPENAI.TINY
  { model: "gpt-5.5" }, // constants OPENAI.LARGE

  // ─── Google Gemini 3 ─────────────────────────────────────────────────
  { model: "gemini-3.1-pro-preview" }, // constants GEMINI.DEFAULT/LARGE
  { model: "gemini-3-flash-preview" }, // constants GEMINI.SMALL
  { model: "gemini-3.1-flash-lite-preview" }, // constants GEMINI.TINY

  // ─── xAI Grok 4 ──────────────────────────────────────────────────────
  { model: "grok-4.20-0309-reasoning" }, // constants XAI.DEFAULT/LARGE
  { model: "grok-4.20-0309-non-reasoning" }, // constants XAI.SMALL
  { model: "grok-4-1-fast-non-reasoning" }, // constants XAI.TINY
];
