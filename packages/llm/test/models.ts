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
 */
export const MODELS: readonly ModelConfig[] = [
  // Anthropic
  {
    model: "claude-sonnet-4-5",
    expect: {},
  },
  // OpenAI
  {
    model: "gpt-4o",
    expect: {},
  },
  // Gemini 2.5 — tools+structured combo falls back to the legacy fake tool
  {
    model: "gemini-2.5-flash",
    expect: { both: "warn" },
  },
  // Gemini 3 — supports the native combo
  {
    model: "gemini-3.1-pro-preview",
    expect: {},
  },
  // xAI
  {
    model: "grok-4",
    expect: {},
  },
  // OpenRouter — file/image uploads not supported by the adapter
  {
    model: "openrouter:openai/gpt-4o",
    label: "openrouter→openai/gpt-4o",
    expect: { pdf: "skip", image: "skip" },
  },
];
