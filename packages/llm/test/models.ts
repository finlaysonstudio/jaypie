//
// Model matrix configuration for `test/matrix.ts`.
//
// The model list is DERIVED from `src/constants.ts` (the MODEL.* catalog,
// including the BEDROCK and OPENROUTER subtrees, plus each PROVIDER.*.DEFAULT),
// so adding a model to the matrix only means editing constants — this file
// holds no model ids, and neither does the CI workflow. What lives here is
// test-only knowledge: which catalog ids the live matrix skips
// (`MATRIX_EXCLUDE`) and which capabilities a model is known not to support
// (`MATRIX_EXPECT`).
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

// Flatten MODEL.* (including the BEDROCK and OPENROUTER subtrees) into ids.
function catalogIds(node: unknown = MODEL, out: string[] = []): string[] {
  if (typeof node === "string") out.push(node);
  else if (node && typeof node === "object")
    for (const value of Object.values(node)) catalogIds(value, out);
  return out;
}

// Per-model expected-outcome overrides. Fireworks has no file/PDF input
// support (documents cannot be delivered as data: URIs) and only some catalog
// models are vision-capable (verified live 2026-07-19). Fireworks also rejects
// response_format combined with tools, so `both` engages the structured_output
// tool emulation and logs a warn. Bedrock-hosted models vary by vendor: several
// do not implement structured output or document/image input at all.
const MATRIX_EXPECT: Record<
  string,
  Partial<Record<Capability, ExpectedOutcome>>
> = {
  [MODEL.BEDROCK.DEEPSEEK]: { both: "skip", pdf: "skip", image: "skip" },
  [MODEL.BEDROCK.GEMMA]: { tools: "skip", both: "skip", pdf: "skip" },
  [MODEL.BEDROCK.GPT_OSS]: { structured: "skip", pdf: "skip", image: "skip" },
  [MODEL.BEDROCK.KIMI]: { both: "skip", pdf: "skip" },
  [MODEL.FIREWORKS.DEEPSEEK]: { both: "warn", pdf: "skip", image: "skip" },
  [MODEL.FIREWORKS.GLM]: { both: "warn", pdf: "skip", image: "skip" },
  [MODEL.FIREWORKS.KIMI]: { both: "warn", pdf: "skip" },
  [MODEL.FIREWORKS.MINIMAX]: { both: "warn", pdf: "skip", image: "skip" },
  [MODEL.FIREWORKS.QWEN]: { both: "warn", pdf: "skip" },
  [MODEL.NOVA_LITE]: { both: "skip" },
  [MODEL.NOVA_PRO]: { structured: "skip" },
};

// Models under test = the whole MODEL.* catalog plus each provider's resolved
// default, deduped, minus the exclude set. Provider is resolved from the id so
// the matrix shards correctly by group (APP_GROUP).
const MATRIX_MODELS: ModelConfig[] = [
  ...new Set([
    ...catalogIds(),
    PROVIDER.ANTHROPIC.DEFAULT,
    PROVIDER.BEDROCK.DEFAULT,
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

/**
 * Full matrix model list. The harness honors APP_MODELS (comma-separated ids)
 * to override, or APP_GROUP (comma-separated provider names) to shard by
 * provider. Defaults assume "ok" everywhere; only known limitations are pinned.
 */
export const MODELS: readonly ModelConfig[] = MATRIX_MODELS;
