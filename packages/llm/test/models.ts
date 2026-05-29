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
//   "skip" — capability is not exercised (e.g., model is text-only)
//   "fail" — capability is expected to fail outright
//
// Any capability not listed in `expect` defaults to "ok".

export type Capability =
  | "plain"
  | "tools"
  | "structured"
  | "both"
  | "pdf"
  | "image"
  | "temperature";

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
  "temperature",
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
  { model: "claude-sonnet-4-6" },

  // ─── Anthropic Opus 4 ────────────────────────────────────────────────
  { model: "claude-opus-4-6" },
  { model: "claude-opus-4-7" },
  { model: "claude-opus-4-8" },

  // ─── Anthropic Haiku 4 ───────────────────────────────────────────────
  { model: "claude-haiku-4-5" },

  // ─── OpenAI GPT-5 ────────────────────────────────────────────────────
  { model: "gpt-5.4" },
  { model: "gpt-5.4-mini" },
  { model: "gpt-5.4-nano" },
  { model: "gpt-5.5" },

  // ─── Google Gemini 3 ─────────────────────────────────────────────────
  { model: "gemini-3.1-pro-preview" },
  { model: "gemini-3-flash-preview" },
  { model: "gemini-3.1-flash-lite-preview" },

  // ─── xAI Grok 4 ──────────────────────────────────────────────────────
  { model: "grok-4.3-latest" },
  { model: "grok-4.20-0309-reasoning" },
  { model: "grok-4.20-0309-non-reasoning" },

  // ─── OpenRouter routes ───────────────────────────────────────────────
  // OpenRouter forwards image_url and file content parts to the selected
  // backend. Models without the relevant modality 4xx, which the harness
  // surfaces as a fail — refine `expect` per cell after the first run.
  { model: "anthropic/claude-sonnet-4.6", provider: "openrouter" },
  { model: "google/gemini-3.1-pro-preview", provider: "openrouter" },
  { model: "moonshotai/kimi-k2.6", provider: "openrouter" },
  { model: "openai/gpt-5.5", provider: "openrouter" },
  { model: "x-ai/grok-4.20", provider: "openrouter" },

  // ─── AWS Bedrock ─────────────────────────────────────────────────────
  { model: "us.anthropic.claude-opus-4-7", provider: "bedrock" },
  { model: "us.anthropic.claude-sonnet-4-6", provider: "bedrock" },
  { model: "us.anthropic.claude-haiku-4-5-20251001-v1:0", provider: "bedrock" },
  {
    model: "amazon.nova-pro-v1:0",
    provider: "bedrock",
    expect: { structured: "skip" },
  },
  {
    model: "us.amazon.nova-2-lite-v1:0",
    provider: "bedrock",
    expect: { both: "skip" },
  },
  {
    model: "amazon.nova-micro-v1:0",
    provider: "bedrock",
    expect: { structured: "skip", pdf: "skip", image: "skip" },
  },
  {
    model: "deepseek.v3.2",
    provider: "bedrock",
    expect: { both: "skip", pdf: "skip", image: "skip" },
  },
  {
    model: "google.gemma-3-27b-it",
    provider: "bedrock",
    expect: { tools: "skip", both: "skip", pdf: "skip" },
  },
  {
    model: "moonshotai.kimi-k2.5",
    provider: "bedrock",
    expect: { both: "skip", pdf: "skip" },
  },
  {
    model: "openai.gpt-oss-120b-1:0",
    provider: "bedrock",
    expect: { structured: "skip", pdf: "skip", image: "skip" },
  },
];
