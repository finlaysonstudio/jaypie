/* eslint-disable no-console */
//
// Smoke-test matrix: runs each model in `models.ts` through every capability
// (plain, tools, structured, both, pdf, image) and prints a grid of
// outcomes. Non-zero exit when a cell mismatches its expected outcome, or
// when a collective provider block (see COLLECTIVES) loses a row or column
// majority.
//
// Usage:
//   npm run test:matrix -w packages/llm
//   LOG_LEVEL=warn npm run test:matrix -w packages/llm   # quiet trace/debug
//   APP_MODELS=claude-sonnet-5,gpt-5.6-sol npm run test:matrix -w packages/llm
//   APP_GROUP=anthropic npm run test:matrix -w packages/llm
//   APP_CAPABILITIES=plain,tools npm run test:matrix -w packages/llm
//   APP_FORCE=1 APP_MODELS=mistral-medium-3-5 APP_CAPABILITIES=both npm run test:matrix -w packages/llm
//
// Env:
//   APP_MODELS       comma-separated id override for the model list
//   APP_GROUP        comma-separated provider names to shard by (e.g. google,xai)
//   APP_CAPABILITIES comma-separated subset of capabilities to run
//   APP_FORCE        run cells expected to "skip" and report what they do
//   APP_RPS          requests/second ceiling, overriding test/rateLimit.ts
//   APP_USER         user tag forwarded to provider calls
//   LOG_LEVEL        set to "warn" or higher to silence Jaypie trace/debug
//
// This script makes real API calls. It needs the relevant *_API_KEY env vars
// for whichever providers your model list touches (ANTHROPIC_API_KEY,
// OPENAI_API_KEY, GOOGLE_API_KEY, OPENROUTER_API_KEY, XAI_API_KEY).
//
import { config } from "dotenv";
import { existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import {
  Llm,
  LlmOperateInput,
  LlmResponseErrorReason,
  toolkit,
} from "../src/index.js";
import { determineModelProvider } from "../src/util/determineModelProvider.js";
import {
  ActualOutcome,
  CellResult,
  COLLECTIVES,
  collectiveFor,
  evaluateCollective,
  formatCollectiveReport,
} from "./collective.js";
import {
  CAPABILITIES,
  Capability,
  ExpectedOutcome,
  MODELS,
  ModelConfig,
} from "./models.js";
import { RateLimiter, requestsPerSecondFor } from "./rateLimit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Walk up from this file to find the nearest .env (handles being invoked via
// `npm run -w packages/llm`, which sets cwd to the package and would
// otherwise miss the repo-root .env).
function loadEnv(): void {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) {
      config({ path: candidate });
      return;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  config();
}
loadEnv();
const PDF_PATH = join(__dirname, "fixtures/page.pdf");
const IMAGE_PATH = join(__dirname, "fixtures/page.png");
const REQUIRED_DOC_STRINGS = [
  "mock page",
  "intentionally blank",
  "mit license",
];
const USER = process.env.APP_USER || "[matrix] Jaypie User";
// Debugging knob: run cells MATRIX_EXPECT pins to "skip" instead of returning
// early, so a skipped cell can be observed without editing models.ts.
const FORCE = /^(1|true|yes)$/i.test(process.env.APP_FORCE ?? "");

//
//
// Warning capture
//

/**
 * Run `fn` while capturing anything sent to console.warn (which is what
 * @jaypie/logger's log.warn ultimately calls). Returns both the result and
 * the captured warning lines so the matrix can flag fallback paths that
 * engaged silently.
 */
async function captureWarnings<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; warnings: string[] }> {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(
      args.map((a) => (typeof a === "string" ? a : String(a))).join(" "),
    );
  };
  try {
    const result = await fn();
    return { result, warnings };
  } finally {
    console.warn = original;
  }
}

//
//
// Capability runners
//
// Each runner returns a CellResult-shaped object minus expected/matches —
// the matrix runner fills those in based on per-model expectations.
//

export interface CapabilityResult {
  ok: boolean;
  detail?: string;
  /**
   * The run ended without demonstrating anything about the capability, so the
   * cell carries no verdict to compare against its expectation. Reported as a
   * warning and excluded from the mismatch count. See `errorResult`.
   */
  inconclusive?: boolean;
}

/**
 * Render an error as a single readable line. `operate()` resolves failures to
 * an `LlmError` object (`{ status, title, detail }`), which `String()` renders
 * as "[object Object]" — useless in CI, where the log is the only record of a
 * live-provider failure. Falls back to `Error.message`, then JSON, then
 * `String()`.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const { detail, status, title } = error as {
      detail?: string;
      status?: number | string;
      title?: string;
    };
    if (title || status !== undefined) {
      const head = status === undefined ? title : `${title} (${status})`;
      return detail ? `${head}: ${detail}` : String(head);
    }
    try {
      return JSON.stringify(error);
    } catch {
      // Circular or otherwise unserializable — name the keys rather than
      // falling back to String() and printing "[object Object]" again.
      return `unserializable object with keys: ${Object.keys(error).join(", ")}`;
    }
  }
  return String(error);
}

/**
 * Turn an `operate()` error into a failed cell, marking the outcomes that say
 * nothing about the capability.
 *
 * An exhausted turn budget is the case in hand (issue #505): a model that keeps
 * calling tools until `turns` runs out has not shown it lacks the capability,
 * it has shown that this run did not converge. The outcome is nondeterministic
 * — the same cell passed and failed twelve minutes apart — so failing the run
 * on it reports a flake as a defect. The detail still reaches the ISSUES block,
 * so a model that stops converging stays visible.
 *
 * `status` alone cannot make the call: a provider rate limit is also 429. The
 * discriminator is `LlmResponseErrorReason.MaxTurns`, set by the operate loop.
 */
export function errorResult(error: unknown): CapabilityResult {
  const reason =
    error && typeof error === "object"
      ? (error as { reason?: string }).reason
      : undefined;
  return {
    ok: false,
    detail: describeError(error),
    inconclusive: reason === LlmResponseErrorReason.MaxTurns,
  };
}

async function runPlain(llm: Llm): Promise<CapabilityResult> {
  const result = await llm.operate(
    "Reply with one word: 'pong'. No punctuation.",
    { user: USER },
  );
  if (result.error) return errorResult(result.error);
  if (typeof result.content !== "string" || result.content.length === 0) {
    return {
      ok: false,
      detail: `expected non-empty string, got ${typeof result.content}`,
    };
  }
  return { ok: true };
}

async function runTools(llm: Llm): Promise<CapabilityResult> {
  let toolCalled = false;
  const result = await llm.operate("Roll five six-sided dice.", {
    tools: toolkit,
    user: USER,
    hooks: {
      beforeEachTool: (tool) => {
        if (tool.toolName === "roll") toolCalled = true;
      },
    },
  });
  if (result.error) return errorResult(result.error);
  if (!toolCalled) return { ok: false, detail: "roll tool was not called" };
  return { ok: true };
}

async function runStructured(llm: Llm): Promise<CapabilityResult> {
  const result = await llm.operate("List exactly three primary colors.", {
    format: { colors: [String] },
    user: USER,
  });
  if (result.error) return errorResult(result.error);
  const content = result.content as { colors?: unknown } | string | undefined;
  if (!content || typeof content !== "object") {
    return { ok: false, detail: `expected object, got ${typeof content}` };
  }
  if (!Array.isArray(content.colors) || content.colors.length === 0) {
    return { ok: false, detail: "colors array missing or empty" };
  }
  return { ok: true };
}

async function runBoth(llm: Llm): Promise<CapabilityResult> {
  let toolCalled = false;
  const result = await llm.operate(
    "Roll five six-sided dice and return the rolls and total.",
    {
      tools: toolkit,
      format: { values: String, total: Number },
      user: USER,
      hooks: {
        beforeEachTool: (tool) => {
          if (tool.toolName === "roll") toolCalled = true;
        },
      },
    },
  );
  if (result.error) return errorResult(result.error);
  const content = result.content as
    { values?: unknown; total?: unknown } | string | undefined;
  if (!content || typeof content !== "object") {
    return { ok: false, detail: `expected object, got ${typeof content}` };
  }
  if (content.values === undefined) {
    return { ok: false, detail: "values missing" };
  }
  if (typeof content.total !== "number") {
    return { ok: false, detail: "total missing or not a number" };
  }
  // Tool invocation is reported, not required. `both` asks whether a model can
  // combine tools with structured output, and a model that fills the schema
  // itself has answered the prompt — declining to delegate a task it can do
  // unaided is a preference, not a missing capability. Asserting the call made
  // this cell fail on capable models (issue #440); the outcome is recorded so
  // a shift in behavior is still visible in the matrix output.
  return {
    ok: true,
    detail: toolCalled ? undefined : "answered without calling the roll tool",
  };
}

function checkDocStrings(content: unknown): CapabilityResult {
  if (typeof content !== "string" || content.length === 0) {
    return {
      ok: false,
      detail: `expected non-empty string, got ${typeof content}`,
    };
  }
  const lower = content.toLowerCase();
  const missing = REQUIRED_DOC_STRINGS.filter((s) => !lower.includes(s));
  if (missing.length > 0) {
    return { ok: false, detail: `missing strings: ${missing.join(", ")}` };
  }
  return { ok: true };
}

async function runPdf(llm: Llm): Promise<CapabilityResult> {
  const input: LlmOperateInput = [
    "Extract the text from this PDF document.",
    { file: PDF_PATH },
  ];
  const result = await llm.operate(input, { user: USER });
  if (result.error) return errorResult(result.error);
  return checkDocStrings(result.content);
}

async function runImage(llm: Llm): Promise<CapabilityResult> {
  const input: LlmOperateInput = [
    "Extract the text from this image.",
    { image: IMAGE_PATH },
  ];
  const result = await llm.operate(input, { user: USER });
  if (result.error) return errorResult(result.error);
  return checkDocStrings(result.content);
}

async function runTemperature(llm: Llm): Promise<CapabilityResult> {
  const result = await llm.operate(
    "Reply with one word: 'pong'. No punctuation.",
    { temperature: 0, user: USER },
  );
  if (result.error) return errorResult(result.error);
  if (typeof result.content !== "string" || result.content.length === 0) {
    return {
      ok: false,
      detail: `expected non-empty string, got ${typeof result.content}`,
    };
  }
  return { ok: true };
}

const RUNNERS: Record<Capability, (llm: Llm) => Promise<CapabilityResult>> = {
  plain: runPlain,
  tools: runTools,
  structured: runStructured,
  both: runBoth,
  pdf: runPdf,
  image: runImage,
  temperature: runTemperature,
};

//
//
// Matrix runner
//

function expectedFor(
  model: ModelConfig,
  capability: Capability,
): ExpectedOutcome {
  return model.expect?.[capability] ?? "ok";
}

// Limiters are per model and outlive the cell. A limiter scoped to one cell
// would let each cell's first request fire immediately, so the boundary
// between two cells would be unspaced no matter the configured rate — which
// is exactly how a paced run still collected `Rate limit exceeded` on the
// three cells that followed a long multi-turn one.
const LIMITERS = new Map<string, RateLimiter>();

function limiterFor(model: ModelConfig): RateLimiter | undefined {
  const requestsPerSecond = requestsPerSecondFor({
    model: model.model,
    provider: model.provider,
  });
  if (requestsPerSecond <= 0) return undefined;
  const existing = LIMITERS.get(model.model);
  if (existing) return existing;
  const limiter = new RateLimiter({ requestsPerSecond });
  LIMITERS.set(model.model, limiter);
  return limiter;
}

/**
 * Wrap an Llm so every model request it issues waits on the model's rate
 * limiter first. Shadowing `operate` on the instance keeps the seven capability
 * runners unchanged and covers multi-turn loops, where one cell issues many
 * requests.
 */
function paced(llm: Llm, model: ModelConfig): Llm {
  const limiter = limiterFor(model);
  if (!limiter) return llm;

  const operate = llm.operate.bind(llm);
  llm.operate = (async (input, options = {}) =>
    operate(input, {
      ...options,
      hooks: {
        ...options.hooks,
        beforeEachModelRequest: async (context) => {
          await limiter.acquire();
          return options.hooks?.beforeEachModelRequest?.(context);
        },
      },
    })) as typeof llm.operate;
  return llm;
}

export function classifyActual(
  capability: CapabilityResult,
  warnings: string[],
): ActualOutcome {
  if (!capability.ok) return capability.inconclusive ? "warn" : "fail";
  if (warnings.length > 0) return "warn";
  return "ok";
}

async function runCell(
  model: ModelConfig,
  capability: Capability,
): Promise<CellResult> {
  const expected = expectedFor(model, capability);

  if (expected === "skip" && !FORCE) {
    return { actual: "skip", expected, matches: true, warnings: [] };
  }

  const llm = paced(new Llm(model.provider, { model: model.model }), model);
  let outcome: CapabilityResult;
  let warnings: string[] = [];
  try {
    const captured = await captureWarnings(() => RUNNERS[capability](llm));
    outcome = captured.result;
    warnings = captured.warnings;
  } catch (error) {
    outcome = errorResult(error);
  }

  const actual = classifyActual(outcome, warnings);
  // A forced skip cell has no expectation to meet — the point is to observe
  // what it does, so whatever happened counts as a match and the run still
  // exits zero. An inconclusive cell is the same case for a different reason:
  // the run produced no verdict to compare.
  const matches =
    expected === "skip" || outcome.inconclusive
      ? true
      : matchesExpected(actual, expected);
  return {
    actual,
    expected,
    matches,
    warnings,
    detail: outcome.detail,
  };
}

export function matchesExpected(
  actual: ActualOutcome,
  expected: ExpectedOutcome,
): boolean {
  if (expected === "skip") return actual === "skip";
  if (expected === "fail") return actual === "fail";
  if (expected === "ok") return actual === "ok"; // warnings count as a mismatch
  if (expected === "warn") return actual === "warn"; // missing the warning is a mismatch
  return false;
}

//
//
// Output formatting
//

const SYMBOLS: Record<ActualOutcome, string> = {
  ok: "✅",
  warn: "⚠️",
  fail: "❌",
  skip: "—",
};

function displayActual(cell: CellResult, collective: boolean): ActualOutcome {
  // Surface an individual failure inside a collective as a warning so one
  // flaky cell does not paint the block red.
  if (collective && cell.actual === "fail") return "warn";
  return cell.actual;
}

function cellSymbol(cell: CellResult, collective: boolean): string {
  const actual = displayActual(cell, collective);
  const sym = SYMBOLS[actual];
  // Collective cells skip the mismatch indicator — the block's row and column
  // majorities carry the verdict. Otherwise, suppress `!` when the actual
  // outcome is already a failure: the ❌ glyph conveys the problem on its own.
  if (collective) return sym;
  if (actual === "fail") return sym;
  return cell.matches ? sym : `${sym}!`;
}

function formatTable(
  models: readonly ModelConfig[],
  capabilities: readonly Capability[],
  rows: Map<string, Map<Capability, CellResult>>,
): string {
  const labelOf = (m: ModelConfig) => m.label || m.model;
  const labelWidth = Math.max(
    ...models.map((m) => labelOf(m).length),
    "model".length,
  );
  const colWidth = (c: Capability) => Math.max(c.length, 4);

  const header = [
    "model".padEnd(labelWidth),
    ...capabilities.map((c) => c.padStart(colWidth(c))),
  ].join("  ");
  const sep = "─".repeat(header.length);

  const lines = [header, sep];
  for (const model of models) {
    const cells = rows.get(labelOf(model));
    if (!cells) continue;
    const collective = Boolean(collectiveFor(model));
    const row = [
      labelOf(model).padEnd(labelWidth),
      ...capabilities.map((c) => {
        const cell = cells.get(c);
        if (!cell) return "?".padStart(colWidth(c));
        return cellSymbol(cell, collective).padStart(colWidth(c));
      }),
    ].join("  ");
    lines.push(row);
  }
  lines.push(sep);
  lines.push(
    "Legend: ✅ ok   ⚠️ warn   ❌ fail   — skip   `!` mismatch vs expected",
  );
  lines.push(
    `Collective rows (${COLLECTIVES.map((b) => b.name).join(", ")}): failures ` +
      "display as ⚠️ and pass/fail as a block (row+column majority).",
  );
  return lines.join("\n");
}

function formatIssues(
  models: readonly ModelConfig[],
  rows: Map<string, Map<Capability, CellResult>>,
): string[] {
  const issues: string[] = [];
  for (const model of models) {
    const label = model.label || model.model;
    const cells = rows.get(label);
    if (!cells) continue;
    const collective = collectiveFor(model);
    for (const [cap, cell] of cells) {
      if (cell.matches && cell.warnings.length === 0) continue;
      const parts = [`[${label} / ${cap}]`];
      if (!cell.matches) {
        const tag = collective
          ? `${collective.name.toLowerCase()}-fail`
          : "mismatch";
        parts.push(`${tag} expected=${cell.expected}, got=${cell.actual}`);
      }
      if (cell.detail) parts.push(`detail=${cell.detail}`);
      if (cell.warnings.length > 0) {
        parts.push(`warnings=${cell.warnings.length}`);
        for (const w of cell.warnings) parts.push(`  • ${w}`);
      }
      issues.push(parts.join(" "));
    }
  }
  return issues;
}

//
//
// Main
//

function selectModels(): readonly ModelConfig[] {
  // Explicit id override wins.
  const modelsEnv = process.env.APP_MODELS;
  if (modelsEnv) {
    const ids = modelsEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return ids.map((id) => {
      const existing = MODELS.find((m) => m.model === id);
      return existing ?? { model: id, expect: {} };
    });
  }
  // Otherwise shard by provider group (CI passes APP_GROUP per matrix cell).
  const groupEnv = process.env.APP_GROUP;
  if (groupEnv) {
    const groups = new Set(
      groupEnv
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    return MODELS.filter((m) => {
      const provider = m.provider ?? determineModelProvider(m.model).provider;
      return provider ? groups.has(provider) : false;
    });
  }
  return MODELS;
}

function selectCapabilities(): readonly Capability[] {
  const env = process.env.APP_CAPABILITIES;
  if (!env) return CAPABILITIES;
  const wanted = new Set(env.split(",").map((s) => s.trim().toLowerCase()));
  return CAPABILITIES.filter((c) => wanted.has(c));
}

async function main(): Promise<void> {
  const models = selectModels();
  const capabilities = selectCapabilities();

  console.log("\n========================================");
  console.log("       LLM CAPABILITY MATRIX");
  console.log("========================================");
  console.log(`Models: ${models.length}`);
  console.log(`Capabilities: ${capabilities.join(", ")}\n`);

  const rows = new Map<string, Map<Capability, CellResult>>();

  for (const model of models) {
    const label = model.label || model.model;
    const collective = Boolean(collectiveFor(model));
    console.log(`▸ ${label}`);
    const cells = new Map<Capability, CellResult>();
    for (const capability of capabilities) {
      process.stdout.write(`  ${capability} … `);
      const cell = await runCell(model, capability);
      cells.set(capability, cell);
      const status = cellSymbol(cell, collective);
      const note = cell.detail ? ` (${cell.detail})` : "";
      console.log(`${status}${note}`);
    }
    rows.set(label, cells);
  }

  console.log("\n========================================");
  console.log("       MATRIX");
  console.log("========================================\n");
  console.log(formatTable(models, capabilities, rows));

  const issues = formatIssues(models, rows);
  if (issues.length > 0) {
    console.log("\n========================================");
    console.log("       ISSUES");
    console.log("========================================");
    for (const line of issues) console.log(line);
  }

  // Collective blocks are judged as a whole rather than cell by cell.
  const failedBlocks: string[] = [];
  for (const block of COLLECTIVES) {
    const evaluation = evaluateCollective(
      block.matches,
      models,
      capabilities,
      rows,
    );
    if (!evaluation) continue;
    console.log("\n========================================");
    console.log(`       ${block.name.toUpperCase()}`);
    console.log("========================================");
    for (const line of formatCollectiveReport(block.name, evaluation)) {
      console.log(line);
    }
    if (!evaluation.passed) failedBlocks.push(block.name);
  }

  // Exit non-zero if a cell outside every collective mismatched its expected
  // outcome, or if a collective block failed its majority threshold.
  let mismatches = 0;
  for (const model of models) {
    if (collectiveFor(model)) continue;
    const cells = rows.get(model.label || model.model);
    if (!cells) continue;
    for (const cell of cells.values()) {
      if (!cell.matches) mismatches++;
    }
  }

  console.log("\n========================================");
  if (mismatches === 0 && failedBlocks.length === 0) {
    console.log(
      `🎉 Matrix passed: expectations met, collectives held their majority.`,
    );
  } else {
    if (mismatches > 0) {
      console.error(`💀 ${mismatches} cell(s) mismatched expectation.`);
    }
    for (const name of failedBlocks) {
      console.error(`💀 ${name} block failed: row/column majority not met.`);
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
