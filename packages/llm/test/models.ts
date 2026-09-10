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
// Bedrock, Fireworks, and OpenRouter models are judged as collectives by
// `matrix.ts` — their expectations still drive the grid and the issue list, but
// the run fails on a lost row or column majority rather than on any one cell.
//
// `expect` documents the *expected* outcome per capability. The harness
// compares actual outcomes to these and flags mismatches:
//
//   "ok"   — capability works and produces no warnings
//   "warn" — capability works but is expected to emit a log.warn (e.g., an
//            adapter discarding content the provider cannot accept). A
//            structured_output emulation path is not one: it settles correctly
//            and logs at debug, so those cells expect "ok"
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
  // Document extraction over POST /v1/ocr, not chat completions — every
  // capability cell would fail by construction.
  MODEL.MISTRAL.OCR,
  // Temporary. As of 2026-08-30 the Mistral key answers every capability with
  // "This model is not available in your subscription tier", so all seven cells
  // fail on an entitlement, not on the model. mistral-small-latest reaches the
  // API on the same key. Restore the tier or drop the id from the catalog and
  // remove this line; it stays cataloged and priced meanwhile. This only
  // affects on-demand runs now — CI no longer shards Mistral.
  MODEL.MISTRAL.LARGE,
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
// tool emulation on every Fireworks model — that path settles correctly and
// logs at debug, so those cells expect "ok". Mistral accepts the pair
// natively, but one model still needs the corrective turn — see below.
const MATRIX_EXPECT: Record<
  string,
  Partial<Record<Capability, ExpectedOutcome>>
> = {
  [MODEL.FIREWORKS.DEEPSEEK]: { pdf: "skip", image: "skip" },
  [MODEL.FIREWORKS.GLM]: { pdf: "skip", image: "skip" },
  [MODEL.FIREWORKS.GPT_OSS]: { pdf: "skip", image: "skip" },
  // INKLING and KIMI both advertise supports_image_input (Fireworks models API,
  // 2026-08-02), so neither skips the image cell.
  [MODEL.FIREWORKS.INKLING]: { pdf: "skip" },
  [MODEL.FIREWORKS.KIMI]: { pdf: "skip" },
  // minimax-m3 advertises no image input (Fireworks models API, 2026-09-10).
  [MODEL.FIREWORKS.MINIMAX]: { pdf: "skip", image: "skip" },
  // NEMOTRON returned to the catalog on 2026-08-02 after being retired
  // 2026-07-21 for nondeterministic structured output (clean JSON, prose, or an
  // empty array from the same request). The nondeterminism persists: 6 for 6 on
  // resample (2026-08-02) and 8 for 8 again (2026-08-21), yet CI lost the cell
  // to "colors array missing or empty" on both 2026-08-19 and 2026-08-21. No
  // single expectation is right for a cell that answers differently to the same
  // request, so `structured` stays "ok" — the outcome the model reaches on the
  // large majority of samples — and the Fireworks collective in `matrix.ts`
  // absorbs the miss. One flaky cell no longer fails the run; a NEMOTRON row or
  // a `structured` column that goes red across the Fireworks block still does.
  // It advertises no image input.
  [MODEL.FIREWORKS.NEMOTRON]: { pdf: "skip", image: "skip" },
  // QWEN names qwen3p8-max as of 2026-09-10, the day Fireworks withdrew
  // qwen3p7-plus from serverless. It advertises image input, so only pdf
  // skips. The `structured` evidence from issue #438 (12 of 13 samples) was
  // measured against qwen3p7-plus and does not carry over to the new model.
  [MODEL.FIREWORKS.QWEN]: { pdf: "skip" },
  // MODEL.GROK carried `pdf: "skip"` while the alias named Grok 4.5, which read
  // the fixture PDF in only 2 of 9 live samples (2026-08-02) — the other seven
  // narrated a tool call in a cell that configures no tools and returned none
  // of the document's text. Grok 4.6 reads it 9 for 9 (2026-08-17), so the skip
  // is gone and every Grok cell is expected to pass. Grok 4.3 also passed 2 for
  // 2, which makes 4.5 the outlier rather than the fixture.
  //
  // Mistral sends response_format and tools together natively. mistral-medium
  // could not do so reliably and is no longer cataloged — see the note in
  // constants.ts. Large and Small are expected to answer every cell cleanly.
  [MODEL.NOVA_LITE]: { both: "skip" },
  [MODEL.NOVA_PRO]: { structured: "skip" },
};

// Models under test = the whole MODEL.* catalog plus each provider's resolved
// default, deduped, minus the exclude set. Provider is resolved from the id so
// the matrix shards correctly by group (APP_GROUP).
//
// Mistral models stay in this list but no longer run in CI: the workflows drop
// the `mistral` shard because the provider's availability does not survive a
// per-push run (a 429 across all seven cells on 2026-09-05, an entitlement
// refusal before that). Run them on demand with APP_GROUP=mistral.
const MATRIX_MODELS: ModelConfig[] = [
  ...new Set([
    ...catalogIds(),
    PROVIDER.ANTHROPIC.DEFAULT,
    PROVIDER.BEDROCK.DEFAULT,
    PROVIDER.FIREWORKS.DEFAULT,
    PROVIDER.GOOGLE.DEFAULT,
    PROVIDER.META.DEFAULT,
    PROVIDER.MISTRAL.DEFAULT,
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
