import { describe, expect, it } from "vitest";

import {
  ActualOutcome,
  CellResult,
  COLLECTIVES,
  collectiveFor,
  evaluateAxis,
  evaluateCollective,
  formatCollectiveReport,
} from "../collective.js";
import { Capability, ModelConfig } from "../models.js";

//
// Helpers
//

const CAPS: readonly Capability[] = [
  "plain",
  "tools",
  "structured",
  "both",
] as const;

function cell(actual: ActualOutcome): CellResult {
  return { actual, expected: "ok", matches: actual === "ok", warnings: [] };
}

function model(name: string, provider = "fireworks"): ModelConfig {
  return { model: name, provider };
}

/** Build a grid from a per-model map of capability outcomes. */
function grid(
  spec: Record<string, Partial<Record<Capability, ActualOutcome>>>,
): Map<string, Map<Capability, CellResult>> {
  const rows = new Map<string, Map<Capability, CellResult>>();
  for (const [label, caps] of Object.entries(spec)) {
    const cells = new Map<Capability, CellResult>();
    for (const capability of CAPS) {
      cells.set(capability, cell(caps[capability] ?? "ok"));
    }
    rows.set(label, cells);
  }
  return rows;
}

const MODELS = [model("alpha"), model("beta"), model("gamma")];
const IS_FIREWORKS = (m: ModelConfig) => m.provider === "fireworks";

function evaluate(
  spec: Record<string, Partial<Record<Capability, ActualOutcome>>>,
) {
  return evaluateCollective(IS_FIREWORKS, MODELS, CAPS, grid(spec));
}

//
// Tests
//

describe("collective", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(evaluateCollective).toBeTypeOf("function");
      expect(evaluateAxis).toBeTypeOf("function");
    });

    it("returns null when no model belongs to the block", () => {
      const rows = grid({ alpha: {} });
      expect(evaluateCollective(() => false, MODELS, CAPS, rows)).toBeNull();
    });
  });

  describe("Happy Paths", () => {
    it("passes when every cell succeeds", () => {
      const evaluation = evaluate({ alpha: {}, beta: {}, gamma: {} });
      expect(evaluation?.passed).toBe(true);
    });

    it("counts a warning as a success", () => {
      const evaluation = evaluate({
        alpha: { plain: "warn", tools: "warn", structured: "warn" },
        beta: {},
        gamma: {},
      });
      expect(evaluation?.passed).toBe(true);
    });
  });

  describe("Features", () => {
    describe("Majority", () => {
      it("survives one flaky cell", () => {
        const evaluation = evaluate({
          alpha: { structured: "fail" },
          beta: {},
          gamma: {},
        });
        expect(evaluation?.passed).toBe(true);
        expect(evaluation?.rows.get("alpha")).toMatchObject({
          ok: 3,
          total: 4,
          passed: true,
        });
        expect(evaluation?.columns.get("structured")).toMatchObject({
          ok: 2,
          total: 3,
          passed: true,
        });
      });

      it("fails when a whole row goes red", () => {
        const evaluation = evaluate({
          alpha: {
            plain: "fail",
            tools: "fail",
            structured: "fail",
            both: "fail",
          },
          beta: {},
          gamma: {},
        });
        expect(evaluation?.passed).toBe(false);
        expect(evaluation?.rows.get("alpha")?.passed).toBe(false);
        expect(evaluation?.rows.get("beta")?.passed).toBe(true);
      });

      it("fails when a whole column goes red", () => {
        const evaluation = evaluate({
          alpha: { structured: "fail" },
          beta: { structured: "fail" },
          gamma: { structured: "fail" },
        });
        expect(evaluation?.passed).toBe(false);
        expect(evaluation?.columns.get("structured")?.passed).toBe(false);
        expect(evaluation?.columns.get("plain")?.passed).toBe(true);
        // Every row still holds its own majority — the column is the verdict.
        for (const row of evaluation!.rows.values()) {
          expect(row.passed).toBe(true);
        }
      });

      it("requires a strict majority, so an even split fails", () => {
        expect(evaluateAxis([cell("ok"), cell("fail")])).toMatchObject({
          ok: 1,
          total: 2,
          passed: false,
        });
        expect(
          evaluateAxis([cell("ok"), cell("ok"), cell("fail")]),
        ).toMatchObject({ ok: 2, total: 3, passed: true });
      });
    });

    describe("Skips", () => {
      it("excludes skipped cells from the denominator", () => {
        expect(
          evaluateAxis([cell("skip"), cell("skip"), cell("ok"), cell("fail")]),
        ).toMatchObject({ ok: 1, total: 2, passed: false });
      });

      it("passes an axis with nothing left to judge", () => {
        expect(evaluateAxis([cell("skip"), cell("skip")])).toMatchObject({
          ok: 0,
          total: 0,
          passed: true,
        });
      });

      it("does not let a skip-heavy row mask a failure", () => {
        const evaluation = evaluate({
          alpha: { plain: "skip", tools: "skip", structured: "fail" },
          beta: {},
          gamma: {},
        });
        // alpha is 1 ok of 2 judged — not a majority.
        expect(evaluation?.rows.get("alpha")?.passed).toBe(false);
        expect(evaluation?.passed).toBe(false);
      });
    });

    describe("Membership", () => {
      it("names Bedrock, Fireworks, and OpenRouter as collectives", () => {
        expect(COLLECTIVES.map((block) => block.name)).toEqual([
          "Bedrock",
          "Fireworks",
          "OpenRouter",
        ]);
      });

      it("resolves a model to its block", () => {
        expect(collectiveFor(model("x", "fireworks"))?.name).toBe("Fireworks");
        expect(collectiveFor(model("x", "openrouter"))?.name).toBe(
          "OpenRouter",
        );
        expect(collectiveFor(model("x", "bedrock"))?.name).toBe("Bedrock");
        expect(collectiveFor(model("bedrock:nova", "aws"))?.name).toBe(
          "Bedrock",
        );
      });

      it("leaves a first-party model to be judged cell by cell", () => {
        expect(collectiveFor(model("claude-sonnet-5", "anthropic"))).toBe(
          undefined,
        );
      });
    });

    describe("Report", () => {
      it("marks the failing axis", () => {
        const evaluation = evaluate({
          alpha: { structured: "fail" },
          beta: { structured: "fail" },
          gamma: { structured: "fail" },
        });
        const lines = formatCollectiveReport("Fireworks", evaluation!);
        expect(lines[0]).toBe("Fireworks (evaluated as a collective):");
        expect(lines).toContain("  ❌ col structured: 0/3 ok");
        expect(lines).toContain("  ✅ row alpha: 3/4 ok");
      });
    });
  });
});
