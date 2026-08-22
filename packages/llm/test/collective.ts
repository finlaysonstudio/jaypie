//
// Collective evaluation for the live capability matrix (`test/matrix.ts`).
//
// Some providers cannot be judged one cell at a time. OpenRouter picks the
// backend it routes to, Bedrock resells third-party models, and Fireworks
// serves open models whose structured output varies run to run. A single red
// cell in those blocks is as likely to be a flake as a defect. A whole row
// (one model across every capability) or a whole column (one capability across
// every model in the block) going red is a defect either way.
//
// So a collective block passes when the *majority* of every row AND every
// column is a success (ok or warn). Skips are excluded from the denominator,
// and an axis with nothing left in it passes.
//

import { Capability, ExpectedOutcome, ModelConfig } from "./models.js";

export type ActualOutcome = "ok" | "warn" | "skip" | "fail";

export interface CellResult {
  actual: ActualOutcome;
  expected: ExpectedOutcome;
  matches: boolean;
  warnings: string[];
  detail?: string;
}

export interface Collective {
  name: string;
  matches: (model: ModelConfig) => boolean;
}

export const COLLECTIVES: readonly Collective[] = [
  {
    name: "Bedrock",
    matches: (model) =>
      model.provider === "bedrock" || model.model.startsWith("bedrock:"),
  },
  { name: "Fireworks", matches: (model) => model.provider === "fireworks" },
  { name: "OpenRouter", matches: (model) => model.provider === "openrouter" },
];

/** The collective block a model belongs to, or undefined when judged alone. */
export function collectiveFor(model: ModelConfig): Collective | undefined {
  return COLLECTIVES.find((block) => block.matches(model));
}

export interface AxisResult {
  ok: number;
  total: number;
  passed: boolean;
}

export interface CollectiveEvaluation {
  passed: boolean;
  rows: Map<string, AxisResult>;
  columns: Map<Capability, AxisResult>;
}

export function isCellSuccess(cell: CellResult): boolean {
  return cell.actual === "ok" || cell.actual === "warn";
}

export function evaluateAxis(cells: readonly CellResult[]): AxisResult {
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

export function evaluateCollective(
  filterFn: (model: ModelConfig) => boolean,
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

export function formatCollectiveReport(
  name: string,
  evaluation: CollectiveEvaluation,
): string[] {
  const lines: string[] = [];
  lines.push(`${name} (evaluated as a collective):`);
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
