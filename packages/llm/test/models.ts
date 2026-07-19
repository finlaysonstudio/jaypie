//
// Model matrix configuration for `test/matrix.ts`.
//
// First-class models are DERIVED from `src/constants.ts` (the MODEL.* catalog
// plus each PROVIDER.*.DEFAULT), so adding a promoted model only means editing
// constants — no duplication here or in the CI workflow. Only Bedrock is listed
// explicitly (Bedrock proxies many vendors and is not in MODEL.*).
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

import { MODEL, PROVIDER } from "../src/constants.js";
import { determineModelProvider } from "../src/util/determineModelProvider.js";

export type Capability =
  "plain" | "tools" | "structured" | "both" | "pdf" | "image" | "temperature";

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

// MODEL.* ids the live matrix skips: unavailable, or deprecated aliases
// superseded by a first-class name.
const MATRIX_EXCLUDE = new Set<string>([
  MODEL.MYTHOS,
  MODEL.GPT,
  MODEL.GPT_MINI,
  MODEL.GPT_NANO,
]);

// Flatten MODEL.* (including nested subtrees like OPENROUTER) into ids.
function catalogIds(node: unknown = MODEL, out: string[] = []): string[] {
  if (typeof node === "string") out.push(node);
  else if (node && typeof node === "object")
    for (const value of Object.values(node)) catalogIds(value, out);
  return out;
}

// Per-model expected-outcome overrides for first-class models. Fireworks has
// no file/PDF input support (documents cannot be delivered as data: URIs) and
// only some catalog models are vision-capable (verified live 2026-07-19).
const MATRIX_EXPECT: Record<
  string,
  Partial<Record<Capability, ExpectedOutcome>>
> = {
  [MODEL.FIREWORKS.DEEPSEEK]: { pdf: "skip", image: "skip" },
  [MODEL.FIREWORKS.GLM]: { pdf: "skip", image: "skip" },
  [MODEL.FIREWORKS.KIMI]: { pdf: "skip" },
  [MODEL.FIREWORKS.MINIMAX]: { pdf: "skip", image: "skip" },
  [MODEL.FIREWORKS.QWEN]: { pdf: "skip" },
};

// First-class models under test = the promoted MODEL.* catalog plus each
// provider's resolved default, deduped, minus the exclude set. Provider is
// resolved from the id so the matrix shards correctly by group (APP_GROUP).
const FIRST_CLASS_MODELS: ModelConfig[] = [
  ...new Set([
    ...catalogIds(),
    PROVIDER.ANTHROPIC.DEFAULT,
    PROVIDER.FIREWORKS.DEFAULT,
    PROVIDER.GOOGLE.DEFAULT,
    PROVIDER.OPENAI.DEFAULT,
    PROVIDER.OPENROUTER.DEFAULT,
    PROVIDER.XAI.DEFAULT,
  ]),
]
  .filter((model) => !MATRIX_EXCLUDE.has(model))
  .map((model) => {
    const provider = determineModelProvider(model).provider;
    const expect = MATRIX_EXPECT[model];
    return {
      model,
      ...(provider ? { provider } : {}),
      ...(expect ? { expect } : {}),
    };
  });

// Bedrock (and Bedrock-hosted third-party) models are not in MODEL.* — Bedrock
// proxies many vendors. Canonical ids provided by the user; do not substitute.
// `us.` prefix is required for the Anthropic models and nova-2-lite (inference
// profile; on-demand not supported).
const BEDROCK_MODELS: ModelConfig[] = [
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

/**
 * Full matrix model list. The harness honors APP_MODELS (comma-separated ids)
 * to override, or APP_GROUP (comma-separated provider names) to shard by
 * provider. Defaults assume "ok" everywhere; only known limitations are pinned.
 */
export const MODELS: readonly ModelConfig[] = [
  ...FIRST_CLASS_MODELS,
  ...BEDROCK_MODELS,
];
