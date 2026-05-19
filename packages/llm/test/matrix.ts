/* eslint-disable no-console */
//
// Smoke-test matrix: runs each model in `models.ts` through every capability
// (plain, tools, structured, both, pdf, image) and prints a grid of
// outcomes. Non-zero exit when any cell mismatches its expected outcome.
//
// Usage:
//   npm run test:matrix -w packages/llm
//   LOG_LEVEL=warn npm run test:matrix -w packages/llm   # quiet trace/debug
//   APP_MODELS=claude-sonnet-4-5,gpt-4o npm run test:matrix -w packages/llm
//   APP_CAPABILITIES=plain,tools npm run test:matrix -w packages/llm
//
// Env:
//   APP_MODELS       comma-separated override for the configured model list
//   APP_CAPABILITIES comma-separated subset of capabilities to run
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

import { Llm, LlmOperateInput, toolkit } from "../src/index.js";
import {
  CAPABILITIES,
  Capability,
  ExpectedOutcome,
  MODELS,
  ModelConfig,
} from "./models.js";

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

//
//
// Outcome types
//

type ActualOutcome = "ok" | "warn" | "skip" | "fail";

interface CellResult {
  actual: ActualOutcome;
  expected: ExpectedOutcome;
  matches: boolean;
  warnings: string[];
  detail?: string;
}

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

interface CapabilityResult {
  ok: boolean;
  detail?: string;
}

async function runPlain(llm: Llm): Promise<CapabilityResult> {
  const result = await llm.operate(
    "Reply with one word: 'pong'. No punctuation.",
    { user: USER },
  );
  if (result.error) return { ok: false, detail: String(result.error) };
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
  if (result.error) return { ok: false, detail: String(result.error) };
  if (!toolCalled) return { ok: false, detail: "roll tool was not called" };
  return { ok: true };
}

async function runStructured(llm: Llm): Promise<CapabilityResult> {
  const result = await llm.operate("List exactly three primary colors.", {
    format: { colors: [String] },
    user: USER,
  });
  if (result.error) return { ok: false, detail: String(result.error) };
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
  if (result.error) return { ok: false, detail: String(result.error) };
  if (!toolCalled) return { ok: false, detail: "roll tool was not called" };
  const content = result.content as
    | { values?: unknown; total?: unknown }
    | string
    | undefined;
  if (!content || typeof content !== "object") {
    return { ok: false, detail: `expected object, got ${typeof content}` };
  }
  if (typeof content.total !== "number") {
    return { ok: false, detail: "total missing or not a number" };
  }
  return { ok: true };
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
  if (result.error) return { ok: false, detail: String(result.error) };
  return checkDocStrings(result.content);
}

async function runImage(llm: Llm): Promise<CapabilityResult> {
  const input: LlmOperateInput = [
    "Extract the text from this image.",
    { image: IMAGE_PATH },
  ];
  const result = await llm.operate(input, { user: USER });
  if (result.error) return { ok: false, detail: String(result.error) };
  return checkDocStrings(result.content);
}

async function runTemperature(llm: Llm): Promise<CapabilityResult> {
  const result = await llm.operate(
    "Reply with one word: 'pong'. No punctuation.",
    { temperature: 0, user: USER },
  );
  if (result.error) return { ok: false, detail: String(result.error) };
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

function classifyActual(
  capability: CapabilityResult,
  warnings: string[],
): ActualOutcome {
  if (!capability.ok) return "fail";
  if (warnings.length > 0) return "warn";
  return "ok";
}

async function runCell(
  model: ModelConfig,
  capability: Capability,
): Promise<CellResult> {
  const expected = expectedFor(model, capability);

  if (expected === "skip") {
    return { actual: "skip", expected, matches: true, warnings: [] };
  }

  const llm = new Llm(model.provider, { model: model.model });
  let outcome: CapabilityResult;
  let warnings: string[] = [];
  try {
    const captured = await captureWarnings(() => RUNNERS[capability](llm));
    outcome = captured.result;
    warnings = captured.warnings;
  } catch (error) {
    outcome = {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const actual = classifyActual(outcome, warnings);
  const matches = matchesExpected(actual, expected);
  return {
    actual,
    expected,
    matches,
    warnings,
    detail: outcome.detail,
  };
}

function matchesExpected(
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

function isOpenRouterModel(model: ModelConfig): boolean {
  return model.provider === "openrouter";
}

function isBedrockModel(model: ModelConfig): boolean {
  return model.provider === "bedrock" || model.model.startsWith("bedrock:");
}

function displayActual(cell: CellResult, openrouter: boolean, bedrock: boolean): ActualOutcome {
  // OpenRouter and Bedrock are evaluated as collectives; surface individual
  // failures as warnings so a single flaky route does not paint the cell red.
  if ((openrouter || bedrock) && cell.actual === "fail") return "warn";
  return cell.actual;
}

function cellSymbol(cell: CellResult, openrouter: boolean, bedrock: boolean): string {
  const actual = displayActual(cell, openrouter, bedrock);
  const sym = SYMBOLS[actual];
  // OpenRouter and Bedrock cells skip the mismatch indicator (collective evaluation).
  // Otherwise, suppress `!` when the actual outcome is already a failure —
  // the ❌ glyph conveys the problem on its own.
  if (openrouter || bedrock) return sym;
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
    const openrouter = isOpenRouterModel(model);
    const bedrock = isBedrockModel(model);
    const row = [
      labelOf(model).padEnd(labelWidth),
      ...capabilities.map((c) => {
        const cell = cells.get(c);
        if (!cell) return "?".padStart(colWidth(c));
        return cellSymbol(cell, openrouter, bedrock).padStart(colWidth(c));
      }),
    ].join("  ");
    lines.push(row);
  }
  lines.push(sep);
  lines.push(
    "Legend: ✅ ok   ⚠️ warn   ❌ fail   — skip   `!` mismatch vs expected",
  );
  lines.push(
    "OpenRouter/Bedrock rows: failures display as ⚠️ and pass/fail collectively (row+column majority).",
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
    const openrouter = isOpenRouterModel(model);
    const bedrock = isBedrockModel(model);
    for (const [cap, cell] of cells) {
      if (cell.matches && cell.warnings.length === 0) continue;
      const parts = [`[${label} / ${cap}]`];
      if (!cell.matches) {
        const tag = openrouter ? "openrouter-fail" : bedrock ? "bedrock-fail" : "mismatch";
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
// OpenRouter collective evaluation
//
// OpenRouter routes are flaky and capability support varies by backend.
// Rather than gate CI on individual cells, we accept the block as long as
// the *majority* of every row (per model) AND every column (per capability)
// is a success (ok or warn). Skips are excluded from the denominator.
//

interface AxisResult {
  ok: number;
  total: number;
  passed: boolean;
}

interface CollectiveEvaluation {
  passed: boolean;
  rows: Map<string, AxisResult>;
  columns: Map<Capability, AxisResult>;
}

/** @deprecated Use CollectiveEvaluation */
type OpenRouterEvaluation = CollectiveEvaluation;

function isCellSuccess(cell: CellResult): boolean {
  return cell.actual === "ok" || cell.actual === "warn";
}

function evaluateAxis(cells: readonly CellResult[]): AxisResult {
  let ok = 0;
  let total = 0;
  for (const cell of cells) {
    if (cell.actual === "skip") continue;
    total++;
    if (isCellSuccess(cell)) ok++;
  }
  // Strict majority: ok must outnumber failures. An empty axis (all skipped)
  // is treated as a pass.
  const passed = total === 0 || ok * 2 > total;
  return { ok, total, passed };
}

function evaluateCollective(
  filterFn: (m: ModelConfig) => boolean,
  models: readonly ModelConfig[],
  capabilities: readonly Capability[],
  rows: Map<string, Map<Capability, CellResult>>,
): CollectiveEvaluation | null {
  const selected = models.filter(filterFn);
  if (selected.length === 0) return null;

  const rowResults = new Map<string, AxisResult>();
  for (const model of selected) {
    const label = model.label || model.model;
    const cellsMap = rows.get(label);
    if (!cellsMap) continue;
    const cells = capabilities
      .map((c) => cellsMap.get(c))
      .filter((c): c is CellResult => Boolean(c));
    rowResults.set(label, evaluateAxis(cells));
  }

  const colResults = new Map<Capability, AxisResult>();
  for (const cap of capabilities) {
    const cells: CellResult[] = [];
    for (const model of selected) {
      const cell = rows.get(model.label || model.model)?.get(cap);
      if (cell) cells.push(cell);
    }
    colResults.set(cap, evaluateAxis(cells));
  }

  const passed =
    Array.from(rowResults.values()).every((r) => r.passed) &&
    Array.from(colResults.values()).every((c) => c.passed);

  return { passed, rows: rowResults, columns: colResults };
}

function evaluateOpenRouter(
  models: readonly ModelConfig[],
  capabilities: readonly Capability[],
  rows: Map<string, Map<Capability, CellResult>>,
): CollectiveEvaluation | null {
  return evaluateCollective(isOpenRouterModel, models, capabilities, rows);
}

function evaluateBedrock(
  models: readonly ModelConfig[],
  capabilities: readonly Capability[],
  rows: Map<string, Map<Capability, CellResult>>,
): CollectiveEvaluation | null {
  return evaluateCollective(isBedrockModel, models, capabilities, rows);
}

function formatOpenRouterReport(evaluation: CollectiveEvaluation): string[] {
  const lines: string[] = [];
  lines.push("OpenRouter (evaluated as a collective):");
  for (const [label, result] of evaluation.rows) {
    const status = result.passed ? "✅" : "❌";
    lines.push(`  ${status} row ${label}: ${result.ok}/${result.total} ok`);
  }
  for (const [cap, result] of evaluation.columns) {
    const status = result.passed ? "✅" : "❌";
    lines.push(`  ${status} col ${cap}: ${result.ok}/${result.total} ok`);
  }
  return lines;
}

function formatBedrockReport(evaluation: CollectiveEvaluation): string[] {
  const lines: string[] = [];
  lines.push("Bedrock (evaluated as a collective):");
  for (const [label, result] of evaluation.rows) {
    const status = result.passed ? "✅" : "❌";
    lines.push(`  ${status} row ${label}: ${result.ok}/${result.total} ok`);
  }
  for (const [cap, result] of evaluation.columns) {
    const status = result.passed ? "✅" : "❌";
    lines.push(`  ${status} col ${cap}: ${result.ok}/${result.total} ok`);
  }
  return lines;
}

//
//
// Main
//

function selectModels(): readonly ModelConfig[] {
  const env = process.env.APP_MODELS;
  if (!env) return MODELS;
  const ids = env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.map((id) => {
    const existing = MODELS.find((m) => m.model === id);
    return existing ?? { model: id, expect: {} };
  });
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
    const openrouter = isOpenRouterModel(model);
    const bedrock = isBedrockModel(model);
    console.log(`▸ ${label}`);
    const cells = new Map<Capability, CellResult>();
    for (const capability of capabilities) {
      process.stdout.write(`  ${capability} … `);
      const cell = await runCell(model, capability);
      cells.set(capability, cell);
      const status = cellSymbol(cell, openrouter, bedrock);
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

  // OpenRouter and Bedrock cells are evaluated as collectives rather than per-cell.
  const openrouterEvaluation = evaluateOpenRouter(models, capabilities, rows);
  if (openrouterEvaluation) {
    console.log("\n========================================");
    console.log("       OPENROUTER");
    console.log("========================================");
    for (const line of formatOpenRouterReport(openrouterEvaluation)) {
      console.log(line);
    }
  }

  const bedrockEvaluation = evaluateBedrock(models, capabilities, rows);
  if (bedrockEvaluation) {
    console.log("\n========================================");
    console.log("       BEDROCK");
    console.log("========================================");
    for (const line of formatBedrockReport(bedrockEvaluation)) {
      console.log(line);
    }
  }

  // Exit non-zero if any non-OpenRouter, non-Bedrock cell mismatched its
  // expected outcome, or if the OpenRouter/Bedrock block failed its majority threshold.
  let mismatches = 0;
  for (const model of models) {
    if (isOpenRouterModel(model)) continue;
    if (isBedrockModel(model)) continue;
    const cells = rows.get(model.label || model.model);
    if (!cells) continue;
    for (const cell of cells.values()) {
      if (!cell.matches) mismatches++;
    }
  }

  console.log("\n========================================");
  const openrouterFailed = openrouterEvaluation
    ? !openrouterEvaluation.passed
    : false;
  const bedrockFailed = bedrockEvaluation ? !bedrockEvaluation.passed : false;
  if (mismatches === 0 && !openrouterFailed && !bedrockFailed) {
    console.log(`🎉 Matrix passed: every cell matched expectation.`);
  } else {
    if (mismatches > 0) {
      console.error(`💀 ${mismatches} cell(s) mismatched expectation.`);
    }
    if (openrouterFailed) {
      console.error(`💀 OpenRouter block failed: row/column majority not met.`);
    }
    if (bedrockFailed) {
      console.error(`💀 Bedrock block failed: row/column majority not met.`);
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
